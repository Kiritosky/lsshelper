// ==UserScript==
// @name         LSS Helper
// @namespace    lsshelper
// @version      0.16.0
// @description  Helfer für das Leitstellenspiel: markiert passende AAOs, legt AAOs an, prüft sie und passt die Fahrzeugbesatzung einer Wache ans Personal an.
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
     * Kern: Einstellungen (⚙ in der Helfer-Leiste)
     * ------------------------------------------------------------------ */

    const SETTINGS_KEY = 'lsshelper_settings';
    const DEFAULTS = {
        markName: true,
        markVehicles: true,
        subtractPresent: true,
        countForeign: true,
        showList: true,
        openTab: true,
        createButton: true,
        auditButton: true,
        crewButton: true,
        pulse: true,
        colorName: '#ff00d4',
        colorVehicles: '#00e5ff',
        minChance: 50,
    };
    const SETTINGS_LABELS = {
        markName: 'AAO mit Einsatznamen markieren',
        markVehicles: 'Fahrzeug-AAOs markieren',
        subtractPresent: 'Bereits alarmierte und angehakte Fahrzeuge abziehen',
        countForeign: 'Dabei Fahrzeuge anderer Spieler mitzählen',
        showList: 'Fahrzeugliste in der Leiste anzeigen',
        openTab: 'AAO-Tab automatisch öffnen',
        createButton: 'Button „AAO anlegen“ anzeigen',
        auditButton: 'Button „AAOs prüfen“ anzeigen',
        crewButton: 'Knöpfe für das Wachen-Dashboard anzeigen',
        pulse: 'Markierung pulsieren lassen',
        colorName: 'Farbe Namens-Treffer',
        colorVehicles: 'Farbe Fahrzeug-AAOs',
        minChance: 'Rettungsdienst in neue AAO ab Wahrscheinlichkeit (%)',
    };
    const settings = Object.assign({}, DEFAULTS);
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
        Object.keys(DEFAULTS).forEach(key => {
            if (typeof saved[key] === typeof DEFAULTS[key]) settings[key] = saved[key];
        });
    } catch (e) {
        /* kaputte Einstellungen -> Standard */
    }

    function toggleSettings(panel) {
        const open = document.getElementById('lsshelper-settings');
        if (open) return open.remove();
        const box = document.createElement('div');
        box.id = 'lsshelper-settings';
        Object.keys(DEFAULTS).forEach(key => {
            const row = document.createElement('label');
            const input = document.createElement('input');
            input.dataset.key = key;
            input.type = typeof DEFAULTS[key] === 'boolean' ? 'checkbox' : typeof DEFAULTS[key] === 'number' ? 'number' : 'color';
            if (input.type === 'checkbox') input.checked = settings[key];
            else input.value = settings[key];
            row.append(input, ` ${SETTINGS_LABELS[key]}`);
            box.append(row);
        });
        const button = (text, cls, onClick) => {
            const btn = document.createElement('a');
            btn.href = '#';
            btn.className = `btn btn-xs ${cls}`;
            btn.textContent = text;
            btn.addEventListener('click', e => {
                e.preventDefault();
                onClick();
                location.reload();
            });
            return btn;
        };
        box.append(
            button('Speichern', 'btn-success', () => {
                const values = {};
                box.querySelectorAll('input').forEach(input => {
                    values[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
                });
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
            }),
            ' ',
            button('Standard wiederherstellen', 'btn-default', () => localStorage.removeItem(SETTINGS_KEY))
        );
        panel.after(box);
    }

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

    const STOP_WORDS = new Set(['in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'mit', 'von', 'vom', 'zu', 'zur', 'zum', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'und', 'nach', 'durch', 'unter', 'über']);

    const isSubsequence = (short, long) => {
        let i = 0;
        for (const ch of long) if (ch === short[i]) i++;
        return i === short.length;
    };

    // Bewertet, ob eine AAO eine Abkürzung des Einsatznamens ist ("Person in BM EING" = "Person in Baumaschine eingeklemmt").
    // Jedes Kürzel muss der Reihe nach ein Wort (Anfang oder Buchstabenfolge) oder die Anfangsbuchstaben mehrerer Wörter treffen.
    // Rückgabe: -1 = passt nicht, sonst je höher desto näher am Original.
    function abbrevScore(tokens, words, i = 0, j = 0) {
        if (i === tokens.length) return words.slice(j).every(w => STOP_WORDS.has(w)) ? 0 : -1;
        if (j === words.length) return -1;
        const token = tokens[i];
        const word = words[j];
        let best = -1;
        const take = (rest, points) => {
            if (rest >= 0) best = Math.max(best, rest + points);
        };
        if (STOP_WORDS.has(word)) take(abbrevScore(tokens, words, i, j + 1), 0);
        if (token.endsWith('*')) {
            if (flexFits(token, word)) take(abbrevScore(tokens, words, i + 1, j + 1), 2);
            return best;
        }
        if (token === word) take(abbrevScore(tokens, words, i + 1, j + 1), 3);
        else if (word.startsWith(token)) take(abbrevScore(tokens, words, i + 1, j + 1), 2);
        else if (token[0] === word[0] && isSubsequence(token, word)) take(abbrevScore(tokens, words, i + 1, j + 1), 1);
        for (let k = 2; k <= token.length && j + k <= words.length; k++) {
            if (words.slice(j, j + k).map(w => w[0]).join('') === token) take(abbrevScore(tokens, words, i + 1, j + k), 1);
        }
        return best;
    }

    // Kürzel mit Endungs-Platzhalter: "gebrochener*" (aus "Gebrochener(s)") passt auf "gebrochener" und "gebrochenes"
    function flexFits(token, word) {
        const base = token.slice(0, -1);
        let common = 0;
        while (common < base.length && base[common] === word[common]) common++;
        return common >= Math.max(3, base.length - 2) && Math.abs(word.length - base.length) <= 2;
    }

    // Zerlegt einen AAO-Namen in alle Lesarten: "Gebrochener(s) Arm/ Bein [1]" -> "gebrochener* arm", "gebrochener* bein"
    function nameVariants(text) {
        const clean = text
            .replace(/\[[^\]]*\]/g, ' ')
            .replace(/(\S)\([^)\s]{1,3}\)/g, '$1*')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\s*\/\s*/g, '/')
            .toLowerCase();
        const toTokens = s => s.replace(/[^a-z0-9äöüß*]+/g, ' ').trim().split(' ').filter(Boolean);
        const variants = new Map();
        const add = tokens => tokens.length && variants.set(tokens.join(' '), tokens);
        // "Arm/Bein": jedes Wort mit Schrägstrich ist eine Auswahl
        let combos = [[]];
        clean.split(/\s+/).filter(Boolean).forEach(part => {
            const options = part.split('/').map(toTokens).filter(o => o.length);
            if (options.length) combos = combos.flatMap(c => options.map(o => c.concat(o))).slice(0, 16);
        });
        combos.forEach(add);
        // "Name A / Name B": ganze Namen als Auswahl
        const whole = clean.split('/').map(toTokens);
        if (whole.length > 1 && whole.every(t => t.length >= 2)) whole.forEach(add);
        return Array.from(variants.values());
    }

    // Wie gut passt eine der Lesarten auf den Einsatznamen? -1 = gar nicht, 1000 = wörtlich
    function nameScore(variants, words) {
        // Mindestens ein Kürzel muss ein klarer Wortanfang sein, sonst passt z. B. "VU" auf "Vergiftung"
        const isStrong = t => {
            const base = t.replace('*', '');
            return base.length >= 3 && words.some(w => (t.endsWith('*') ? flexFits(t, w) : w.startsWith(base)));
        };
        let best = -1;
        variants.forEach(tokens => {
            if (tokens.join(' ') === words.join(' ')) best = 1000;
            else if (tokens.some(isStrong)) best = Math.max(best, abbrevScore(tokens, words));
        });
        return best;
    }

    function findByName(aaos, names) {
        const wanted = names.map(normalizeTitle).filter(n => n.length > 2);
        const wantedWords = wanted.map(n => n.split(' '));
        // Wörtliche oder abgekürzte AAO-Namen: nur die besten Treffer
        const scored = aaos
            .map(aao => {
                const variants = nameVariants(aao.textContent);
                return { aao, score: Math.max(-1, ...wantedWords.map(words => nameScore(variants, words))) };
            })
            .filter(s => s.score >= 0);
        if (scored.length) {
            const top = Math.max(...scored.map(s => s.score));
            return scored.filter(s => s.score === top).map(s => s.aao);
        }
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
        return demands.map(({ demand, label, need, present }) => {
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
                    .map(aao => {
                        const text = normalizeTitle(aao.textContent);
                        const count = text.match(/^(\d+)\s*x?\s+(.+)$/) || text.match(/^()(.+?)\s+x?\s*\d+$/);
                        return { aao, name: count ? count[2] : text, amount: count && count[1] ? parseInt(count[1]) : 1 };
                    })
                    .filter(c => c.amount > 0 && names.includes(c.name));
            }
            // Fahrzeug-AAOs ohne Kategorie (oben im Fenster) gehen vor: sonst gewinnt z. B. eine Einsatz-AAO
            // aus einem Tab, die zufällig genau 3 RTW alarmiert, gegen die eigentliche "RTW"-AAO
            const uncategorized = candidates.filter(c => !c.aao.closest('.tab-pane'));
            if (uncategorized.length) candidates = uncategorized;
            let hits = candidates.filter(c => c.amount === need);
            if (!hits.length && candidates.length) {
                const fitting = candidates.filter(c => c.amount < need);
                const pool = fitting.length ? fitting : candidates;
                const best = fitting.length ? Math.max(...pool.map(c => c.amount)) : Math.min(...pool.map(c => c.amount));
                hits = pool.filter(c => c.amount === best);
            }
            return { label, need, present, hits: hits.map(h => ({ aao: h.aao, clicks: Math.ceil(need / h.amount) })) };
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
        if (allowTabSwitch && settings.openTab && tab && !tab.parentElement.classList.contains('active')) tab.click();
    }

    function addStyles() {
        if (document.getElementById('lsshelper-style')) return;
        const style = document.createElement('style');
        style.id = 'lsshelper-style';
        style.textContent = `
            /* weißer + schwarzer Ring um die Signalfarbe, damit es auf jeder AAO-Farbe auffällt */
            .lsshelper-name, .lsshelper-req { position: relative; z-index: 5; box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000; ${settings.pulse ? 'animation: lsshelper-pulse 1s ease-in-out infinite alternate;' : ''} }
            .lsshelper-name { --lsshelper-color: ${settings.colorName}; }
            .lsshelper-req { --lsshelper-color: ${settings.colorVehicles}; }
            #lsshelper-dash-backdrop { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; background: rgba(0, 0, 0, 0.55); display: flex; align-items: flex-start; justify-content: center; padding: 4vh 16px; overflow-y: auto; }
            #lsshelper-dash { --bg: #f3f4f7; --card: #ffffff; --text: #1c1f24; --muted: #6b7280; --line: #e1e4ea; --accent: #c62828; --ok: #2e7d32; --warn: #b26a00; --bad: #c62828; width: 100%; max-width: 960px; background: var(--bg); color: var(--text); border-radius: 12px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5); font-size: 13px; line-height: 1.45; text-align: left; }
            #lsshelper-dash.lsshelper-dark { --bg: #15171c; --card: #1f2229; --text: #e8eaed; --muted: #9aa3af; --line: #323742; --accent: #e5484d; --ok: #4caf7a; --warn: #f0b24a; --bad: #ff6b6b; }
            .lsshelper-dash-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
            .lsshelper-dash-title { flex: 1; font-size: 17px; font-weight: 700; color: var(--text); }
            .lsshelper-dash-title small { display: block; font-size: 11px; font-weight: 400; color: var(--muted); }
            .lsshelper-dash-status { padding: 8px 16px; color: var(--muted); border-bottom: 1px solid var(--line); }
            .lsshelper-dash-body { padding: 12px 16px 16px; display: grid; gap: 12px; }
            .lsshelper-dash-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 0 12px 10px; }
            .lsshelper-dash-card-head { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
            .lsshelper-dash-card-title { font-size: 14px; font-weight: 700; color: var(--text); }
            .lsshelper-dash-count { margin-right: auto; min-width: 22px; padding: 1px 7px; border-radius: 11px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; text-align: center; }
            .lsshelper-dash-count-ok { background: var(--ok); }
            .lsshelper-dash-count-warn { background: var(--warn); }
            .lsshelper-dash-station { margin: 8px 0 2px; font-weight: 700; color: var(--text); }
            .lsshelper-dash-station small { margin-left: 8px; font-weight: 400; color: var(--muted); }
            #lsshelper-dash label.lsshelper-dash-row { display: flex; align-items: baseline; gap: 8px; margin: 0; padding: 3px 6px; border-radius: 6px; font-weight: 400; color: var(--text); cursor: pointer; }
            #lsshelper-dash label.lsshelper-dash-row:hover { background: var(--bg); }
            #lsshelper-dash label.lsshelper-dash-row input { margin: 0; }
            #lsshelper-dash label.lsshelper-dash-done { color: var(--ok); text-decoration: line-through; }
            #lsshelper-dash .lsshelper-dash-failed { color: var(--bad); }
            .lsshelper-dash-empty, .lsshelper-dash-note { padding: 3px 6px; color: var(--muted); }
            .lsshelper-dash-note { color: var(--text); }
            #lsshelper-dash a.lsshelper-btn { display: inline-block; padding: 4px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--text); font-size: 12px; text-decoration: none; white-space: nowrap; cursor: pointer; }
            #lsshelper-dash a.lsshelper-btn:hover { border-color: var(--muted); }
            #lsshelper-dash a.lsshelper-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
            #lsshelper-dash a.lsshelper-btn-quiet { border-color: transparent; background: transparent; color: var(--muted); }
            #lsshelper-dash a.lsshelper-btn-busy { opacity: 0.5; cursor: wait; }
            .lsshelper-dash-floating { position: fixed; left: 6px; bottom: 6px; z-index: 99999; }
            #lsshelper-settings { margin: 5px 0; padding: 6px 8px; border: 1px solid #888; border-radius: 4px; font-size: 12px; }
            #lsshelper-settings label { display: block; font-weight: normal; margin: 2px 0; }
            #lsshelper-settings input[type="number"] { width: 60px; color: #000; }
            @keyframes lsshelper-pulse {
                from { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000; }
                to { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000, 0 0 14px 9px var(--lsshelper-color); }
            }
            .lsshelper-badge { background: #000; color: ${settings.colorVehicles}; border: 1px solid #fff; border-radius: 8px; padding: 0 5px; margin-right: 4px; font-weight: bold; }
            .lsshelper-filled { box-shadow: 0 0 0 3px #ff00d4 !important; }
            .lsshelper-tab { box-shadow: inset 0 -4px 0 ${settings.colorName} !important; }
            #lsshelper-panel { margin: 5px 0; padding: 6px 8px; border: 1px solid #888; border-radius: 4px; font-size: 12px; }
            #lsshelper-report { margin: 5px 0; padding: 6px 8px; border: 1px solid #888; border-radius: 4px; font-size: 12px; max-height: 300px; overflow-y: auto; }
            .lsshelper-report-row { padding: 2px 0; border-top: 1px solid rgba(128, 128, 128, 0.3); }
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
        if (!settings.showList) items = items.filter(text => !/^[✓✗●]/.test(text) || /^✗/.test(text));
        if (items.length) panel.append(document.createElement('br'));
        items.forEach(text => {
            const item = document.createElement('span');
            item.className = 'lsshelper-item';
            item.textContent = text;
            panel.append(item);
        });
        const buttons = document.createElement('span');
        buttons.className = 'pull-right';
        const button = (text, title, onClick) => {
            const btn = document.createElement('a');
            btn.className = 'btn btn-xs btn-default';
            btn.href = '#';
            btn.textContent = text;
            btn.title = title;
            btn.addEventListener('click', e => {
                e.preventDefault();
                onClick();
            });
            buttons.append(btn, ' ');
        };
        if (settings.auditButton) button('AAOs prüfen', 'Alle AAOs gegen die Spieldaten abgleichen', () => aaoAudit().catch(err => console.error('[LSS Helper] aaoAudit', err)));
        button('⚙', 'LSS Helper Einstellungen', () => toggleSettings(panel));
        panel.prepend(buttons);
    }

    function markDemands(container, aaos, demands, infos, headline) {
        const aaoTypes = new Set((window.aao_types || []).map(t => t[0]));
        const parsed = aaos.map(aao => ({ aao, specs: getAaoSpecs(aao, aaoTypes) })).filter(p => p.specs.length);
        log('AAO-Inhalte', parsed);
        // Eine AAO kann mehrere Bedarfe decken – dann zählt die höchste Klickzahl
        const clicksByAao = new Map();
        const open = demands.filter(d => d.need > 0);
        const items = resolveDemands(open, aaos, parsed).map(r => {
            r.hits.forEach(h => clicksByAao.set(h.aao, Math.max(h.clicks, clicksByAao.get(h.aao) || 0)));
            return `${r.hits.length ? '✓' : '✗'} ${r.need}× ${r.label}${r.present ? ` (${r.present} schon alarmiert/angehakt)` : ''}`;
        });
        demands.filter(d => d.need <= 0).forEach(d => items.push(`● ${d.label}: schon alarmiert/angehakt`));
        let firstTab = null;
        if (settings.markVehicles) {
            clicksByAao.forEach((clicks, aao) => {
                const tab = mark(aao, 'lsshelper-req', `${clicks}×`);
                firstTab = firstTab || tab;
            });
        }
        openTab(firstTab);
        if (demands.length && !open.length) headline = 'LSS Helper: Alles Nötige ist bereits alarmiert oder angehakt.';
        renderPanel(container, headline, items.concat(infos));
    }

    // Fahrzeugtypen, die schon auf Anfahrt bzw. vor Ort sind oder in der Fahrzeugliste angehakt wurden
    function presentVehicles() {
        const ownId = String(window.user_id);
        const isForeign = row => {
            const owner = row.querySelector('a[href^="/profile/"]');
            return !!owner && owner.getAttribute('href').split('/')[2] !== ownId;
        };
        const types = (selector, skipForeign) =>
            Array.from(document.querySelectorAll(selector))
                .filter(row => !(skipForeign && isForeign(row)))
                .map(row => {
                    const el = row.matches('[vehicle_type_id]') ? row : row.querySelector('[vehicle_type_id]');
                    return el ? parseInt(el.getAttribute('vehicle_type_id')) : NaN;
                })
                .filter(type => !isNaN(type));
        return {
            driving: types('#mission_vehicle_driving tbody tr', !settings.countForeign),
            atScene: types('#mission_vehicle_at_mission tbody tr', !settings.countForeign),
            selected: types('#vehicle_show_table_body_all .vehicle_checkbox:checked, #occupied .vehicle_checkbox:checked', false),
        };
    }

    // Zieht bereits alarmierte und angehakte Fahrzeuge vom Bedarf ab. scope 'all' = Anfahrt + vor Ort, 'driving' = nur Anfahrt
    // (was das Spiel als fehlend meldet, berücksichtigt die Fahrzeuge vor Ort schon selbst).
    function applyPresent(demands, present, defaultScope) {
        if (!settings.subtractPresent) return;
        demands.forEach(d => {
            if (!d.demand) return;
            const pool = present.selected.concat(present.driving, (d.scope || defaultScope) === 'all' ? present.atScene : []);
            const have = Math.min(d.need, pool.filter(type => d.demand.types.includes(type)).length);
            d.present = have;
            d.need -= have;
        });
    }

    // Tab nur beim ersten Durchlauf wechseln, nicht bei jeder Aktualisierung
    let allowTabSwitch = true;
    let liveSignature = null;

    function clearMarks() {
        document.querySelectorAll('.lsshelper-badge').forEach(badge => badge.remove());
        document.querySelectorAll('.lsshelper-name, .lsshelper-req, .lsshelper-tab').forEach(el => el.classList.remove('lsshelper-name', 'lsshelper-req', 'lsshelper-tab'));
    }

    // Einsatzfenster: einmal markieren, danach bei jeder Änderung der Fahrzeugauswahl neu rechnen
    async function aaoHighlightLive() {
        await aaoHighlight();
        allowTabSwitch = false;
        if (!settings.subtractPresent || !document.getElementById('mission-aao-group')) return;
        const signature = () => presentVehicles().selected.sort().join(',');
        liveSignature = signature();
        const refresh = () => {
            const current = signature();
            if (current === liveSignature) return;
            liveSignature = current;
            clearMarks();
            aaoHighlight().catch(e => console.error('[LSS Helper] aaoHighlight', e));
        };
        const schedule = e => {
            if (!e.target.closest || !e.target.closest('a.aao, a.vehicle_group, .vehicle_checkbox, #vehicle_show_table_all, #occupied')) return;
            // AAOs wählen ihre Fahrzeuge teils verzögert aus
            [250, 1200].forEach(delay => setTimeout(refresh, delay));
        };
        document.addEventListener('click', schedule);
        document.addEventListener('change', schedule);
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
        const present = presentVehicles();
        // Einsatz wurde schon bearbeitet: nicht noch einmal die ganze AAO vorschlagen, nur den Rest
        const dispatched = settings.subtractPresent && present.driving.length + present.atScene.length + present.selected.length > 0;
        const showName = byName => {
            openTab(byName.map(a => mark(a, 'lsshelper-name'))[0]);
            renderPanel(container, `LSS Helper: AAO „${byName[0].textContent.trim()}“ passt zum Einsatz.`, []);
        };

        // 0) Übergabeort: Patienten warten auf den Rettungsdienst – RTW pro Patient, NEF wo gefordert
        const patientCount = document.querySelectorAll('.mission_patient').length;
        if (/übergabe/i.test(title) || (!type && patientCount && !missing.length)) {
            const medical = MEDICAL.default;
            const demands = [];
            const transport = Object.assign({}, medical.transport, { attrs: ['rtw', 'naw', 'ktw_or_rtw', 'ktw_or_rtw_2'] });
            if (patientCount) demands.push({ demand: transport, label: 'RTW (1 pro Patient)', need: patientCount, scope: 'all' });
            ['nef', 'rth', 'lna', 'orgl'].forEach(key => {
                if (patientNeeds[key]) demands.push({ demand: medical[key], label: medical[key].label, need: patientNeeds[key] });
            });
            // Bei mehr als 5 bzw. 10 Patienten verlangt das Spiel LNA bzw. OrgL
            if (patientCount >= 5 && !patientNeeds.lna) demands.push({ demand: medical.lna, label: 'LNA (ab 5 Patienten)', need: 1, scope: 'all' });
            if (patientCount >= 10 && !patientNeeds.orgl) demands.push({ demand: medical.orgl, label: 'OrgL (ab 10 Patienten)', need: 1, scope: 'all' });
            applyPresent(demands, present, 'driving');
            const infos = patientCount ? [`ℹ Patienten: ${patientCount}`] : ['ℹ Keine Patienten im Einsatzfenster erkannt'];
            markDemands(container, aaos, demands, infos, 'LSS Helper: Übergabeort – benötigter Rettungsdienst (Zahl an der AAO = so oft klicken):');
            return;
        }

        // 1) AAO mit dem Namen des Einsatzes (ohne Einsatzdaten, sofort)
        if (settings.markName && !isFollowUp && !dispatched) {
            const byName = findByName(aaos, [title]);
            if (byName.length) return showName(byName);
        }

        const missions = type ? await getMissions() : {};
        const mission = type ? missions[type] || missions[type.split(/[-/]/)[0]] : null;
        const medical = medicalFor(mission);
        log('Einsatz', type, title, mission, present);
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
            applyPresent(demands, present, 'driving');
            markDemands(container, aaos, demands, infos, 'LSS Helper: Nachalarmierung – fehlende Fahrzeuge (Zahl an der AAO = so oft klicken):');
            return;
        }

        if (!mission) {
            renderPanel(container, 'LSS Helper: Keine passende AAO und keine Einsatzdaten gefunden.', []);
            return;
        }
        const byName = findByName(aaos, [title, mission.n]);
        if (settings.markName && !dispatched && byName.length) return showName(byName);

        // 3) Fahrzeuganforderungen des Einsatztyps
        const needs = missionDemands(mission, patientCount);
        applyPresent(needs.demands, present, 'all');
        const headline = dispatched
            ? 'LSS Helper: Noch benötigte Fahrzeuge – alarmierte und angehakte sind abgezogen (Zahl an der AAO = so oft klicken):'
            : byName.length
              ? 'LSS Helper: Benötigte Fahrzeuge (Zahl an der AAO = so oft klicken):'
              : 'LSS Helper: Keine AAO mit Einsatznamen – benötigte Fahrzeuge (Zahl an der AAO = so oft klicken):';
        markDemands(container, aaos, needs.demands, needs.infos, headline);

        if (settings.createButton && !byName.length) {
            const create = document.createElement('a');
            create.className = 'btn btn-xs btn-primary';
            create.href = `/aaos/new?${AAO_PARAM}=${encodeURIComponent(type)}`;
            create.target = '_blank';
            create.textContent = `AAO „${mission.n}“ anlegen`;
            // Einsatzdaten gleich mitgeben, damit das Formular nicht erst die ganze Einsatzliste laden muss
            create.addEventListener('mousedown', () => {
                saveCategoryStyles(container);
                try {
                    localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, mission }));
                } catch (e) {
                    log('Entwurf konnte nicht gespeichert werden', e);
                }
            });
            // Per Skript öffnen, damit sich der Tab nach dem Speichern selbst schließen darf;
            // danach lädt dieses Einsatzfenster neu und markiert die neue AAO
            create.addEventListener('click', e => {
                if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
                e.preventDefault();
                window.addEventListener('storage', event => {
                    if (event.key === SAVED_KEY && event.newValue) location.reload();
                });
                window.open(create.href, AAO_WINDOW);
            });
            document.getElementById('lsshelper-panel').append(document.createElement('br'), create);
        }
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
            if (transport && transportDemand) demands.push({ demand: transportDemand, label: `${transportDemand.label} (${transport} %)`, need: patients, chance: transport, medical: true });
            if (nef && medical.nef) demands.push({ demand: medical.nef, label: `${medical.nef.label} (${nef} %)`, need: 1, chance: nef, medical: true });
            if (rth && medical.rth) demands.push({ demand: medical.rth, label: `${medical.rth.label} (${rth} %)`, need: 1, chance: rth, medical: true });
            infos.push(`ℹ Patienten: ${min && min !== max ? `${min}–${max}` : max}`);
            if (medical.restricted) infos.push('ℹ Nur Spezialfahrzeuge/Hubschrauber erreichen diesen Einsatzort');
        }
        return { demands, infos };
    }

    /* ------------------------------------------------------------------ *
     * Feature: AAO-Prüfung – bestehende AAOs gegen die Spieldaten abgleichen
     * ------------------------------------------------------------------ */

    // AAO-Felder, die Mengen statt Fahrzeuge angeben
    const AMOUNT_ATTRS = /amount|value/;

    // Einsatzname -> Einsatz mit der Maximalanforderung aller gleichnamigen Varianten
    function missionsByName(missions) {
        if (shared.byName) return shared.byName;
        const byName = new Map();
        Object.values(missions).forEach(m => {
            const key = normalize(m.n);
            const merged = byName.get(key);
            if (!merged) {
                byName.set(key, { n: m.n, r: Object.assign({}, m.r), p: m.p && m.p.slice(), g: m.g, c: m.c, words: normalizeTitle(m.n).split(' ') });
                return;
            }
            Object.entries(m.r).forEach(([k, v]) => {
                if (typeof v === 'number') merged.r[k] = Math.max(merged.r[k] || 0, v);
            });
            if (m.p) merged.p = merged.p ? merged.p.map((v, i) => Math.max(v, m.p[i])) : m.p.slice();
        });
        return (shared.byName = byName);
    }

    // Ordnet eine AAO über ihren (ggf. abgekürzten) Namen ihren Einsätzen zu; "Arm/Bein" ergibt zwei
    function missionsForAao(text, byName) {
        const found = new Set();
        let ambiguous = false;
        nameVariants(text).forEach(tokens => {
            const exact = byName.get(tokens.join(' '));
            if (exact) return found.add(exact);
            let top = -1;
            let hits = [];
            byName.forEach(mission => {
                const score = nameScore([tokens], mission.words);
                if (score > top) {
                    top = score;
                    hits = [mission];
                } else if (score === top && score >= 0) {
                    hits.push(mission);
                }
            });
            if (top < 0) return;
            // Gleichnamige Einsätze mit Klammerzusatz zählen als einer
            if (hits.every(h => h.words.join(' ') === hits[0].words.join(' '))) found.add(hits[0]);
            else ambiguous = true;
        });
        return { missions: Array.from(found), ambiguous };
    }

    function checkAao(aao, mission, aaoTypes) {
        const text = aao.textContent.trim();
        const specs = getAaoSpecs(aao, new Set(aaoTypes.keys())).filter(s => s.attr === undefined || !AMOUNT_ATTRS.test(s.attr));
        const demands = missionDemands(mission, 0).demands;
        const issues = [];
        const have = d => specs.filter(s => specMatches(s, d.demand)).reduce((sum, s) => sum + s.amount, 0);

        demands.filter(d => !d.medical).forEach(d => {
            if (have(d) < d.need) issues.push(`fehlt: ${d.need - have(d)}× ${d.label}`);
        });
        const excess = new Set();
        specs.forEach(spec => {
            const matched = demands.filter(d => specMatches(spec, d.demand));
            if (!matched.length) {
                issues.push(`nicht benötigt: ${spec.amount}× ${spec.attr !== undefined ? aaoTypes.get(spec.attr) : `Fahrzeugtyp #${spec.typeId}`}`);
            } else if (matched.length === 1 && !matched[0].medical && have(matched[0]) > matched[0].need) {
                excess.add(matched[0]);
            }
        });
        excess.forEach(d => issues.push(`evtl. zu viel: ${have(d) - d.need}× ${d.label}`));

        const bracket = text.match(/\[(\d+)(?:\/\d+)?\]/);
        if (bracket && mission.p && parseInt(bracket[1]) !== mission.p[0]) issues.push(`Klammer [${bracket[1]}…] – laut Spieldaten bis zu ${mission.p[0]} Patienten`);
        return issues;
    }

    async function aaoAudit() {
        const container = document.getElementById('mission-aao-group');
        if (!container) return;
        const aaoTypes = new Map(window.aao_types || []);
        const byName = missionsByName(await getMissions());
        const stats = { ok: 0, bad: 0, ambiguous: 0, unmatched: 0 };

        let report = document.getElementById('lsshelper-report');
        if (!report) {
            report = document.createElement('div');
            report.id = 'lsshelper-report';
            document.getElementById('lsshelper-panel').after(report);
        }
        report.textContent = '';
        const rows = document.createElement('div');

        container.querySelectorAll('a.aao').forEach(aao => {
            const text = aao.textContent.trim();
            const { missions, ambiguous } = missionsForAao(text, byName);
            if (!missions.length) return ambiguous ? stats.ambiguous++ : stats.unmatched++;
            const problems = missions.map(mission => ({ mission, issues: checkAao(aao, mission, aaoTypes) })).filter(p => p.issues.length);
            if (!problems.length) return stats.ok++;
            stats.bad++;
            const row = document.createElement('div');
            row.className = 'lsshelper-report-row';
            const name = document.createElement('b');
            name.textContent = text;
            row.append(name, ...problems.map(p => ` → ${p.mission.n}: ${p.issues.join(' · ')} `));
            const id = aao.getAttribute('aao_id');
            if (id) {
                const edit = document.createElement('a');
                edit.href = `/aaos/${id}/edit`;
                edit.target = '_blank';
                edit.textContent = 'bearbeiten';
                row.append(edit);
            }
            rows.append(row);
        });

        const head = document.createElement('b');
        head.textContent = `AAO-Prüfung: ${stats.bad} mit Abweichungen, ${stats.ok} in Ordnung, ${stats.ambiguous} mehrdeutig, ${stats.unmatched} keinem Einsatz zugeordnet (z. B. Fahrzeug-AAOs). Verglichen wird mit der größten Variante des Einsatzes; Rettungsdienst zählt nicht als fehlend.`;
        report.append(head, rows);
    }

    /* ------------------------------------------------------------------ *
     * Feature: AAO für einen Einsatz vorausfüllen (/aaos/new)
     * ------------------------------------------------------------------ */

    const AAO_PARAM = 'lsshelper_mission';
    const DRAFT_KEY = 'lsshelper_aao_draft';
    // Der Formular-Tab trägt diesen Fensternamen; so erkennt das Skript ihn nach dem Speichern wieder
    const AAO_WINDOW = 'lsshelper_aao';
    const SUBMIT_KEY = 'lsshelper_aao_submitted';
    const SAVED_KEY = 'lsshelper_aao_saved';

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
                // Das Spiel erwartet den Farbcode ohne "#"; nur echte Farbwähler brauchen es
                const color = isText ? text : background;
                setValue(field, field.type === 'color' ? color : color.replace('#', ''));
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
        let mission = null;
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (draft && draft.type === type) mission = draft.mission;
        } catch (e) {
            /* kaputter Entwurf */
        }
        if (!mission) {
            const missions = await getMissions();
            mission = missions[type] || missions[type.split(/[-/]/)[0]];
        }
        if (!mission) return;
        addStyles();
        form.addEventListener('submit', () => sessionStorage.setItem(SUBMIT_KEY, '1'));

        const setValue = (input, value) => {
            input.value = value;
            input.classList.add('lsshelper-filled');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        // Namensschema: "Einsatzname [max. Patienten/davon evtl. mit Notarzt]", ohne Notarzt nur "[max. Patienten]"
        setValue(caption, mission.p ? `${mission.n} [${mission.p[0]}${mission.p[2] ? `/${mission.p[0]}` : ''}]` : mission.n);

        const amounts = new Map();
        const items = [];
        missionDemands(mission, 0).demands.forEach(({ demand, label, need, chance }) => {
            if (chance < settings.minChance) return items.push(`– ${need}× ${label} (zu selten, nicht eingetragen)`);
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

    // Läuft im Formular-Tab auf der Seite nach dem Speichern: Einsatzfenster benachrichtigen und Tab schließen
    function aaoSaved() {
        if (window.name !== AAO_WINDOW || !sessionStorage.getItem(SUBMIT_KEY)) return;
        // Formular ist noch offen (z. B. Eingabefehler) – nichts tun
        if (document.querySelector('input[name="aao[caption]"]')) return;
        sessionStorage.removeItem(SUBMIT_KEY);
        localStorage.setItem(SAVED_KEY, String(Date.now()));
        window.close();
    }

    /* ------------------------------------------------------------------ *
     * Feature: Wachen-Dashboard – Sitzlimits, Lehrgangspersonal und Namen für alle Wachen
     * ------------------------------------------------------------------ */

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Fahrzeugtyp -> Besatzung [min, max] (Index = Typ-ID)
    const STAFF = '1-9,1-9,1-3,1-3,1-3,1-3,1-9,1-9,1-9,1-9,1-3,1-3,1-3,1-3,1-6,1-3,1-3,1-3,1-3,1-3,1-3,1-3,1-6,1-3,1-3,1-3,1-3,1-3,1-2,1-2,1-9,1-2,1-2,1-9,1-6,1-3,1-9,1-6,1-2,1-9,1-4,1-9,1-3,0-0,0-0,1-6,1-3,0-0,0-0,0-0,1-9,1-3,1-2,1-6,0-0,1-1,1-1,1-2,1-2,1-2,6-6,1-3,0-0,2-2,1-6,1-2,0-0,0-0,0-0,1-2,0-0,0-0,5-5,6-6,3-3,2-3,2-2,0-0,0-0,3-4,9-9,3-4,9-9,1-9,1-3,1-3,1-3,1-3,1-6,1-6,1-9,4-5,0-0,4-5,1-2,1-1,0-0,3-3,1-2,,1-7,0-0,0-0,1-2,1-6,1-6,1-6,1-9,0-0,1-9,0-0,0-0,0-0,0-0,1-2,0-0,0-0,0-0,1-3,0-0,1-3,1-3,1-3,1-3,1-7,4-4,4-5,4-4,4-5,4-6,3-3,1-9,0-0,3-3,2-4,2-2,0-0,1-6,3-6,3-3,6-6,0-0,0-0,0-0,1-4,1-7,0-0,1-7,4-4,3-6,3-6,1-3,1-1,4-5,1-1,0-0,1-3,1-2,4-4,4-9,1-2,3-4,1-3,1-9,0-0,5-5,1-2,1-2,0-0,0-0,0-0,1-5,2-6,1-7,0-0,0-0,3-3,5-5,0-0,0-0,0-0,6-9,1-1,0-0,2-2,2-6,0-0'
        .split(',')
        .map(range => (range ? range.split('-').map(Number) : null));

    // Fahrzeugtyp -> Lehrgang -> so viele Ausgebildete braucht das Fahrzeug (0 zählt als 1).
    // Die übrigen Plätze darf Personal ohne Lehrgang besetzen – ein ELW 2 fährt mit 6 Leuten, wenn einer den Lehrgang hat.
    // prettier-ignore
    const TRAINING = {12:{gw_messtechnik:0},27:{gw_gefahrgut:0},29:{notarzt:0},31:{notarzt:0},33:{gw_hoehenrettung:0},34:{elw2:0},35:{police_einsatzleiter:0},40:{thw_zugtrupp:0},42:{thw_raumen:0},45:{thw_raumen:0},46:{wechsellader:0},51:{police_fukw:0},54:{dekon_p:0},55:{lna:0},56:{orgl:0},57:{fwk:0},59:{seg_elw:0},60:{seg_gw_san:0},61:{polizeihubschrauber:0},63:{gw_taucher:0},64:{gw_wasserrettung:0},66:{gw_wasserrettung:0},67:{gw_wasserrettung:0},68:{gw_wasserrettung:0},69:{gw_taucher:0},70:{gw_wasserrettung:0},71:{gw_wasserrettung:0},72:{police_wasserwerfer:0},73:{notarzt:1},74:{notarzt:1},75:{arff:0},76:{rettungstreppe:0},77:{gw_gefahrgut:0},78:{elw2:0},79:{police_sek:0},80:{police_sek:0},81:{police_mek:0},82:{police_mek:0},83:{werkfeuerwehr:0},84:{werkfeuerwehr:0},85:{werkfeuerwehr:0},86:{werkfeuerwehr:0},91:{seg_rescue_dogs:0},92:{thw_rescue_dogs:0},94:{k9:0},95:{police_motorcycle:0},96:{police_firefighting:0},97:{intensive_care:2,notarzt:1},98:{criminal_investigation:0},100:{water_damage_pump:0},101:{water_damage_pump:1},102:{water_damage_pump:1},103:{police_service_group_leader:1},109:{heavy_rescue:0},112:{thw_energy_supply:1},113:{energy_supply:1},125:{thw_drone:0},126:{fire_drone:4},127:{seg_drone:0},128:{fire_drone:0},129:{fire_drone:0,elw2:0},130:{care_service:1,care_service_equipment:2},131:{care_service:0},133:{care_service:1,care_service_equipment:2},134:{police_horse:2},138:{fire_care_service:1,care_service_equipment:2},139:{fire_care_service:1,care_service_equipment:2},140:{fire_care_service:0},144:{thw_command:0},145:{thw_command:0},147:{thw_command:0},148:{thw_command:0},149:{notarzt:1},151:{mountain_command:0},153:{seg_rescue_dogs:0},155:{mountain_height_rescue:4},156:{polizeihubschrauber:1,police_helicopter_lift:1},157:{rescue_helicopter_lift:1,notarzt:1},158:{mountain_height_rescue:0},159:{coastal_rescue:0},161:{coastal_helicopter:1,coastal_helicopter_lift:1,emergency_paramedic_water_rescue:1},162:{railway_fire:0},163:{railway_fire:0},165:{police_speaker_operator:0},171:{disaster_response_technology:0},172:{disaster_response_technology:1},173:{disaster_response_technology:1},174:{disaster_response_technology:2},175:{disaster_response_technology:2},176:{thw_care_service:1,care_service_equipment:2},177:{thw_care_service:0},180:{energy_supply:1},181:{thw_bridge_construction:0},182:{thw_bridge_construction_crane:0},183:{thw_bridge_construction:6},184:{highway_police:0}};

    // Gebäudetyp -> Kürzel im Wachennamen ("Ballrechten FW 1"); nur für Namensvorschläge neuer Wachen
    const BUILDING_CODES = { 0: 'FW', 2: 'RW', 4: 'KH', 5: 'RTH', 6: 'PW', 18: 'FW', 19: 'PW', 20: 'RW', 25: 'BW' };

    const fetchJson = async url => (await fetch(url, { credentials: 'same-origin' })).json();
    const fetchDoc = async url => new DOMParser().parseFromString(await (await fetch(url, { credentials: 'same-origin' })).text(), 'text/html');

    // "Ballrechten FW 1" -> { place: 'Ballrechten', code: 'FW', nr: '1' }; "THW Eschbach GP" -> Eschbach / THW / 1
    function parseStation(caption) {
        let match = caption.match(/^(.+) ([A-ZÄÖÜ]{2,4}) (\d+)$/);
        if (match) return { place: match[1], code: match[2], nr: match[3] };
        match = caption.match(/^THW (.+?)(?: GP)?$/);
        if (match && !/Schule/.test(caption)) return { place: match[1], code: 'THW', nr: '1' };
        return null;
    }

    // Personal einer Wache: [{ id, name, edu: Set(Lehrgangs-Schlüssel), bound: Name des gebundenen Fahrzeugs }]
    async function loadPersonnel(buildingId) {
        const doc = await fetchDoc(`/buildings/${buildingId}/personals`);
        return Array.from(doc.querySelectorAll('#personal_table tbody tr'))
            .filter(row => row.children.length > 3)
            .map(row => {
                let keys = [];
                try {
                    keys = JSON.parse(row.getAttribute('data-filterable-by') || '[]');
                } catch (e) {
                    /* ohne Lehrgänge weiter */
                }
                const box = row.querySelector('input[type="checkbox"]');
                return { id: box ? box.value : null, name: row.children[1].textContent.trim(), edu: new Set(keys), bound: row.children[3].textContent.trim() };
            });
    }

    // Plant Sitzlimits und Lehrgangspersonal einer Wache.
    // Jedes Fahrzeug mit Lehrgang bekommt zuerst seine Ausgebildeten (v.trained), die restlichen Sitze füllt beliebiges Personal.
    // Fehlen die Ausgebildeten, gilt das Fahrzeug als nicht besetzbar und nimmt den anderen kein Personal weg.
    function planCrew(vehicles, persons) {
        persons.forEach(p => (p.used = false));
        // n freie Personen mit allen Lehrgängen: erst schon an dieses Fahrzeug Gebundene, dann Freie, dann anderswo Gebundene;
        // wenig Ausgebildete zuerst, damit Spezialisten frei bleiben
        const pick = (n, keys, vehicle, taken, maxRank = 2) => {
            const rank = p => (p.bound === vehicle.caption ? 0 : p.bound ? 2 : 1);
            const pool = persons
                .filter(p => !p.used && !taken.includes(p) && rank(p) <= maxRank && keys.every(key => p.edu.has(key)))
                .sort((a, b) => rank(a) - rank(b) || a.edu.size - b.edu.size);
            return pool.length >= n ? pool.slice(0, n) : null;
        };
        vehicles.forEach(v => {
            v.all = [];
            v.partial = Object.entries(TRAINING[v.type] || {}).map(([key, n]) => [key, n || 1]);
            v.next = v.min;
            v.staffed = false;
            v.trained = [];
        });
        // Mindestbesatzung: erst Fahrzeuge, bei denen alle ausgebildet sein müssen, dann die mit einzelnen Pflichtplätzen, dann der Rest
        const order = v => (v.all.length ? 0 : v.partial.length ? 1 : 2);
        vehicles
            .slice()
            .sort((a, b) => order(a) - order(b))
            .forEach(v => {
                const crew = [];
                const add = (n, keys) => {
                    const found = n > 0 ? pick(n, keys, v, crew) : [];
                    if (found) crew.push(...found);
                    return !!found;
                };
                if (!v.partial.every(([key, n]) => add(n, v.all.concat(key)))) return;
                const specialists = crew.slice();
                if (!add(Math.max(0, v.min - crew.length), v.all) || crew.length > v.max) return;
                crew.forEach(p => (p.used = true));
                v.staffed = true;
                v.next = Math.max(v.min, crew.length);
                v.trained = v.all.length ? crew.slice() : specialists;
            });
        // Rest reihum verteilen: erst nur eigene und freie Leute, damit bestehende Bindungen bleiben,
        // danach dürfen auch an andere Fahrzeuge Gebundene umziehen
        [1, 2].forEach(maxRank => {
            let progress = true;
            while (progress) {
                progress = false;
                vehicles.forEach(v => {
                    if (!v.staffed || v.next >= v.max) return;
                    const extra = pick(1, v.all, v, [], maxRank);
                    if (!extra) return;
                    extra[0].used = true;
                    v.next++;
                    if (v.all.length) v.trained.push(extra[0]);
                    progress = true;
                });
            }
        });
        return persons.filter(p => !p.used).length;
    }

    // Vorschläge nach dem Schema "Typ Ort WachenNr/lfd. Nr" für Fahrzeuge, die noch nicht so heißen
    function planNames(stations) {
        const suffixOf = station => ` ${station.parsed.place} ${station.parsed.nr}/`;
        const matches = (vehicle, station) => {
            const at = vehicle.caption.lastIndexOf(suffixOf(station));
            return at > 0 && /^\d+$/.test(vehicle.caption.slice(at + suffixOf(station).length)) ? at : -1;
        };
        // Typbezeichnung aus bereits richtig benannten Fahrzeugen lernen ("LF 20 Ballrechten 1/1" -> Typ 0 = "LF 20")
        const labels = {};
        stations.filter(s => s.parsed).forEach(s => s.vehicles.forEach(v => {
            const at = matches(v, s);
            if (at > 0 && !labels[v.type]) labels[v.type] = v.caption.slice(0, at);
        }));
        const changes = [];
        stations.filter(s => s.parsed).forEach(station => {
            const highest = {};
            station.vehicles.forEach(v => {
                const at = matches(v, station);
                if (at < 0) return;
                const label = v.caption.slice(0, at);
                highest[label] = Math.max(highest[label] || 0, parseInt(v.caption.slice(at + suffixOf(station).length)));
            });
            station.vehicles.forEach(v => {
                if (matches(v, station) > 0) return;
                // Unbenannte Fahrzeuge heißen wie ihr Typ; umgesetzte tragen noch den alten Wachenzusatz
                const label = v.typeCaption || labels[v.type] || (/\d+\/\d+$/.test(v.caption) ? null : v.caption);
                if (!label) return;
                highest[label] = (highest[label] || 0) + 1;
                changes.push({ kind: 'name', station, vehicle: v, caption: `${label}${suffixOf(station)}${highest[label]}`, text: `„${v.caption}“ → „${label}${suffixOf(station)}${highest[label]}“` });
            });
        });
        return changes;
    }

    // Namensvorschlag für Wachen, die nicht ins Schema passen: Ort der nächstgelegenen Wache, nächste freie Nummer
    function planBuildingNames(buildings) {
        const named = buildings.filter(b => parseStation(b.caption));
        const changes = [];
        buildings.forEach(building => {
            const code = BUILDING_CODES[building.building_type];
            if (!code || parseStation(building.caption) || !named.length) return;
            const distance = other => Math.hypot(other.latitude - building.latitude, other.longitude - building.longitude);
            const place = parseStation(named.slice().sort((a, b) => distance(a) - distance(b))[0].caption).place;
            const used = named.map(b => parseStation(b.caption)).filter(p => p.place === place && p.code === code).map(p => parseInt(p.nr));
            const caption = `${place} ${code} ${Math.max(0, ...used) + 1}`;
            changes.push({ kind: 'building', building, caption, text: `Wache „${building.caption}“ → „${caption}“ (Ort von der nächsten Wache übernommen)`, optional: true });
        });
        return changes;
    }

    // Sendet ein Bearbeiten-Formular des Spiels mit geänderten Feldern ab; alle anderen Felder bleiben, wie sie sind
    async function submitEditForm(url, pickField, changes) {
        const doc = await fetchDoc(url);
        const form = Array.from(doc.querySelectorAll('form')).find(pickField);
        if (!form) throw new Error('Formular nicht gefunden');
        const body = new URLSearchParams();
        Array.from(form.elements).forEach(el => {
            if (!el.name || el.disabled || ['submit', 'button', 'file', 'reset'].includes(el.type)) return;
            if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
            // Auswahlfelder ohne Einträge (z. B. Besatzung bei Abrollbehältern) schickt auch der Browser nicht mit;
            // ein leerer Wert würde vom Spiel als ungültig abgelehnt
            if (el.tagName === 'SELECT' && !el.selectedOptions.length) return;
            let value = el.value;
            if (Object.prototype.hasOwnProperty.call(changes, el.name)) {
                value = String(changes[el.name]);
                if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === value)) throw new Error(`Wert ${value} ist nicht erlaubt`);
            }
            body.append(el.name, value);
        });
        const response = await fetch(form.getAttribute('action'), { method: 'POST', body, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Lehnt das Spiel die Eingabe ab, zeigt es das Formular mit Fehlermeldung erneut an, statt weiterzuleiten
        if (!response.redirected) {
            const error = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('.alert-danger, .alert-error, .has-error .help-inline');
            if (error) throw new Error(error.textContent.replace(/×/g, '').replace(/\s+/g, ' ').trim());
        }
    }

    const APPLY = {
        limit: change => submitEditForm(`/vehicles/${change.vehicle.id}/edit`, f => f.querySelector('[name="vehicle[personal_max]"]'), { 'vehicle[personal_max]': change.vehicle.next }),
        name: change => submitEditForm(`/vehicles/${change.vehicle.id}/edit`, f => f.querySelector('[name="vehicle[caption]"]'), { 'vehicle[caption]': change.caption }),
        building: async change => {
            const isName = el => el.type === 'text' && /^building\[/.test(el.name) && el.value === change.building.caption;
            const doc = await fetchDoc(`/buildings/${change.building.id}/edit`);
            const field = Array.from(doc.querySelectorAll('form input')).find(isName);
            if (!field) throw new Error('Namensfeld nicht gefunden');
            return submitEditForm(`/buildings/${change.building.id}/edit`, f => Array.from(f.elements).some(isName), { [field.name]: change.caption });
        },
        // Zuweisen und Lösen ist im Spiel derselbe Umschalter – deshalb vorher den aktuellen Stand prüfen
        assign: change => toggleBinding(change, true),
    };

    async function toggleBinding(change, shouldBeBound) {
        const doc = await fetchDoc(`/vehicles/${change.vehicle.id}/zuweisung`);
        const button = doc.querySelector(`#personal_${change.person.id} a.btn`);
        if (!button) throw new Error('Person nicht in der Zuweisungsliste');
        if (button.classList.contains('btn-assigned') === shouldBeBound) return;
        const token = document.querySelector('meta[name="csrf-token"]');
        const response = await fetch(button.getAttribute('href'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token ? token.content : '', 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }

    // Liest alle Wachen und berechnet die Vorschläge: [{ kind, station, text, ... }]
    async function planFleet(onlyBuildingId, onProgress) {
        const [buildings, allVehicles] = await Promise.all([fetchJson('/api/buildings'), fetchJson('/api/vehicles')]);
        const stations = buildings
            .map(building => ({
                building,
                parsed: parseStation(building.caption),
                vehicles: allVehicles
                    .filter(v => v.building_id === building.id)
                    .map(v => {
                        const staff = STAFF[v.vehicle_type] || [0, 0];
                        return { id: v.id, caption: v.caption, type: v.vehicle_type, typeCaption: v.vehicle_type_caption, min: staff[0], max: staff[1], current: v.max_personnel_override === null ? staff[1] : v.max_personnel_override };
                    }),
            }))
            .filter(s => s.vehicles.length && (!onlyBuildingId || String(s.building.id) === String(onlyBuildingId)));

        const changes = [];
        for (const [index, station] of stations.entries()) {
            onProgress(`Lese Personal … ${index + 1}/${stations.length} (${station.building.caption})`);
            const persons = await loadPersonnel(station.building.id).catch(() => []);
            const crewed = station.vehicles.filter(v => v.max > 0);
            station.personnel = persons.length;
            station.seats = crewed.reduce((sum, v) => sum + v.max, 0);
            if (!persons.length) {
                station.note = station.building.personal_count ? 'Personalliste nicht lesbar – übersprungen' : 'kein Personal';
                continue;
            }
            station.left = planCrew(crewed, persons);
            const duplicate = caption => station.vehicles.filter(v => v.caption === caption).length > 1;
            crewed.forEach(v => {
                const needs = v.all.length || v.partial.length;
                if (v.staffed && v.next !== v.current) {
                    changes.push({ kind: 'limit', station, vehicle: v, text: `${v.caption}: Sitzlimit ${v.current} → ${v.next}` });
                }
                if (needs && !v.staffed) {
                    changes.push({ kind: 'info', station, text: `✗ ${v.caption}: zu wenig Personal mit Lehrgang (${v.all.concat(v.partial.map(p => p[0])).join(', ')})` });
                }
                // Gleichnamige Fahrzeuge lassen sich in der Personalliste nicht unterscheiden
                if (!needs || !v.staffed || duplicate(v.caption)) return;
                const bound = persons.filter(p => p.bound === v.caption);
                v.trained.filter(p => !bound.includes(p) && p.id).forEach(person => {
                    changes.push({ kind: 'assign', station, vehicle: v, person, text: `${person.name} → ${v.caption}${person.bound ? ` (bisher ${person.bound})` : ''}` });
                });
            });
            await sleep(100);
        }
        if (!onlyBuildingId) changes.push(...planBuildingNames(buildings));
        changes.push(...planNames(stations));
        return { stations, changes };
    }

    const DASH_GROUPS = [
        { title: 'Sitzlimits', kinds: ['limit'], button: 'Sitzlimits übernehmen' },
        { title: 'Lehrgangspersonal', kinds: ['assign'], button: 'Lehrgangspersonal zuweisen' },
        { title: 'Namen', kinds: ['name', 'building'], button: 'Namen übernehmen' },
    ];

    const THEME_KEY = 'lsshelper_dash_theme';

    async function openDashboard(onlyBuildingId) {
        addStyles();
        document.querySelectorAll('#lsshelper-dash-backdrop').forEach(node => node.remove());
        const el = (tag, cls, text) => {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (text) node.textContent = text;
            return node;
        };
        const button = (text, cls, onClick) => {
            const btn = el('a', `lsshelper-btn ${cls || ''}`, text);
            btn.href = '#';
            btn.addEventListener('click', e => {
                e.preventDefault();
                onClick(btn);
            });
            return btn;
        };

        const backdrop = el('div');
        backdrop.id = 'lsshelper-dash-backdrop';
        const dash = el('div');
        dash.id = 'lsshelper-dash';
        backdrop.append(dash);
        const closeDash = () => {
            backdrop.remove();
            document.removeEventListener('keydown', onKey);
        };
        const onKey = e => e.key === 'Escape' && closeDash();
        document.addEventListener('keydown', onKey);
        backdrop.addEventListener('click', e => e.target === backdrop && closeDash());

        // Hell/Dunkel: ohne eigene Wahl richtet sich das Dashboard nach dem Spiel bzw. dem System
        const autoDark = document.body.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const theme = button('', '', () => {
            localStorage.setItem(THEME_KEY, dash.classList.contains('lsshelper-dark') ? 'light' : 'dark');
            applyTheme();
        });
        const applyTheme = () => {
            const saved = localStorage.getItem(THEME_KEY);
            const dark = saved ? saved === 'dark' : autoDark;
            dash.classList.toggle('lsshelper-dark', dark);
            theme.textContent = dark ? '☀ Hell' : '☾ Dunkel';
        };
        applyTheme();

        const head = el('div', 'lsshelper-dash-head');
        const title = el('div', 'lsshelper-dash-title', 'Wachen-Dashboard');
        title.append(el('small', '', onlyBuildingId ? 'LSS Helper · diese Wache' : 'LSS Helper · alle Wachen'));
        head.append(title, theme, button('✕', '', closeDash));
        const status = el('div', 'lsshelper-dash-status', 'Lese Wachen und Fahrzeuge …');
        const body = el('div', 'lsshelper-dash-body');
        dash.append(head, status, body);
        document.body.append(backdrop);

        let plan;
        try {
            plan = await planFleet(onlyBuildingId, text => (status.textContent = text));
        } catch (err) {
            console.error('[LSS Helper] dashboard', err);
            status.textContent = `Fehler: ${err.message}`;
            status.classList.add('lsshelper-dash-failed');
            return;
        }
        const actionable = plan.changes.filter(c => c.kind !== 'info');
        const ready = `${plan.stations.length} Wachen geprüft · ${actionable.length} Vorschläge · nichts wird geändert, bevor du „übernehmen“ drückst.`;
        status.textContent = ready;

        // Eine Karte pro Gruppe: Vorschläge je Wache, jeder einzeln abwählbar
        DASH_GROUPS.forEach(group => {
            const items = plan.changes.filter(c => group.kinds.includes(c.kind));
            const card = el('div', 'lsshelper-dash-card');
            const cardHead = el('div', 'lsshelper-dash-card-head');
            cardHead.append(el('span', 'lsshelper-dash-card-title', group.title), el('span', `lsshelper-dash-count${items.length ? '' : ' lsshelper-dash-count-ok'}`, items.length ? String(items.length) : '✓'));
            card.append(cardHead);
            body.append(card);
            if (!items.length) {
                card.append(el('div', 'lsshelper-dash-empty', 'Alles in Ordnung.'));
                return;
            }

            const byStation = new Map();
            items.forEach(c => {
                const key = c.station ? c.station.building.caption : 'Wachen';
                byStation.set(key, (byStation.get(key) || []).concat(c));
            });
            byStation.forEach((list, caption) => {
                const station = list[0].station;
                const stationHead = el('div', 'lsshelper-dash-station', caption);
                if (station) stationHead.append(el('small', '', `Personal ${station.personnel} · Sitzplätze ${station.seats}`));
                card.append(stationHead);
                list.forEach(change => {
                    const row = el('label', 'lsshelper-dash-row');
                    change.box = el('input');
                    change.box.type = 'checkbox';
                    change.box.checked = !change.optional;
                    row.append(change.box, el('span', '', change.text));
                    change.row = row;
                    card.append(row);
                });
            });

            const toggle = button('alle an/aus', 'lsshelper-btn-quiet', () => {
                const open = items.filter(c => !c.done);
                const allOn = open.every(c => c.box.checked);
                open.forEach(c => (c.box.checked = !allOn));
            });
            const apply = button(group.button, 'lsshelper-btn-primary', async btn => {
                const todo = items.filter(c => c.box.checked && !c.done);
                if (!todo.length || btn.dataset.busy) return;
                btn.dataset.busy = '1';
                btn.classList.add('lsshelper-btn-busy');
                let failed = 0;
                for (const [index, change] of todo.entries()) {
                    status.textContent = `${group.title}: ${index + 1}/${todo.length} …`;
                    try {
                        await APPLY[change.kind](change);
                        change.done = true;
                        change.box.disabled = true;
                        change.row.classList.add('lsshelper-dash-done');
                    } catch (err) {
                        failed++;
                        change.row.append(el('em', '', ` – ${err.message}`));
                        change.row.classList.add('lsshelper-dash-failed');
                    }
                    await sleep(250);
                }
                delete btn.dataset.busy;
                btn.classList.remove('lsshelper-btn-busy');
                status.textContent = `${group.title}: ${todo.length - failed} übernommen${failed ? `, ${failed} fehlgeschlagen` : ''}. Zum Neuberechnen das Dashboard erneut öffnen.`;
            });
            cardHead.append(toggle, apply);
        });

        // Hinweise: nur, was du selbst beheben musst (fehlende Lehrgänge, unlesbare Personalliste)
        const infos = plan.changes.filter(c => c.kind === 'info').map(c => `${c.station.building.caption}: ${c.text}`);
        const notes = plan.stations.filter(s => s.note && s.note !== 'kein Personal').map(s => `${s.building.caption}: ${s.note}`);
        if (infos.length || notes.length) {
            const card = el('div', 'lsshelper-dash-card');
            const cardHead = el('div', 'lsshelper-dash-card-head');
            cardHead.append(el('span', 'lsshelper-dash-card-title', 'Hinweise'), el('span', 'lsshelper-dash-count lsshelper-dash-count-warn', String(infos.length + notes.length)));
            card.append(cardHead);
            infos.concat(notes).forEach(text => card.append(el('div', 'lsshelper-dash-note', text)));
            body.append(card);
        }
    }

    // Zum Öffnen: Eintrag im Profilmenü der Hauptseite (alle Wachen) und Knopf auf jeder Wache (nur diese)
    function dashboardButton() {
        if (!settings.crewButton || document.getElementById('lsshelper-dash-open')) return;
        const table = document.getElementById('vehicle_table');
        const buildingId = (location.pathname.match(/^\/buildings\/(\d+)\/?$/) || [])[1];
        if (buildingId && !table) return;
        // Im Einsatz- oder Gebäudefenster (iframe) keinen globalen Knopf anzeigen
        if (!buildingId && window.top !== window) return;
        addStyles();
        const open = document.createElement('a');
        open.id = 'lsshelper-dash-open';
        open.href = '#';
        open.className = 'btn btn-xs btn-default';
        open.textContent = buildingId ? 'LSS Helper: diese Wache prüfen' : 'LSS Helper';
        open.addEventListener('click', e => {
            e.preventDefault();
            openDashboard(buildingId);
        });
        if (buildingId) return table.before(open);
        // Hauptseite: Eintrag im Profilmenü direkt unter "Alarm und Ausrückeordnung"
        const aao = document.querySelector('.dropdown-menu a[href="/aaos"]');
        if (aao && aao.closest('li')) {
            const item = document.createElement('li');
            item.setAttribute('role', 'presentation');
            open.className = '';
            open.textContent = 'LSS Helper: Wachen-Dashboard';
            item.append(open);
            aao.closest('li').after(item);
        } else {
            open.classList.add('lsshelper-dash-floating');
            document.body.append(open);
        }
    }

    /* ------------------------------------------------------------------ *
     * Feature-Register: neue Features hier eintragen
     * ------------------------------------------------------------------ */

    const FEATURES = [
        // Einsatzdaten im Hauptfenster vorladen, damit Einsatzfenster nicht warten müssen
        { name: 'preloadMissions', match: /^\/$/, run: getMissions },
        { name: 'aaoHighlight', match: /^\/missions\/\d+/, run: aaoHighlightLive },
        { name: 'aaoCreate', match: /^\/aaos\/new\/?$/, run: aaoCreate },
        { name: 'dashboardButton', match: /^\/($|buildings\/\d+\/?$)/, run: dashboardButton },
        { name: 'aaoSaved', match: /^\/aaos(\/|$)/, run: aaoSaved },
    ];

    window.LSSHelper = { features: Object.fromEntries(FEATURES.map(f => [f.name, f.run])), getMissions, nameVariants, nameScore, planFleet, openDashboard, applyChange: change => APPLY[change.kind](change), rerun: () => (clearMarks(), aaoHighlight()) };

    FEATURES.filter(f => f.match.test(location.pathname)).forEach(f => {
        try {
            Promise.resolve(f.run()).catch(e => console.error(`[LSS Helper] ${f.name}`, e));
        } catch (e) {
            console.error(`[LSS Helper] ${f.name}`, e);
        }
    });
})();
