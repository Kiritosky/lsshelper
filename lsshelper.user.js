// ==UserScript==
// @name         LSS Helper
// @namespace    lsshelper
// @version      0.4.1
// @description  Helfer für das Leitstellenspiel: markiert im Einsatzfenster die passende AAO bzw. die AAOs der (noch) benötigten Fahrzeuge.
// @match        https://www.leitstellenspiel.de/*
// @match        https://polizei.leitstellenspiel.de/*
// @updateURL    https://raw.githubusercontent.com/Kiritosky/lsshelper/main/lsshelper.user.js
// @downloadURL  https://raw.githubusercontent.com/Kiritosky/lsshelper/main/lsshelper.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;
    const CACHE_KEY = 'lsshelper_missions_v4';
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    const log = (...args) => DEBUG && console.log('[LSS Helper]', ...args);

    /* ------------------------------------------------------------------ *
     * Kern: Einsatzdaten (einsaetze.json), einmal geladen und geteilt
     * ------------------------------------------------------------------ */

    // Das Hauptfenster hält die Daten im Speicher, Einsatzfenster (iframes) greifen direkt darauf zu.
    const shared = (() => {
        try {
            if (window.top !== window && window.top.LSSHelperShared) return window.top.LSSHelperShared;
        } catch (e) {
            /* fremder Ursprung */
        }
        return (window.LSSHelperShared = window.LSSHelperShared || {});
    })();

    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        } catch (e) {
            return null;
        }
    }

    async function fetchMissions() {
        const all = await (await fetch('/einsaetze.json')).json();
        const m = {};
        all.forEach(e => {
            const a = e.additional || {};
            const c = e.chances || {};
            m[e.id] = {
                n: e.name,
                r: e.requirements || {},
                // Patienten: [max, min, NEF-%, RTH-%, Transport-%, KTW erlaubt]
                p: a.possible_patient ? [a.possible_patient, a.possible_patient_min || 0, c.nef || 0, c.helicopter || 0, c.patient_transport || 0, a.allow_ktw_instead_of_rtw ? 1 : 0] : null,
                // Fahrzeuggruppen, die den Einsatzort überhaupt erreichen (z. B. Bergrettung, Seenotrettung)
                g: a.vehicle_groups || null,
                c: e.mission_categories || [],
            };
        });
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), m }));
        } catch (e) {
            log('Cache konnte nicht gespeichert werden', e);
        }
        shared.missions = m;
        return m;
    }

    // Liefert sofort, was da ist (Speicher > Cache); veraltete Daten werden im Hintergrund erneuert.
    function getMissions() {
        if (shared.missions) return Promise.resolve(shared.missions);
        const cached = readCache();
        if (cached) {
            shared.missions = cached.m;
            if (Date.now() - cached.t > CACHE_TTL && !shared.refreshing) shared.refreshing = fetchMissions().catch(log);
            return Promise.resolve(cached.m);
        }
        shared.loading = shared.loading || fetchMissions();
        return shared.loading;
    }

    /* ------------------------------------------------------------------ *
     * Feature: AAO-Markierung im Einsatzfenster
     * ------------------------------------------------------------------ */

    const LF = [0, 1, 6, 7, 8, 9, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 30, 37, 87, 88, 89, 90, 107, 119, 121, 163, 166, 167];
    const LF_ATTRS = ['fire', 'lf_only', 'hlf_only', 'tlf_only', 'hlf_or_rw_and_lf'];

    // keys:  Anforderungs-Schlüssel aus einsaetze.json
    // texts: Bezeichnungen, wie das Spiel sie bei fehlenden Fahrzeugen (Nachalarmierung) nennt
    // types: Fahrzeugtyp-IDs, die die Anforderung erfüllen
    // attrs: offizielle AAO-Felder (window.aao_types), die die Anforderung erfüllen
    const DEMANDS = [
        // Feuerwehr
        { label: 'Löschfahrzeuge', keys: ['firetrucks'], texts: ['Löschfahrzeug (LF)', 'Löschfahrzeuge (LF)'], types: LF, attrs: LF_ATTRS },
        { label: 'Drehleitern', keys: ['platform_trucks'], texts: ['Drehleiter (DLK 23)', 'Drehleitern (DLK 23)'], types: [2, 85], attrs: ['dlk', 'dlk_or_tm50'] },
        { label: 'ELW 1', keys: ['battalion_chief_vehicles'], texts: ['ELW 1'], types: [3, 34, 78, 128, 129], attrs: ['elw', 'elw1_or_elw2', 'elw1_or_elw_drone'] },
        { label: 'ELW 2', keys: ['mobile_command_vehicles'], texts: ['ELW 2'], types: [34, 78, 129], attrs: ['elw2', 'elw2_or_ab_elw', 'ab_einsatzleitung_only', 'elw2_or_elw2_drone'] },
        { label: 'Rüstwagen', keys: ['heavy_rescue_vehicles'], texts: ['Rüstwagen oder HLF', 'Rüstwagen'], types: [4, 30, 47, 90, 162, 163], attrs: ['rw', 'rw_only', 'ab_ruest', 'ab_ruest_rw', 'hlf_only', 'hlf_or_rw_and_lf'] },
        { label: 'GW-Atemschutz', keys: ['mobile_air_vehicles'], texts: ['GW-Atemschutz', 'GW-A'], types: [5, 48], attrs: ['gwa', 'gw_atemschutz_only', 'ab_atemschutz_only'] },
        { label: 'Schlauchwagen', keys: ['water_tankers'], texts: ['Schlauchwagen (GW-L2 Wasser, SW 1000, SW 2000 oder Ähnliches)', 'Schlauchwagen (GW-L2 Wasser oder SW)', 'Schlauchwagen'], types: [11, 13, 14, 15, 16, 62, 101, 102, 143], attrs: ['gwl2wasser', 'gwl2wasser_only', 'abl2wasser_only', 'gwl2wasser_all'] },
        { label: 'GW-Öl', keys: ['gwoil'], texts: ['GW-Öl'], types: [10, 49], attrs: ['gwoel', 'gw_oel_only', 'ab_oel_only'] },
        { label: 'GW-Messtechnik', keys: ['gwmess'], texts: ['GW-Messtechnik', 'GW-Mess'], types: [12], attrs: ['gwmesstechnik'] },
        { label: 'GW-Gefahrgut', keys: ['hazmat_vehicles'], texts: ['GW-Gefahrgut'], types: [27, 77], attrs: ['gwgefahrgut', 'gw_gefahrgut_only', 'ab_gefahrgut_only'] },
        { label: 'Dekon-P', keys: ['hazmat_dekon'], texts: ['Dekon-P'], types: [53, 54], attrs: ['dekon_p', 'only_dekon_p', 'only_ab_dekon_p'] },
        { label: 'GW-Höhenrettung', keys: ['height_rescue_units'], texts: ['GW-Höhenrettung'], types: [33, 155, 158], attrs: ['gwhoehenrettung'] },
        { label: 'FwK', keys: ['fwk'], texts: ['FwK', 'Feuerwehrkran', 'Feuerwehrkräne'], types: [57, 182], attrs: ['fwk'] },
        { label: 'Lüfter', keys: ['ventilation'], texts: ['Lüfter'], types: [114, 115, 116], attrs: ['ventilation'] },
        { label: 'Bahnrettungsfahrzeuge', keys: ['railway_fire'], texts: ['Bahnrettungsfahrzeug', 'Bahnrettungsfahrzeuge'], types: [162, 163, 164], attrs: ['railway_fire'] },
        { label: 'FLF', keys: ['arff'], texts: ['Flugfeldlöschfahrzeug', 'Flugfeldlöschfahrzeuge', 'FLF'], types: [75], attrs: ['arff'] },
        { label: 'Rettungstreppe', keys: ['rettungstreppe'], texts: ['Rettungstreppe', 'Rettungstreppen'], types: [76], attrs: ['rettungstreppe'] },
        { label: 'GW-Werkfeuerwehr', keys: ['gw_werkfeuerwehr'], texts: ['GW-Werkfeuerwehr'], types: [83], attrs: ['gw_werkfeuerwehr'] },
        { label: 'ULF mit Löscharm', keys: ['ulf'], texts: ['ULF mit Löscharm'], types: [84], attrs: ['ulf'] },
        { label: 'Teleskopmast', keys: ['teleskopmast'], texts: ['Teleskopmast', 'Teleskopmasten'], types: [85], attrs: ['tm50', 'dlk_or_tm50'] },
        { label: 'Turbolöscher', keys: ['turboloescher'], texts: ['Turbolöscher'], types: [86], attrs: ['turboloescher'] },
        { label: 'Außenlastbehälter', keys: ['helicopter_bucket'], texts: ['Außenlastbehälter', 'Außenlastbehälter (allgemein)'], types: [96], attrs: ['helicopter_bucket'] },
        { label: 'Drohneneinheit', keys: ['drone'], texts: ['Drohneneinheit', 'Drohneneinheiten'], types: [125, 126, 127, 128, 129], attrs: ['drone'] },
        { label: 'LF oder RW', keys: ['oneof_fire_engine_or_rescue'], texts: ['Löschfahrzeug oder Rüstwagen', 'Löschfahrzeuge oder Rüstwagen'], types: LF.concat(4, 47, 162), attrs: LF_ATTRS.concat('rw', 'rw_only', 'ab_ruest_rw') },
        { label: 'LF, RW oder GW-Öl', keys: ['oneof_fire_engine_or_rescue_or_oil_equipment'], texts: ['Löschfahrzeug, Rüstwagen oder Gerätewagen Öl'], types: LF.concat(4, 47, 162, 10, 49), attrs: LF_ATTRS.concat('rw', 'rw_only', 'ab_ruest_rw', 'gwoel', 'gw_oel_only') },
        { label: 'Feuerlöschpumpen', keys: ['water_damage_pump'], texts: ['Feuerlöschpumpe (z. B. LF)', 'Feuerlöschpumpen (z. B. LF)'], types: LF.concat(101, 102), attrs: LF_ATTRS.concat('water_damage_pump') },
        { label: 'Schmutzwasserpumpen', keys: ['pump'], texts: ['Schmutzwasserpumpe', 'Schmutzwasserpumpen'], types: [101, 102], attrs: ['pump'] },
        { label: 'GW-Tierrettung', keys: ['animal_rescue'], texts: ['GW-Tierrettung'], types: [185, 186], attrs: ['animal_rescue'] },

        // Rettungsdienst / Wasser / SEG
        { label: 'RTW', keys: ['ambulances'], texts: ['RTW'], types: [28, 74, 97], attrs: ['rtw', 'naw'] },
        { label: 'RTW oder KTW', keys: [], texts: ['RTW oder KTW oder KTW-B'], types: [28, 38, 58, 74, 97], attrs: ['rtw', 'ktw', 'ktw_b', 'ktw_or_rtw', 'ktw_or_rtw_2'] },
        { label: 'GW-San', keys: ['gw_san'], texts: ['GW-San'], types: [60], attrs: ['gw_san'] },
        { label: 'ELW 1 (SEG)', keys: ['seg_elw'], texts: ['ELW 1 (SEG)'], types: [59], attrs: ['seg_elw'] },
        { label: 'Rettungshundestaffel', keys: ['rescue_dog_units'], texts: ['Rettungshundestaffel', 'Rettungshundestaffeln'], types: [91, 92], attrs: ['rescue_dogs', 'rescue_dogs_seg', 'rescue_dogs_thw'] },
        { label: 'Boote', keys: ['boats'], texts: ['Boot', 'Boote'], types: [66, 67, 68, 70, 71], attrs: ['boot', 'mzb', 'thw_anh_mzab', 'thw_anh_schlb', 'thw_anh_mzb'] },
        { label: 'GW-Taucher', keys: ['diver_units'], texts: ['GW-Taucher'], types: [63, 69], attrs: ['gw_taucher', 'thw_tauchkraftwagen', 'thw_tauchkraftwagen_or_gw_taucher'] },
        { label: 'Betreuung/Verpflegung', keys: [], texts: ['Betreuungs- und Verpflegungsausstattung', 'Betreuungs- und Verpflegungsausstattungen'], types: [130, 132, 139, 141, 178], attrs: ['care_service_equipment'] },
        { label: 'Bt-Kombi', keys: [], texts: ['Bt-Kombi', 'Bt-Kombis'], types: [131], attrs: [] },

        // Polizei
        { label: 'FuStW', keys: ['police_cars'], texts: ['FuStW', 'Funkstreifenwagen'], types: [32, 103], attrs: ['fustw', 'police_car_or_service_group_leader'] },
        { label: 'FuStW (DGL)', keys: ['police_service_group_leader'], texts: ['Funkstreifenwagen (Dienstgruppenleitung)', 'FuStW (DGL)'], types: [103], attrs: [] },
        { label: 'Polizeimotorrad', keys: ['police_motorcycle'], texts: ['Polizeimotorrad', 'Polizeimotorräder'], types: [95], attrs: ['police_motorcycle'] },
        { label: 'Zivilstreifenwagen', keys: ['civil_patrolcar'], texts: ['Zivilstreifenwagen'], types: [98], attrs: [] },
        { label: 'FuStW oder Motorrad', keys: ['oneof_police_patrol_or_motorcycle'], texts: ['Funkstreifenwagen oder Polizeimotorrad', 'Funkstreifenwagen oder Polizeimotorräder'], types: [32, 95, 103], attrs: ['fustw', 'police_motorcycle', 'fustw_or_police_motorcycle', 'police_car_or_service_group_leader'] },
        { label: 'FuStW oder Zivil', keys: ['oneof_police_patrol_or_civil_patrol'], texts: ['Funkstreifenwagen oder Zivilstreifenwagen'], types: [32, 98, 103], attrs: ['fustw', 'fustkw_or_civil_patrolcar', 'police_car_or_service_group_leader'] },
        { label: 'FuStW, Zivil oder Motorrad', keys: ['oneof_police_patrol_or_civil_patrol_or_motorcycle'], texts: ['Funkstreifenwagen oder Zivilstreifenwagen oder Polizeimotorrad', 'Funkstreifenwagen oder Zivilstreifenwagen oder Polizeimotorräder'], types: [32, 95, 98, 103], attrs: ['fustw', 'police_motorcycle', 'fustw_or_police_motorcycle', 'fustkw_or_civil_patrolcar', 'police_car_or_service_group_leader'] },
        { label: 'FuStW (AP)', keys: ['highway_police'], texts: ['FuStW (AP)'], types: [184], attrs: [] },
        { label: 'Polizeihubschrauber', keys: ['police_helicopters'], texts: ['Polizeihubschrauber'], types: [61, 156], attrs: ['polizeihubschrauber'] },
        { label: 'Polizeipferde', keys: ['police_horse'], texts: ['Polizeipferd', 'Polizeipferde'], types: [134, 135, 136], attrs: ['police_horse', 'police_horse_count'] },
        { label: 'LauKw', keys: ['police_speaker'], texts: ['LauKw'], types: [165], attrs: [] },
        { label: 'DHuFüKW', keys: ['k9'], texts: ['DHuFüKW'], types: [94], attrs: ['k9'] },
        { label: 'GruKw', keys: ['grukw'], texts: ['GruKw'], types: [50], attrs: ['grukw'] },
        { label: 'leBefKw', keys: ['lebefkw'], texts: ['leBefKw'], types: [35], attrs: ['lebefkw'] },
        { label: 'FüKW (Polizei)', keys: ['fukw'], texts: ['FüKW (Polizei)'], types: [51], attrs: ['fukw'] },
        { label: 'GefKw', keys: ['gefkw'], texts: ['GefKw'], types: [52], attrs: ['gefkw'] },
        { label: 'Wasserwerfer', keys: ['wasserwerfer'], texts: ['Wasserwerfer', 'WaWe 10'], types: [72], attrs: ['wasserwerfer'] },
        { label: 'SEK-Fahrzeuge', keys: ['sek'], texts: ['SEK-Fahrzeug', 'SEK-Fahrzeuge'], types: [79, 80], attrs: ['sek_zf', 'sek_mtf'] },
        { label: 'MEK-Fahrzeuge', keys: ['mek'], texts: ['MEK-Fahrzeug', 'MEK-Fahrzeuge'], types: [81, 82], attrs: ['mek_zf', 'mek_mtf'] },

        // THW
        { label: 'GKW', keys: ['thw_gkw'], texts: ['Gerätekraftwagen (GKW)', 'GKW'], types: [39], attrs: ['gkw'] },
        { label: 'MTW-TZ', keys: ['thw_mtwtz'], texts: ['THW-Einsatzleitung (MTW-TZ)', 'MTW-TZ'], types: [40], attrs: ['thw_mtw'] },
        { label: 'MzGW (FGr N)', keys: ['thw_mzkw'], texts: ['MzGW (FGr N)'], types: [41], attrs: ['thw_mzkw'] },
        { label: 'MzGW oder GKW', keys: [], texts: ['Fahrzeug des THW (MzKW oder GKW)'], types: [39, 41], attrs: ['gkw', 'thw_mzkw'] },
        { label: 'LKW K 9', keys: ['thw_lkw'], texts: ['LKW Kipper (LKW K 9)', 'LKW K 9'], types: [42], attrs: ['thw_lkw'] },
        { label: 'BRmG R', keys: ['thw_brmg_r'], texts: ['Radlader (BRmG R)', 'BRmG R'], types: [43], attrs: ['thw_brmg_r'] },
        { label: 'Anh DLE', keys: ['thw_dle'], texts: ['Anhänger Drucklufterzeugung', 'Anh DLE'], types: [44], attrs: ['thw_dle'] },
        { label: 'MzGW SB', keys: ['heavy_rescue'], texts: ['MzGW SB'], types: [109], attrs: [] },
        { label: 'FüKW (THW)', keys: ['thw_command'], texts: ['FüKW (THW)'], types: [144], attrs: [] },
        { label: 'FüKomKW', keys: ['thw_command_2'], texts: ['FüKomKW'], types: [145], attrs: [] },
        { label: 'Anh FüLa', keys: ['thw_command_trailer'], texts: ['Anh FüLa'], types: [146], attrs: [] },
        { label: 'FmKW', keys: ['thw_command_3'], texts: ['FmKW'], types: [147], attrs: [] },
        { label: 'MTW FGr K', keys: ['thw_command_4'], texts: ['MTW FGr K', 'MTW-FGr K'], types: [148], attrs: [] },
        { label: 'NEA50', keys: ['energy_supply'], texts: ['NEA50'], types: [110, 111, 112, 113, 175, 179], attrs: ['energy_supply'] },
        { label: 'NEA200', keys: ['energy_supply_2'], texts: ['NEA200'], types: [112, 113, 180], attrs: ['energy_supply_2'] },
        { label: 'GW TeSi', keys: ['disaster_response_technology_equipment'], texts: ['GW-TeSi', 'GW TeSi'], types: [171], attrs: [] },
        { label: 'MTW TeSi', keys: ['disaster_response_technology_crew'], texts: ['MTW-TeSi', 'MTW TeSi'], types: [173], attrs: [] },
        { label: 'Anh TeSi', keys: ['disaster_response_technology_trailer'], texts: ['Anh TeSi'], types: [174], attrs: [] },
        { label: 'MzGW (FGr BrB)', keys: ['thw_bridge_construction_equipment'], texts: ['MzGW (FGr BrB)'], types: [181], attrs: [] },
        { label: 'Mobilkran', keys: ['thw_bridge_construction_crane'], texts: ['Mobilkran', 'Mobilkräne'], types: [57, 182], attrs: [] },
        { label: 'Anh Plattform (FGr BrB)', keys: ['thw_bridge_construction_trailer'], texts: ['Anh Plattform (FGr BrB)'], types: [183], attrs: [] },

        // Bergrettung / Seenotrettung
        { label: 'Bergrettungsfahrzeug', keys: ['mountain'], texts: ['Bergrettungsfahrzeug', 'Bergrettungsfahrzeuge'], types: [149, 150, 151, 152, 158], attrs: [] },
        { label: 'GW-Bergrettung', keys: ['mountain_equipment'], texts: ['GW-Bergrettung'], types: [149, 150], attrs: [] },
        { label: 'ELW Bergrettung', keys: ['mountain_command'], texts: ['ELW Bergrettung'], types: [151], attrs: [] },
        { label: 'ATV', keys: ['mountain_atv'], texts: ['ATV'], types: [152], attrs: [] },
        { label: 'Schneefahrzeug', keys: ['mountain_snow'], texts: ['Schneefahrzeug', 'Schneefahrzeuge'], types: [154], attrs: [] },
        { label: 'Höhenrettung (Bergrettung)', keys: ['mountain_height_rescue'], texts: ['Höhenrettung (Bergrettung)'], types: [155, 158], attrs: ['mountain_height_rescue'] },
        { label: 'Hubschrauber mit Winde', keys: ['lift'], texts: ['Hubschrauber mit Winde'], types: [156, 157], attrs: ['lift'] },
        { label: 'Hubschrauber (Seenotrettung)', keys: ['coastal_helicopter'], texts: ['Hubschrauber (Seenotrettung)'], types: [161], attrs: [] },
        { label: 'Seenotrettungskreuzer', keys: ['coastal_boat_large'], texts: ['Seenotrettungskreuzer'], types: [159], attrs: [] },
        { label: 'Seenotrettungsboot', keys: [], texts: ['Seenotrettungsboot', 'Seenotrettungsboote'], types: [160], attrs: [] },
        { label: 'Seenotrettungsboot/-kreuzer', keys: ['oneof_coastal_rescue_boat_or_boat_large'], texts: ['Seenotrettungsboot oder Seenotrettungskreuzer', 'Seenotrettungsboote oder Seenotrettungskreuzer'], types: [159, 160], attrs: [] },
    ];

    // Anforderungen, die keine Fahrzeuganzahl sind – nur als Info anzeigen
    const INFO_ONLY = {
        water_needed: 'Wasserbedarf (l)',
        foam_needed: 'Sonderlöschmittelbedarf',
        min_pump_speed: 'Pumpenleistung (l/min)',
        personnel_educations: 'Ausbildungen',
    };

    const normalize = s =>
        (s || '')
            .toLowerCase()
            .replace(/[^a-z0-9äöüß]+/g, ' ')
            .trim();
    const normalizeTitle = s => normalize((s || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' '));

    const DEMAND_BY_KEY = {};
    const DEMAND_BY_TEXT = {};
    DEMANDS.forEach(d => {
        d.keys.forEach(k => (DEMAND_BY_KEY[k] = d));
        d.texts.concat(d.label).forEach(t => (DEMAND_BY_TEXT[normalize(t)] = DEMAND_BY_TEXT[normalize(t)] || d));
    });

    function getMissionType() {
        const help = document.getElementById('mission_help');
        if (!help) return null;
        let type = new URL(help.getAttribute('href') || '', location.origin).pathname.split('/')[2];
        const info = document.getElementById('mission_general_info');
        const overlay = info && info.getAttribute('data-overlay-index');
        if (overlay && overlay !== 'null') type += `-${overlay}`;
        const additive = info && info.getAttribute('data-additive-overlays');
        if (additive && additive !== 'null') type += `/${additive}`;
        return type;
    }

    function getMissionTitle() {
        const info = document.getElementById('mission_general_info');
        const title = info && info.getAttribute('data-mission-title');
        if (title) return title;
        const h1 = document.getElementById('missionH1');
        return h1 ? h1.textContent.trim() : '';
    }

    // Liest aus, welche Fahrzeuge eine AAO alarmiert: [{ typeId | attr, amount }]
    function getAaoSpecs(aao, aaoTypes) {
        const specs = [];
        for (const { name, value } of aao.attributes) {
            if (name === 'vehicle_type_ids') {
                try {
                    Object.entries(JSON.parse(value)).forEach(([id, amount]) => {
                        if (parseInt(amount) > 0) specs.push({ typeId: parseInt(id), amount: parseInt(amount) });
                    });
                } catch (e) {
                    /* kein JSON */
                }
            } else if (aaoTypes.has(name) && parseInt(value) > 0) {
                specs.push({ attr: name, amount: parseInt(value) });
            }
        }
        return specs;
    }

    const specMatches = (spec, demand) =>
        spec.typeId !== undefined ? demand.types.includes(spec.typeId) : demand.attrs.includes(spec.attr);

    function findByName(aaos, names) {
        const wanted = names.map(normalizeTitle).filter(n => n.length > 2);
        const exact = aaos.filter(a => wanted.includes(normalizeTitle(a.textContent)));
        if (exact.length) return exact;
        return aaos.filter(a => {
            const text = normalizeTitle(a.textContent);
            return text.length > 3 && wanted.some(n => n.includes(text) || text.includes(n));
        });
    }

    // Vom Spiel gemeldete fehlende Fahrzeuge (Nachalarmierung): [{ name, need }]
    function parseMissingText() {
        const box = document.getElementById('missing_text');
        if (!box || !box.offsetParent) return [];
        const blocks = box.children.length ? Array.from(box.children) : [box];
        const items = [];
        blocks.forEach(block => {
            const text = block.textContent.replace(/\s+/g, ' ').trim();
            const list = text.includes(':') ? text.slice(text.indexOf(':') + 1) : text;
            list.split(/,\s*(?=\d)/).forEach(part => {
                const match = part.trim().match(/^(\d[\d.]*)\s*(.+?)\.?$/);
                if (match) items.push({ name: match[2].trim(), need: parseInt(match[1].replace(/\./g, '')) });
            });
        });
        return items;
    }

    // Welche Fahrzeugtypen einen Einsatz einer Fahrzeuggruppe erreichen. Gruppen ohne Eintrag gelten als unbeschränkt.
    const GROUP_TYPES = {
        mountain_missions: [31, 61, 91, 92, 96, 125, 126, 127, 128, 129, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158],
        ocean_missions: [159, 160, 161],
    };

    // Rettungsdienst-Bedarf je nach Einsatzort: normale Einsätze, Bergrettung, Seenotrettung
    const MEDICAL = {
        default: {
            nef: { label: 'NEF', texts: ['NEF'], types: [29, 31, 74, 97, 157], attrs: ['nef', 'nef_only', 'naw'] },
            rth: { label: 'RTH', texts: ['RTH'], types: [31, 157], attrs: ['rth_only'] },
            transport: { label: 'RTW', texts: ['RTW'], types: [28, 74, 97], attrs: ['rtw', 'naw'] },
            transportKtw: { label: 'RTW oder KTW', texts: ['RTW', 'KTW'], types: [28, 38, 58, 74, 97], attrs: ['rtw', 'naw', 'ktw', 'ktw_b', 'ktw_or_rtw', 'ktw_or_rtw_2'] },
            lna: { label: 'LNA', texts: ['KdoW-LNA', 'LNA'], types: [55], attrs: ['kdow_lna'] },
            orgl: { label: 'OrgL', texts: ['KdoW-OrgL', 'OrgL'], types: [56], attrs: ['kdow_orgl'] },
        },
        mountain_missions: {
            nef: { label: 'Notarzt (RTH oder GW-Bergrettung NEF)', texts: ['RTH', 'GW-Bergrettung (NEF)'], types: [31, 149, 157], attrs: ['rth_only', 'nef'] },
            rth: { label: 'RTH', texts: ['RTH'], types: [31, 157], attrs: ['rth_only'] },
            transport: { label: 'Patiententransport (RTH oder Bergrettung)', texts: ['RTH', 'GW-Bergrettung'], types: [31, 149, 150, 157], attrs: ['rth_only'] },
        },
        ocean_missions: {
            transport: { label: 'Patiententransport (Seenotrettung)', texts: ['Seenotrettungsboot', 'Seenotrettungskreuzer', 'Hubschrauber (Seenotrettung)'], types: [159, 160, 161], attrs: [] },
        },
    };

    function medicalFor(mission) {
        const group = ((mission && mission.g) || []).find(g => MEDICAL[g]);
        return Object.assign({}, MEDICAL.default, group ? MEDICAL[group] : {}, group ? { transportKtw: null, restricted: true } : {});
    }

    // Beschränkt einen Bedarf auf Fahrzeuge, die den Einsatzort erreichen
    function restrictDemand(demand, mission) {
        const groups = (mission && mission.g) || [];
        if (!demand || !groups.length || !groups.every(g => GROUP_TYPES[g])) return demand;
        const allowed = groups.flatMap(g => GROUP_TYPES[g]);
        const types = demand.types.filter(t => allowed.includes(t));
        return types.length ? Object.assign({}, demand, { types }) : demand;
    }

    // Patienten, denen laut Einsatzfenster noch etwas fehlt: { nef: 1, rtw: 2, ... }
    function parsePatientNeeds() {
        const needs = {};
        document.querySelectorAll('.mission_patient .alert-danger').forEach(alert => {
            const text = alert.textContent;
            [['nef', /\bNEF\b/], ['rth', /\bRTH\b/], ['transport', /\bRTW\b/], ['lna', /\bLNA\b/], ['orgl', /\bOrgL\b/]].forEach(([key, re]) => {
                if (re.test(text)) needs[key] = (needs[key] || 0) + 1;
            });
        });
        return needs;
    }

    // Sucht pro Bedarf die AAO, die ausschließlich passende Fahrzeuge alarmiert
    function resolveDemands(demands, aaos, parsedAaos) {
        return demands.map(({ demand, label, need }) => {
            let candidates = [];
            if (demand) {
                candidates = parsedAaos
                    .filter(p => p.specs.every(s => specMatches(s, demand)))
                    .map(p => ({ aao: p.aao, amount: p.specs.reduce((sum, s) => sum + s.amount, 0) }));
            }
            // Fallback: AAO heißt genauso wie das Fahrzeug
            if (!candidates.length) {
                const names = demand ? demand.texts.concat(demand.label).map(normalize) : [normalize(label)];
                candidates = aaos
                    .filter(a => names.includes(normalize(a.textContent).replace(/^\d+ (x )?/, '')))
                    .map(aao => ({ aao, amount: 1 }));
            }
            let hits = candidates.filter(c => c.amount === need);
            if (!hits.length && candidates.length) {
                const fitting = candidates.filter(c => c.amount < need);
                const pool = fitting.length ? fitting : candidates;
                const best = fitting.length ? Math.max(...pool.map(c => c.amount)) : Math.min(...pool.map(c => c.amount));
                hits = pool.filter(c => c.amount === best);
            }
            return { label, need, hits: hits.map(h => ({ aao: h.aao, clicks: Math.ceil(need / h.amount) })) };
        });
    }

    function mark(aao, cls, badgeText) {
        aao.classList.add(cls);
        if (badgeText) {
            const badge = document.createElement('span');
            badge.className = 'lsshelper-badge';
            badge.textContent = badgeText;
            aao.prepend(badge);
        }
        const pane = aao.closest('.tab-pane');
        const tab = pane && document.querySelector(`#aao-tabs a[href="#${pane.id}"]`);
        if (tab) tab.classList.add('lsshelper-tab');
        return tab;
    }

    function openTab(tab) {
        if (tab && !tab.parentElement.classList.contains('active')) tab.click();
    }

    function addStyles() {
        if (document.getElementById('lsshelper-style')) return;
        const style = document.createElement('style');
        style.id = 'lsshelper-style';
        style.textContent = `
            /* weißer + schwarzer Ring um die Signalfarbe, damit es auf jeder AAO-Farbe auffällt */
            .lsshelper-name, .lsshelper-req { position: relative; z-index: 5; animation: lsshelper-pulse 1s ease-in-out infinite alternate; }
            .lsshelper-name { --lsshelper-color: #ff00d4; }
            .lsshelper-req { --lsshelper-color: #00e5ff; }
            @keyframes lsshelper-pulse {
                from { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000; }
                to { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000, 0 0 14px 9px var(--lsshelper-color); }
            }
            .lsshelper-badge { background: #000; color: #00e5ff; border: 1px solid #fff; border-radius: 8px; padding: 0 5px; margin-right: 4px; font-weight: bold; }
            .lsshelper-filled { box-shadow: 0 0 0 3px #ff00d4 !important; }
            .lsshelper-tab { box-shadow: inset 0 -4px 0 #ff00d4 !important; }
            #lsshelper-panel { margin: 5px 0; padding: 6px 8px; border: 1px solid #888; border-radius: 4px; font-size: 12px; }
            #lsshelper-panel span.lsshelper-item { display: inline-block; margin: 1px 8px 1px 0; white-space: nowrap; }
        `;
        document.head.append(style);
    }

    function renderPanel(container, headline, items) {
        let panel = document.getElementById('lsshelper-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'lsshelper-panel';
            container.before(panel);
        }
        panel.textContent = '';
        const head = document.createElement('b');
        head.textContent = headline;
        panel.append(head);
        if (items.length) panel.append(document.createElement('br'));
        items.forEach(text => {
            const item = document.createElement('span');
            item.className = 'lsshelper-item';
            item.textContent = text;
            panel.append(item);
        });
    }

    function markDemands(container, aaos, demands, infos, headline) {
        const aaoTypes = new Set((window.aao_types || []).map(t => t[0]));
        const parsed = aaos.map(aao => ({ aao, specs: getAaoSpecs(aao, aaoTypes) })).filter(p => p.specs.length);
        log('AAO-Inhalte', parsed);
        // Eine AAO kann mehrere Bedarfe decken – dann zählt die höchste Klickzahl
        const clicksByAao = new Map();
        const items = resolveDemands(demands, aaos, parsed).map(r => {
            r.hits.forEach(h => clicksByAao.set(h.aao, Math.max(h.clicks, clicksByAao.get(h.aao) || 0)));
            return `${r.hits.length ? '✓' : '✗'} ${r.need}× ${r.label}`;
        });
        let firstTab = null;
        clicksByAao.forEach((clicks, aao) => {
            const tab = mark(aao, 'lsshelper-req', `${clicks}×`);
            firstTab = firstTab || tab;
        });
        openTab(firstTab);
        renderPanel(container, headline, items.concat(infos));
    }

    async function aaoHighlight() {
        const container = document.getElementById('mission-aao-group');
        if (!container) return;
        const aaos = Array.from(container.querySelectorAll('a.aao'));
        if (!aaos.length) return;
        addStyles();

        const type = getMissionType();
        const title = getMissionTitle();
        const missing = parseMissingText();
        const patientNeeds = parsePatientNeeds();
        const isFollowUp = missing.length || Object.keys(patientNeeds).length;
        const showName = byName => {
            openTab(byName.map(a => mark(a, 'lsshelper-name'))[0]);
            renderPanel(container, `LSS Helper: AAO „${byName[0].textContent.trim()}“ passt zum Einsatz.`, []);
        };

        // 1) AAO mit dem Namen des Einsatzes (ohne Einsatzdaten, sofort)
        if (!isFollowUp) {
            const byName = findByName(aaos, [title]);
            if (byName.length) return showName(byName);
        }

        const missions = type ? await getMissions() : {};
        const mission = type ? missions[type] || missions[type.split(/[-/]/)[0]] : null;
        const medical = medicalFor(mission);
        log('Einsatz', type, title, mission);
        const demands = [];
        const infos = [];

        // 2) Nachalarmierung: das Spiel nennt die fehlenden Fahrzeuge direkt
        if (isFollowUp) {
            const medicalByName = { nef: medical.nef, rth: medical.rth, rtw: medical.transport, 'kdow lna': medical.lna, lna: medical.lna, 'kdow orgl': medical.orgl, orgl: medical.orgl };
            missing.forEach(({ name, need }) => {
                const key = normalize(name);
                const demand = medicalByName[key] || restrictDemand(DEMAND_BY_TEXT[key], mission);
                if (demand || !/^(l\b|liter|feuerwehr|polizist|thw-einsatz|rettungsdienst|personen|l\/min)/i.test(name)) {
                    demands.push({ demand, label: demand && medicalByName[key] ? demand.label : name, need });
                } else {
                    infos.push(`ℹ ${need} ${name}`);
                }
            });
            Object.entries(patientNeeds).forEach(([key, need]) => {
                if (medical[key]) demands.push({ demand: medical[key], label: medical[key].label, need });
            });
            markDemands(container, aaos, demands, infos, 'LSS Helper: Nachalarmierung – fehlende Fahrzeuge (Zahl an der AAO = so oft klicken):');
            return;
        }

        if (!mission) {
            renderPanel(container, 'LSS Helper: Keine passende AAO und keine Einsatzdaten gefunden.', []);
            return;
        }
        const byName = findByName(aaos, [mission.n]);
        if (byName.length) return showName(byName);

        // 3) Fahrzeuganforderungen des Einsatztyps
        const needs = missionDemands(mission, document.querySelectorAll('.mission_patient').length);
        markDemands(container, aaos, needs.demands, needs.infos, 'LSS Helper: Keine AAO mit Einsatznamen – benötigte Fahrzeuge (Zahl an der AAO = so oft klicken):');

        const create = document.createElement('a');
        create.className = 'btn btn-xs btn-primary';
        create.href = `/aaos/new?${AAO_PARAM}=${encodeURIComponent(type)}`;
        create.target = '_blank';
        create.textContent = `AAO „${mission.n}“ anlegen`;
        create.addEventListener('mousedown', () => saveCategoryStyles(container));
        document.getElementById('lsshelper-panel').append(document.createElement('br'), create);
    }

    // Kompletter Bedarf eines Einsatztyps, beschränkt auf Fahrzeuge, die dort hinkommen
    function missionDemands(mission, patientCount) {
        const medical = medicalFor(mission);
        const demands = [];
        const infos = [];
        Object.entries(mission.r).forEach(([key, need]) => {
            const demand = restrictDemand(DEMAND_BY_KEY[key], mission);
            if (demand && typeof need === 'number' && need > 0) demands.push({ demand, label: demand.label, need, chance: 100 });
            else infos.push(`ℹ ${INFO_ONLY[key] || key}: ${typeof need === 'object' ? JSON.stringify(need) : need}`);
        });
        if (mission.p) {
            const [max, min, nef, rth, transport, ktw] = mission.p;
            const patients = patientCount || min || 1;
            const transportDemand = (ktw && medical.transportKtw) || medical.transport;
            if (transport && transportDemand) demands.push({ demand: transportDemand, label: `${transportDemand.label} (${transport} %)`, need: patients, chance: transport });
            if (nef && medical.nef) demands.push({ demand: medical.nef, label: `${medical.nef.label} (${nef} %)`, need: 1, chance: nef });
            if (rth && medical.rth) demands.push({ demand: medical.rth, label: `${medical.rth.label} (${rth} %)`, need: 1, chance: rth });
            infos.push(`ℹ Patienten: ${min && min !== max ? `${min}–${max}` : max}`);
            if (medical.restricted) infos.push('ℹ Nur Spezialfahrzeuge/Hubschrauber erreichen diesen Einsatzort');
        }
        return { demands, infos };
    }

    /* ------------------------------------------------------------------ *
     * Feature: AAO für einen Einsatz vorausfüllen (/aaos/new)
     * ------------------------------------------------------------------ */

    const AAO_PARAM = 'lsshelper_mission';
    // Rettungsdienst erst ab dieser Wahrscheinlichkeit in die AAO aufnehmen
    const AAO_MIN_CHANCE = 50;

    // Einsatzkategorie -> Stichworte, nach denen in den eigenen AAO-Kategorien gesucht wird
    const CATEGORY_WORDS = {
        mountain: /berg/,
        coastal: /see|küste|kueste/,
        water_rescue: /wasser|dlrg/,
        animal_rescue: /tier/,
        factory_fire_brigade: /werk/,
        airport: /flug/,
        airport_specialization: /flug/,
        highway_police: /autobahn/,
        riot_police: /bereitschaft|bepo/,
        criminal_investigation: /krimi|kripo/,
        police: /pol/,
        thw: /thw/,
        energy_supply: /thw|strom|nea/,
        energy_supply_2: /thw|strom|nea/,
        seg: /seg/,
        seg_medical_service: /seg|san/,
        ambulance: /rett|rd\b/,
        fire: /feuer|brand|\bfw\b/,
    };

    const STYLES_KEY = 'lsshelper_aao_styles';

    const toHex = rgb => {
        const parts = (rgb.match(/\d+/g) || []).slice(0, 3);
        return parts.length === 3 ? `#${parts.map(p => parseInt(p).toString(16).padStart(2, '0')).join('')}` : '';
    };

    // Merkt sich pro AAO-Kategorie die dort am häufigsten verwendete Farbe (aus den AAOs im Einsatzfenster)
    function saveCategoryStyles(container) {
        const styles = {};
        container.querySelectorAll('.tab-pane[id^="aao_category_"]').forEach(pane => {
            const counts = {};
            pane.querySelectorAll('a.aao').forEach(aao => {
                const computed = getComputedStyle(aao);
                const btnClass = (aao.className.match(/\bbtn-(default|primary|success|info|warning|danger)\b/) || [''])[0];
                const key = [toHex(computed.backgroundColor), toHex(computed.color), btnClass].join('|');
                counts[key] = (counts[key] || 0) + 1;
            });
            const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
            if (best) styles[pane.id.replace('aao_category_', '')] = best.split('|');
        });
        try {
            localStorage.setItem(STYLES_KEY, JSON.stringify(styles));
        } catch (e) {
            log('Farben konnten nicht gespeichert werden', e);
        }
    }

    // Trägt die Farbe der Kategorie in die Farbfelder des AAO-Formulars ein
    function applyCategoryStyle(form, categoryId, setValue) {
        let style;
        try {
            style = (JSON.parse(localStorage.getItem(STYLES_KEY) || '{}') || {})[categoryId];
        } catch (e) {
            /* kaputter Eintrag */
        }
        const fields = Array.from(form.querySelectorAll('input[name*="color"], select[name*="color"]'));
        if (!style || !fields.length) return false;
        const [background, text, btnClass] = style;
        fields.forEach(field => {
            const isText = /text|font|schrift/.test(field.name);
            if (field.tagName === 'SELECT') {
                const option = Array.from(field.options).find(o => btnClass && (o.value === btnClass || o.value === btnClass.replace('btn-', '')));
                if (option) setValue(field, option.value);
            } else {
                setValue(field, isText ? text : background);
            }
        });
        return true;
    }

    function labelOf(input) {
        const label = (input.id && document.querySelector(`label[for="${input.id}"]`)) || input.closest('label') || (input.closest('.form-group, .input-group, tr, div') || document).querySelector('label');
        return label ? label.textContent : '';
    }

    // Sucht das Formularfeld für einen Bedarf: AAO-Feld, Fahrzeugtyp-ID oder Beschriftung
    function findAaoField(form, demand) {
        for (const attr of demand.attrs) {
            const input = form.querySelector(`input[name="aao[${attr}]"]`);
            if (input) return input;
        }
        const inputs = Array.from(form.querySelectorAll('input[type="number"], input[type="text"]')).filter(i => i.name !== 'aao[caption]');
        const byType = inputs.find(i => {
            const id = (i.name.match(/\[(\d+)\]$/) || [])[1];
            return id !== undefined && demand.types.includes(parseInt(id));
        });
        if (byType) return byType;
        const names = demand.texts.concat(demand.label).map(normalize);
        return inputs.find(i => names.includes(normalize(labelOf(i))));
    }

    async function aaoCreate() {
        const type = new URLSearchParams(location.search).get(AAO_PARAM);
        const caption = document.querySelector('input[name="aao[caption]"]');
        if (!type || !caption) return;
        const form = caption.form;
        const missions = await getMissions();
        const mission = missions[type] || missions[type.split(/[-/]/)[0]];
        if (!mission) return;
        addStyles();

        const setValue = (input, value) => {
            input.value = value;
            input.classList.add('lsshelper-filled');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setValue(caption, mission.n);

        const amounts = new Map();
        const items = [];
        missionDemands(mission, 0).demands.forEach(({ demand, label, need, chance }) => {
            if (chance < AAO_MIN_CHANCE) return items.push(`– ${need}× ${label} (zu selten, nicht eingetragen)`);
            const input = findAaoField(form, demand);
            if (!input) return items.push(`✗ ${need}× ${label} (kein Feld gefunden – bitte von Hand)`);
            // Mehrere Bedarfe im selben Feld (z. B. RTH für Notarzt und Transport): der größte zählt
            amounts.set(input, Math.max(need, amounts.get(input) || 0));
            items.push(`✓ ${need}× ${label}`);
        });
        amounts.forEach((need, input) => setValue(input, need));

        const category = form.querySelector('select[name="aao[aao_category_id]"]');
        if (category) {
            const options = Array.from(category.options);
            const key = Object.keys(CATEGORY_WORDS).find(k => mission.c.includes(k) && options.some(o => CATEGORY_WORDS[k].test(o.textContent.toLowerCase())));
            if (key) {
                const option = options.find(o => CATEGORY_WORDS[key].test(o.textContent.toLowerCase()));
                setValue(category, option.value);
                items.push(`✓ Kategorie: ${option.textContent.trim()}`);
                items.push(applyCategoryStyle(form, option.value, setValue) ? '✓ Farben aus der Kategorie übernommen' : '✗ Farben: keine für diese Kategorie gefunden – bitte von Hand wählen');
            } else {
                items.push('✗ Kategorie: keine passende gefunden – bitte von Hand wählen');
            }
        }

        const panel = document.createElement('div');
        panel.id = 'lsshelper-panel';
        panel.className = 'alert alert-info';
        const head = document.createElement('b');
        head.textContent = `LSS Helper: AAO für „${mission.n}“ vorausgefüllt – bitte prüfen und selbst speichern.`;
        panel.append(head);
        items.forEach(text => {
            const item = document.createElement('div');
            item.textContent = text;
            panel.append(item);
        });
        form.before(panel);
    }

    /* ------------------------------------------------------------------ *
     * Feature-Register: neue Features hier eintragen
     * ------------------------------------------------------------------ */

    const FEATURES = [
        // Einsatzdaten im Hauptfenster vorladen, damit Einsatzfenster nicht warten müssen
        { name: 'preloadMissions', match: /^\/$/, run: getMissions },
        { name: 'aaoHighlight', match: /^\/missions\/\d+/, run: aaoHighlight },
        { name: 'aaoCreate', match: /^\/aaos\/new\/?$/, run: aaoCreate },
    ];

    window.LSSHelper = { features: Object.fromEntries(FEATURES.map(f => [f.name, f.run])), getMissions };

    FEATURES.filter(f => f.match.test(location.pathname)).forEach(f => {
        try {
            Promise.resolve(f.run()).catch(e => console.error(`[LSS Helper] ${f.name}`, e));
        } catch (e) {
            console.error(`[LSS Helper] ${f.name}`, e);
        }
    });
})();
