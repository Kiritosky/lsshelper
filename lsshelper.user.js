// ==UserScript==
// @name         LSS Helper
// @namespace    lsshelper
// @version      0.27.4
// @description  Helfer für das Leitstellenspiel: markiert passende AAOs, legt AAOs an, prüft sie und passt die Fahrzeugbesatzung einer Wache ans Personal an.
// @match        https://www.leitstellenspiel.de/*
// @match        https://polizei.leitstellenspiel.de/*
// @updateURL    https://github.com/Kiritosky/lsshelper/releases/latest/download/lsshelper.user.js
// @downloadURL  https://github.com/Kiritosky/lsshelper/releases/latest/download/lsshelper.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;
    const CACHE_KEY = 'lsshelper_missions_v6';
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    const log = (...args) => DEBUG && console.log('[LSS Helper]', ...args);
    const inFrame = window.top !== window;

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
        crewButton: true,
        pulse: true,
        colorName: '#ff00d4',
        colorVehicles: '#00e5ff',
        minChance: 50,
        hotkey: 'y',
        nextTransport: true,
        buildingPersonnel: true,
        buildingExpansions: true,
        dispatchBacklog: true,
        dispatchNew: true,
        dispatchEscalation: true,
        dispatchTransport: true,
        dispatchAlliance: false,
        dispatchPlanned: false,
        dispatchButtons: true,
        dispatchKeyNext: 'd',
        dispatchKeySkip: 'f',
        dispatchKeyShare: 'g',
        dispatchAutoSkip: true,
        tcCrew: true,
        tcTransport: true,
        tcExpiring: true,
        tcExtInactive: true,
        tcExtSoon: true,
        tcLeitstelle: true,
        tcTrainings: true,
        tcStatus6: true,
        tcStatus6Min: 3,
    };
    // Aufbau der Einstellungsseite: [Schlüssel, Titel, Erklärung, abhängig von]
    const SETTINGS_SECTIONS = [
        {
            id: 'dispatch',
            title: '🚨 Leitstellen-Modus',
            intro: 'Start über den Knopf über der Einsatzliste. Öffnet Einsätze und Sprechwünsche nacheinander – jedes Ereignis nur einmal. Alarmiert wird immer nur von dir.',
            items: [
                ['dispatchBacklog', 'Beim Start offene Einsätze abarbeiten', 'Rote Einsätze und Einsätze mit fehlenden Fahrzeugen'],
                ['dispatchNew', 'Neue Einsätze öffnen'],
                ['dispatchEscalation', 'Nachalarmierungen öffnen', 'Wenn neue Fahrzeuge fehlen oder sich ein Einsatz ausbreitet'],
                ['dispatchTransport', 'Sprechwünsche öffnen', 'Fahrzeuge in Status 5 – vor allen Einsätzen'],
                ['dispatchAutoSkip', 'Einsätze ohne freies Fahrzeug selbst überspringen', 'Kommen wieder, sobald ein passendes Fahrzeug frei wird'],
                ['dispatchAlliance', 'Auch Verbandseinsätze'],
                ['dispatchPlanned', 'Auch geplante Einsätze'],
                ['dispatchButtons', 'Knöpfe im Fenster', 'Für die Bedienung ohne Tastatur, z. B. am iPad'],
                ['dispatchKeyNext', 'Taste: alarmieren & weiter'],
                ['dispatchKeySkip', 'Taste: überspringen'],
                ['dispatchKeyShare', 'Taste: im Verband freigeben & weiter', 'Ohne zu alarmieren'],
            ],
        },
        {
            id: 'check',
            title: '📋 Tagescheck',
            intro: 'Erster Reiter im Dashboard: zeigt, was gerade Aufmerksamkeit braucht. Jeder Punkt öffnet die passende Seite.',
            items: [
                ['tcCrew', 'Fahrzeuge ohne genug Personal', 'Weniger zugewiesen als die Mindestbesatzung – rücken nicht aus'],
                ['tcTransport', 'Offene Sprechwünsche', 'Fahrzeuge in Status 5'],
                ['tcExpiring', 'Einsätze, die heute Nacht verfallen', 'Werden ab 2 Uhr (UTC) gelöscht'],
                ['tcExtInactive', 'Gebaute, aber inaktive Ausbauten'],
                ['tcExtSoon', 'Ausbauten, die in 24 Stunden fertig werden'],
                ['tcLeitstelle', 'Gebäude ohne Leitstelle'],
                ['tcTrainings', 'Fehlende Lehrgänge', 'Liest die Personallisten – dauert bei vielen Wachen etwas'],
                ['tcStatus6', 'Wachen mit vielen Fahrzeugen in Status 6'],
                ['tcStatus6Min', 'Ab so vielen Fahrzeugen in Status 6 je Wache', '', 'tcStatus6'],
            ],
        },
        {
            id: 'aao',
            title: '🎯 AAO-Markierung',
            items: [
                ['hotkey', 'Taste: markierte AAO auswählen', 'Leer lassen = aus'],
                ['markName', 'AAO mit dem Einsatznamen markieren'],
                ['markVehicles', 'Fahrzeug-AAOs markieren', 'Zahl an der AAO = so oft klicken'],
                ['subtractPresent', 'Alarmierte und angehakte Fahrzeuge abziehen'],
                ['countForeign', 'Dabei Fahrzeuge anderer Spieler mitzählen', '', 'subtractPresent'],
                ['minChance', 'Mindest-Wahrscheinlichkeit in %', 'Seltener gebrauchte Fahrzeuge werden nur genannt, nicht markiert'],
                ['openTab', 'Reiter mit der Markierung automatisch öffnen'],
                ['showList', 'Fahrzeugliste in der Helfer-Leiste zeigen'],
                ['createButton', 'Knopf „AAO anlegen“ zeigen', 'Wenn es keine AAO mit dem Einsatznamen gibt'],
            ],
        },
        {
            id: 'look',
            title: '🎨 Darstellung',
            items: [
                ['pulse', 'Markierung pulsieren lassen'],
                ['colorName', 'Farbe für Namens-Treffer'],
                ['colorVehicles', 'Farbe für Fahrzeug-AAOs'],
            ],
        },
        {
            id: 'transport',
            title: '🏥 Sprechwünsche',
            items: [['nextTransport', 'Nach Krankenhaus-/Zellenwahl weiter', 'Zum nächsten Sprechwunsch, sonst zurück zum Einsatz']],
        },
        {
            id: 'buildings',
            title: '🏠 Wachen & Dashboard',
            items: [
                ['crewButton', 'Dashboard im Profilmenü und auf jeder Wache'],
                ['buildingPersonnel', 'Personalbedarf auf der Wache', 'Mindest- und Höchstbesatzung aller Fahrzeuge'],
                ['buildingExpansions', 'Ausbauten oben auf der Wache', 'Im Bau mit Restzeit, aktiv, inaktiv, nicht gebaut'],
            ],
        },
    ];
    const settings = Object.assign({}, DEFAULTS);
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
        Object.keys(DEFAULTS).forEach(key => {
            if (typeof saved[key] === typeof DEFAULTS[key]) settings[key] = saved[key];
        });
        // Bis 0.24.0 waren X/S Standard – X schließt im Spiel aber das Fenster, daher auf die neuen Standards umstellen
        if (saved.dispatchKeyNext === 'x' && saved.dispatchKeySkip === 's') {
            settings.dispatchKeyNext = DEFAULTS.dispatchKeyNext;
            settings.dispatchKeySkip = DEFAULTS.dispatchKeySkip;
        }
    } catch (e) {
        /* kaputte Einstellungen -> Standard */
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
                // Voraussetzungen (Wachenzahlen, Erweiterungen) und Merker für Sonderfälle: Verbands-, Folge- und Zeiteinsätze
                q: e.prerequisites || {},
                // Wahrscheinlichkeiten (%) für Anforderungen, die nicht bei jedem Einsatz gebraucht werden
                h: Object.fromEntries(Object.entries(c).filter(([key]) => e.requirements && key in e.requirements)),
                x: a.only_alliance_mission || a.unavailable_in_normal_missions || a.subsequent_mission_only || a.date_start ? 1 : 0,
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
        { label: 'Waldbrand-TLF', keys: ['brush_truck'], texts: ['Waldbrand-TLF', 'Waldbrandlöschfahrzeug', 'Waldbrandlöschfahrzeuge', 'TLF 3000 W', 'TLF 5000 W', 'GTLF 10000 W'], types: [187, 188, 189], attrs: ['brush_truck'] },
        { label: 'GW-Waldbrand', keys: ['wildfire_equipment'], texts: ['GW-Waldbrand', 'Anh Waldbrand', 'AB-Waldbrand'], types: [190, 191, 192], attrs: ['wildfire_equipment'] },
        { label: 'GW-Tierrettung', keys: ['animal_rescue'], texts: ['GW-Tierrettung'], types: [185, 186], attrs: ['animal_rescue'] },

        // Rettungsdienst / Wasser / SEG
        { label: 'RTW', keys: ['ambulances'], texts: ['RTW'], types: [28, 74, 97], attrs: ['rtw', 'naw'] },
        { label: 'RTW oder KTW', keys: [], texts: ['RTW oder KTW oder KTW-B'], types: [28, 38, 58, 74, 97], attrs: ['rtw', 'ktw', 'ktw_b', 'ktw_or_rtw', 'ktw_or_rtw_2'] },
        // Krankentransport: nur der normale KTW (KTW Typ B gehört zur SEG und fährt keine Krankentransporte)
        { label: 'KTW', keys: [], texts: ['KTW'], types: [38], attrs: ['ktw'] },
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

    // Name aus „fehlende Fahrzeuge“ -> Bedarf mit Fahrzeugtypen (für alle Fahrzeuge):
    // feste Liste, Rettungsmittel, Anforderungsnamen des Spiels (Ein- und Mehrzahl), Fahrzeugtyp-Namen; jeweils auch
    // ohne Klammern, nur der Klammerinhalt (z. B. „LF“) und ohne Mehrzahl-Endung
    let vehicleTypesByName = null;
    let demandByAbbrev = null;
    function demandForName(name) {
        const medical = MEDICAL.default;
        const medicalByName = { rtw: medical.transport, nef: medical.nef, rth: medical.rth, ktw: medical.ktw, lna: medical.lna, 'kdow lna': medical.lna, orgl: medical.orgl, 'kdow orgl': medical.orgl };
        if (!vehicleTypesByName || !Object.keys(vehicleTypesByName).length) {
            vehicleTypesByName = {};
            Object.entries(dataLabels.vehicles).forEach(([type, caption]) => (vehicleTypesByName[normalize(caption)] = vehicleTypesByName[normalize(caption)] || []).push(parseInt(type)));
        }
        const variants = [normalize(name), normalizeTitle(name), ...(String(name).match(/\(([^)]+)\)/g) || []).map(normalize)].filter(Boolean);
        variants.slice().forEach(v => [/en$/, /e$/, /n$/, /s$/].forEach(re => v.length > 4 && re.test(v) && variants.push(v.replace(re, ''))));
        // Abkürzungen aus den Klammern der festen Liste, z. B. „Löschfahrzeug (LF)“ -> „LF“
        if (!demandByAbbrev) {
            demandByAbbrev = {};
            DEMANDS.forEach(d => d.texts.forEach(t => (t.match(/\(([^)]+)\)/g) || []).forEach(m => (demandByAbbrev[normalize(m)] = demandByAbbrev[normalize(m)] || d))));
        }
        for (const v of variants) {
            if (DEMAND_BY_TEXT[v]) return DEMAND_BY_TEXT[v];
            if (demandByAbbrev[v]) return demandByAbbrev[v];
            if (medicalByName[v]) return medicalByName[v];
            const key = dataLabels.reqForms[v];
            const byKey = key && demandForKey(key);
            if (byKey && byKey.types && byKey.types.length) return byKey;
            if (vehicleTypesByName[v]) return { label: name, keys: [], texts: [name], types: vehicleTypesByName[v], attrs: [] };
        }
        return null;
    }

    // Anforderungen, die das Skript (noch) nicht kennt, z. B. nach einem Spiel-Update: Meist heißt das AAO-Feld
    // genauso wie die Anforderung – dann lässt sie sich ohne Skript-Update zuordnen.
    const autoDemands = {};
    function demandForKey(key) {
        if (DEMAND_BY_KEY[key]) return DEMAND_BY_KEY[key];
        if (autoDemands[key] !== undefined) return autoDemands[key];
        const type = (window.aao_types || []).find(t => t[0] === key);
        const caption = dataLabels.req[key] || (type && !/^\[missing/.test(type[1]) ? type[1] : key.replace(/_/g, ' '));
        return (autoDemands[key] = type ? { label: caption, keys: [key], texts: [caption], types: [], attrs: [key], auto: true } : null);
    }

    // Anforderungen der Einsatzdaten ohne feste Zuordnung im Skript: { key: Anzahl Einsätze }
    function unknownRequirements(missions) {
        const unknown = {};
        Object.values(missions).forEach(m => Object.entries(m.r).forEach(([key, need]) => {
            if (typeof need === 'number' && !DEMAND_BY_KEY[key] && !INFO_ONLY[key]) unknown[key] = (unknown[key] || 0) + 1;
        }));
        return unknown;
    }

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
            // Krankentransport: Patient verlangt ausdrücklich einen KTW
            ktw: { label: 'KTW', texts: ['KTW'], types: [38], attrs: ['ktw'] },
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
            [['nef', /\bNEF\b/], ['rth', /\bRTH\b/], ['lna', /\bLNA\b/], ['orgl', /\bOrgL\b/]].forEach(([key, re]) => {
                if (re.test(text)) needs[key] = (needs[key] || 0) + 1;
            });
            // Transport: „RTW oder KTW“ = beides passt, nur „KTW“ = Krankentransport, nur „RTW“ = Rettungswagen
            const rtw = /\bRTW\b/.test(text);
            const ktw = /\bKTW\b/.test(text);
            const transport = rtw && ktw ? 'transportKtw' : ktw ? 'ktw' : rtw ? 'transport' : null;
            if (transport) needs[transport] = (needs[transport] || 0) + 1;
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
            // Gleich gut passende AAOs: zuerst die mit freien Fahrzeugen, dann Fahrzeug vor Abrollbehälter
            const rank = c => (aaoAvailable(c.aao) === false ? 2 : 0) + (isContainerAao(c.aao) ? 1 : 0);
            // Markiert werden nur die besten; die Taste darf auf die übrigen ausweichen, falls die besten doch nicht gehen
            hits.sort((a, b) => rank(a) - rank(b));
            const withClicks = list => list.map(h => ({ aao: h.aao, clicks: Math.ceil(need / h.amount) }));
            const options = withClicks(hits);
            if (hits.length) hits = hits.filter(c => rank(c) === rank(hits[0]));
            return { label, need, present, hits: withClicks(hits), options };
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
            .lsshelper-dash-count-info { background: var(--muted); }
            .lsshelper-check-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 6px 2px; border-bottom: 1px solid var(--line); }
            .lsshelper-check-row:last-of-type { border-bottom: none; }
            .lsshelper-check-row small { color: var(--muted); }
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
            .lsshelper-dash-pane { display: grid; gap: 12px; }
            .lsshelper-dash-tabs { display: flex; gap: 4px; padding: 8px 16px 0; border-bottom: 1px solid var(--line); }
            #lsshelper-dash a.lsshelper-tab { border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; background: transparent; color: var(--muted); padding: 6px 14px; font-size: 13px; }
            #lsshelper-dash a.lsshelper-tab-active { background: var(--card); border-color: var(--line); color: var(--text); font-weight: 700; margin-bottom: -1px; }
            #lsshelper-dash a.lsshelper-dash-link { color: var(--text); text-decoration: underline dotted; cursor: pointer; }
            #lsshelper-dash a.lsshelper-dash-link:hover { color: var(--accent); }
            #lsshelper-dash table.lsshelper-dash-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; color: var(--text); background: transparent; }
            #lsshelper-dash table.lsshelper-dash-table th { text-align: left; font-weight: 600; color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; background: transparent; }
            #lsshelper-dash table.lsshelper-dash-table td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: top; background: transparent; }
            #lsshelper-dash table.lsshelper-dash-table tr:hover td { background: var(--bg); }
            #lsshelper-dash table.lsshelper-dash-table td:first-child { font-weight: 600; }
            .lsshelper-dash-spacer { margin-right: auto; }
            #lsshelper-dash input.lsshelper-dash-search { height: 26px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 12px; }
            #lsshelper-dash input.lsshelper-dash-key { width: 34px; text-align: center; text-transform: uppercase; background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 4px; }
            #lsshelper-dash input[type="number"] { width: 64px; background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 4px; }
            .lsshelper-menu-badge { display: inline-block; min-width: 16px; padding: 0 5px; border-radius: 8px; background: #c62828; color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; vertical-align: middle; }
            .lsshelper-dash-floating { position: fixed; left: 6px; bottom: 6px; z-index: 99999; }
            #lsshelper-dispatch { display: inline-block; margin-left: 4px; vertical-align: middle; }
            #lsshelper-dispatch .lsshelper-dispatch-panel { display: inline-block; margin-left: 6px; font-size: 12px; }
            #lsshelper-dispatch .lsshelper-dispatch-panel summary { cursor: pointer; }
            #lsshelper-dispatch .lsshelper-dispatch-panel[open] { display: block; margin: 6px 0; padding: 6px 8px; border: 1px solid rgba(128, 128, 128, 0.5); border-radius: 6px; }
            #lsshelper-dispatch .lsshelper-dispatch-list { display: flex; flex-direction: column; gap: 3px; margin: 2px 0 8px; }
            #lsshelper-dispatch .lsshelper-dispatch-empty { opacity: 0.6; }
            #lsshelper-dispatch .lsshelper-dispatch-log { max-height: 180px; overflow: auto; margin: 4px 0 0; padding: 6px; font-size: 11px; white-space: pre-wrap; }
            #lsshelper-dispatch-bar { position: sticky; top: 0; z-index: 1000; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; margin: -5px -5px 6px; background: #1f2229; color: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3); }
            #lsshelper-dispatch-bar .lsshelper-dispatch-info { flex: 1; min-width: 160px; font-weight: 700; }
            #lsshelper-dispatch-bar .lsshelper-dispatch-warn { color: #ffb74d; }
            #lsshelper-dispatch-bar .btn { min-height: 34px; }
            details.lsshelper-set-section { padding-bottom: 4px; }
            .lsshelper-set-summary { display: flex; align-items: baseline; gap: 10px; padding: 12px 0; cursor: pointer; list-style: none; }
            .lsshelper-set-summary::-webkit-details-marker { display: none; }
            .lsshelper-set-summary::before { content: '▸'; color: var(--muted); transition: transform 0.15s; }
            details[open] > .lsshelper-set-summary::before { transform: rotate(90deg); }
            details[open] > .lsshelper-set-summary { border-bottom: 1px solid var(--line); margin-bottom: 4px; }
            .lsshelper-set-summary small { margin-left: auto; color: var(--muted); }
            .lsshelper-set-intro { padding: 6px 2px 8px; color: var(--muted); }
            #lsshelper-dash label.lsshelper-set-row { display: flex; align-items: center; gap: 12px; margin: 0; padding: 9px 2px; border-bottom: 1px solid var(--line); font-weight: 400; color: var(--text); cursor: pointer; }
            #lsshelper-dash label.lsshelper-set-row:last-of-type { border-bottom: none; }
            .lsshelper-set-text { flex: 1; display: flex; flex-direction: column; }
            .lsshelper-set-title { font-size: 13px; }
            .lsshelper-set-text small { color: var(--muted); font-size: 11px; }
            .lsshelper-set-off { opacity: 0.4; }
            #lsshelper-dash input.lsshelper-switch { -webkit-appearance: none; appearance: none; flex: none; position: relative; width: 42px; height: 24px; margin: 0; border-radius: 12px; background: var(--line); cursor: pointer; transition: background 0.15s; }
            #lsshelper-dash input.lsshelper-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); transition: left 0.15s; }
            #lsshelper-dash input.lsshelper-switch:checked { background: var(--ok); }
            #lsshelper-dash input.lsshelper-switch:checked::after { left: 20px; }
            #lsshelper-dash input.lsshelper-set-number { width: 64px; padding: 3px 6px; }
            #lsshelper-dash input.lsshelper-set-color { width: 42px; height: 26px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; }
            #lsshelper-dash input.lsshelper-dash-key { width: 42px; height: 28px; font-size: 14px; }
            #lsshelper-dash pre.lsshelper-set-diag { white-space: pre-wrap; margin: 8px 0 0; padding: 8px; border-radius: 6px; background: var(--bg); color: var(--text); font-size: 11px; max-height: 300px; overflow: auto; }
            #lsshelper-settings { margin: 5px 0; padding: 6px 8px; border: 1px solid #888; border-radius: 4px; font-size: 12px; }
            #lsshelper-settings label { display: block; font-weight: normal; margin: 2px 0; }
            #lsshelper-settings input[type="number"] { width: 60px; color: #000; }
            @keyframes lsshelper-pulse {
                from { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000; }
                to { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--lsshelper-color), 0 0 0 7px #000, 0 0 14px 9px var(--lsshelper-color); }
            }
            .lsshelper-badge { background: #000; color: ${settings.colorVehicles}; border: 1px solid #fff; border-radius: 8px; padding: 0 5px; margin-right: 4px; font-weight: bold; }
            .lsshelper-filled { box-shadow: 0 0 0 3px #ff00d4 !important; }
            #aao-tabs .lsshelper-tab { box-shadow: inset 0 -4px 0 ${settings.colorName} !important; }
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
        if (!settings.showList) items = items.filter(text => !/^[✓✗●○]/.test(text) || /^✗/.test(text));
        if (items.length) panel.append(document.createElement('br'));
        items.forEach(text => {
            const item = document.createElement('span');
            item.className = 'lsshelper-item';
            item.textContent = text;
            panel.append(item);
        });
        if (settings.hotkey && hotkeyChoices.length) {
            const hint = document.createElement('span');
            hint.className = 'lsshelper-item';
            hint.textContent = `⌨ Taste „${settings.hotkey.toUpperCase()}“ wählt die Markierung aus`;
            panel.append(hint);
        }
    }

    // Was die Taste auswählen kann: pro Bedarf die passenden AAOs ({ aao, clicks }), beste zuerst.
    // Welche davon geklickt wird, entscheidet sich erst beim Drücken – dann zeigt das Spiel an, was gerade verfügbar ist.
    const hotkeyChoices = [];
    // Noch offene Bedarfe der letzten Markierung (für den Leitstellen-Modus: worauf ein übersprungener Einsatz wartet)
    let lastDemands = null;
    // Fehlendes, das kein Fahrzeug ist (Wasser, Personal …) – dann ist der Einsatz nicht „fertig“, auch wenn kein Fahrzeug fehlt
    let lastExtraMissing = 0;
    // Namen aus „fehlende Fahrzeuge“, die keinem Fahrzeugtyp zugeordnet werden konnten (fürs Protokoll)
    const lastUnknownNames = [];

    // Verfügbarkeit laut Spiel (grüner Haken / rotes Kreuz an der AAO); null, solange das Spiel noch rechnet
    function aaoAvailable(aao) {
        const label = document.getElementById(`available_aao_${aao.getAttribute('aao_id')}`);
        if (!label) return null;
        if (/label-success/.test(label.className)) return true;
        if (/label-danger/.test(label.className)) return false;
        return null;
    }

    // Abrollbehälter-AAOs erkennt man am Namen oder an AB-Feldern ("AB-Öl", ab_oel_only, abl2wasser_only …)
    const isContainerAao = aao =>
        /^\s*AB[- ]/i.test(aao.textContent.replace(/\d+×/, '')) || Array.from(aao.attributes).some(a => /^(ab_|only_ab_|abl2)/.test(a.name) && parseInt(a.value) > 0);

    // Erst eine AAO, deren Fahrzeuge frei sind; sonst lieber ein Fahrzeug als einen Abrollbehälter
    const preferredHit = hits => hits.find(h => aaoAvailable(h.aao) === true) || hits.find(h => !isContainerAao(h.aao)) || hits[0];

    let hotkeyBusy = false;
    // Wird die Taste gedrückt, bevor die Markierung fertig berechnet ist, wird sie danach nachgeholt
    let hotkeyReady = false;
    let hotkeyPending = false;

    async function pressHotkey() {
        if (hotkeyBusy) return;
        hotkeyBusy = true;
        try {
            const targets = new Map();
            hotkeyChoices.forEach(hits => {
                const hit = preferredHit(hits);
                targets.set(hit.aao, Math.max(hit.clicks, targets.get(hit.aao) || 0));
            });
            for (const [aao, clicks] of targets) {
                for (let i = 0; i < clicks; i++) {
                    aao.click();
                    await sleep(120);
                }
            }
            // Kurz warten, bis das Spiel ausgewählt und die Leiste neu gerechnet hat – sonst käme bei schnellem Doppeldruck alles doppelt
            await sleep(1300);
        } finally {
            hotkeyBusy = false;
        }
    }

    // Liefert true, wenn die Taste hier etwas auslöst (auch vom Hauptfenster aus aufrufbar)
    function triggerHotkey() {
        if (!settings.hotkey) return false;
        if (!hotkeyReady) return (hotkeyPending = true);
        if (!hotkeyChoices.length) return false;
        pressHotkey();
        return true;
    }

    const isHotkey = e =>
        !!settings.hotkey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key && e.key.toLowerCase() === settings.hotkey && !(e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'));

    // Hauptfenster: Die Taste landet oft hier statt im Einsatzfenster (Fokus) – dann an das offene Einsatzfenster weiterreichen
    function hotkeyRelay() {
        if (window.top !== window) return;
        document.addEventListener(
            'keydown',
            e => {
                if (!isHotkey(e)) return;
                const handled = Array.from(document.querySelectorAll('iframe')).some(frame => {
                    try {
                        const inner = frame.contentWindow;
                        return frame.getClientRects().length > 0 && /^\/missions\/\d+/.test(inner.location.pathname) && inner.LSSHelper && inner.LSSHelper.hotkey();
                    } catch (err) {
                        return false;
                    }
                });
                if (handled) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            },
            true
        );
    }

    function markDemands(container, aaos, demands, infos, headline) {
        const aaoTypes = new Set((window.aao_types || []).map(t => t[0]));
        const parsed = aaos.map(aao => ({ aao, specs: getAaoSpecs(aao, aaoTypes) })).filter(p => p.specs.length);
        log('AAO-Inhalte', parsed);
        // Eine AAO kann mehrere Bedarfe decken – dann zählt die höchste Klickzahl
        const clicksByAao = new Map();
        // Was der Einsatz nur selten braucht, wird genannt, aber weder markiert noch per Taste ausgewählt
        const rare = d => d.chance !== undefined && d.chance < settings.minChance;
        const open = demands.filter(d => d.need > 0 && !rare(d));
        lastDemands = open;
        const items = resolveDemands(open, aaos, parsed).map(r => {
            r.hits.forEach(h => clicksByAao.set(h.aao, Math.max(h.clicks, clicksByAao.get(h.aao) || 0)));
            if (r.options.length && settings.markVehicles) hotkeyChoices.push(r.options);
            return `${r.hits.length ? '✓' : '✗'} ${r.need}× ${r.label}${r.present ? ` (${r.present} schon alarmiert/angehakt)` : ''}`;
        });
        demands.filter(d => d.need > 0 && rare(d)).forEach(d => items.push(`○ evtl. ${d.need}× ${d.label}`));
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
                    // Der Fahrzeugtyp steht je nach Tabelle an der Zeile, an einer Zelle oder am Häkchen selbst
                    const el = row.matches('[vehicle_type_id]') ? row : (row.closest('tr') || row).querySelector('[vehicle_type_id]');
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
        // Taste wählt die markierten AAOs aus – alarmiert wird weiterhin von Hand
        document.addEventListener(
            'keydown',
            e => {
                if (!isHotkey(e) || !triggerHotkey()) return;
                e.preventDefault();
                e.stopImmediatePropagation();
            },
            true
        );
        await aaoHighlight();
        allowTabSwitch = false;
        hotkeyReady = true;
        if (hotkeyPending) {
            hotkeyPending = false;
            triggerHotkey();
        }
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
        // In der Einfangphase lauschen: Das Spiel hält Klicks auf AAOs an, bevor sie beim Dokument ankommen
        document.addEventListener('click', schedule, true);
        document.addEventListener('change', schedule, true);
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
        // Statistik für den Fahrzeugbedarf im Dashboard: beim ersten Öffnen festhalten, was nicht in ausreichender Zahl frei ist
        if (type) {
            getMissions()
                .then(missions => recordShortages(missions[type] || missions[type.split(/[-/]/)[0]], present))
                .catch(log);
        }
        hotkeyChoices.length = 0;
        lastDemands = null;
        lastExtraMissing = 0;
        lastUnknownNames.length = 0;
        const showName = byName => {
            hotkeyChoices.push([{ aao: byName[0], clicks: 1 }]);
            openTab(byName.map(a => mark(a, 'lsshelper-name'))[0]);
            renderPanel(container, `LSS Helper: AAO „${byName[0].textContent.trim()}“ passt zum Einsatz.`, []);
        };

        // 0) Übergabeort: Patienten warten auf den Rettungsdienst – RTW pro Patient, NEF wo gefordert
        const patientCount = document.querySelectorAll('.mission_patient').length;
        if (/übergabe/i.test(title) || (!type && patientCount && !missing.length)) {
            const medical = MEDICAL.default;
            const demands = [];
            const transport = Object.assign({}, medical.transport, { attrs: ['rtw', 'naw', 'ktw_or_rtw', 'ktw_or_rtw_2'] });
            // Verlangen Patienten ausdrücklich einen KTW (Krankentransport) bzw. „RTW oder KTW“, gilt das statt „RTW je Patient“
            const ktwPatients = (patientNeeds.ktw || 0) + (patientNeeds.transportKtw || 0);
            if (patientNeeds.ktw) demands.push({ demand: medical.ktw, label: 'KTW (1 pro Patient)', need: patientNeeds.ktw, scope: 'all' });
            if (patientNeeds.transportKtw) demands.push({ demand: medical.transportKtw, label: 'RTW oder KTW (1 pro Patient)', need: patientNeeds.transportKtw, scope: 'all' });
            if (patientCount > ktwPatients) demands.push({ demand: transport, label: 'RTW (1 pro Patient)', need: patientCount - ktwPatients, scope: 'all' });
            ['nef', 'rth', 'lna', 'orgl'].forEach(key => {
                if (patientNeeds[key]) demands.push({ demand: medical[key], label: medical[key].label, need: patientNeeds[key] });
            });
            // Bei mehr als 5 bzw. 10 Patienten verlangt das Spiel LNA bzw. OrgL
            if (patientCount >= 5 && !patientNeeds.lna) demands.push({ demand: medical.lna, label: 'LNA (ab 5 Patienten)', need: 1, scope: 'all' });
            if (patientCount >= 10 && !patientNeeds.orgl) demands.push({ demand: medical.orgl, label: 'OrgL (ab 10 Patienten)', need: 1, scope: 'all' });
            applyPresent(demands, present, 'driving');
            const infos = patientCount ? [`ℹ Patienten: ${patientCount}`] : ['ℹ Keine Patienten im Einsatzfenster erkannt'];
            const place = /übergabe/i.test(title) ? 'Übergabeort' : 'Patienten';
            markDemands(container, aaos, demands, infos, `LSS Helper: ${place} – benötigter Rettungsdienst (Zahl an der AAO = so oft klicken):`);
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
            const medicalByName = { nef: medical.nef, rth: medical.rth, rtw: medical.transport, ktw: medical.ktw, 'kdow lna': medical.lna, lna: medical.lna, 'kdow orgl': medical.orgl, orgl: medical.orgl };
            missing.forEach(({ name, need }) => {
                const key = normalize(name);
                const demand = medicalByName[key] || restrictDemand(demandForName(name), mission);
                if (demand || !/^(l\b|liter|feuerwehr|polizist|thw-einsatz|rettungsdienst|personen|l\/min)/i.test(name)) {
                    if (!demand) lastUnknownNames.push(name);
                    demands.push({ demand, label: demand && medicalByName[key] ? demand.label : name, need });
                } else {
                    infos.push(`ℹ ${need} ${name}`);
                }
            });
            Object.entries(patientNeeds).forEach(([key, need]) => {
                if (medical[key]) demands.push({ demand: medical[key], label: medical[key].label, need });
            });
            applyPresent(demands, present, 'driving');
            lastExtraMissing = infos.length;
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
            const demand = restrictDemand(demandForKey(key), mission);
            const chance = (mission.h && mission.h[key]) || 100;
            if (demand && typeof need === 'number' && need > 0) demands.push({ demand, label: chance < 100 ? `${demand.label} (${chance} %)` : demand.label, need, chance, key });
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
    const AMOUNT_ATTRS = /amount|value|equipment_mode/;
    // Rettungsdienst-Felder und -Fahrzeugtypen (RTW, KTW, NEF, RTH, NAW, ITW, GRTW, LNA, OrgL, SEG)
    const MEDICAL_ATTRS = /^(rtw|ktw|ktw_b|naw|nef|nef_only|rth_only|grtw\d?|kdow_lna|kdow_orgl|seg_elw|gw_san|ktw_or_rtw(_2)?|naw_or_rtw_and_nef(_or_rth)?)$/;
    const MEDICAL_TYPES = [28, 29, 31, 38, 55, 56, 58, 59, 60, 73, 74, 97, 149, 157];

    // Einsatzname -> Einsatz mit der Maximalanforderung aller gleichnamigen Varianten
    // Varianten, die erst mit mehr Wachen oder einer zusätzlichen Erweiterung kommen (z. B. mit Dienstgruppenleitung
    // oder Drohne), bleiben außen vor – sonst würde jede AAO als unvollständig gemeldet.
    function missionsByName(missions, buildings) {
        const byName = new Map();
        const baseUnknown = {};
        // Grundeinsätze zuerst, damit sie den Maßstab für ihre Varianten setzen
        const entries = Object.entries(missions).sort((a, b) => /^\d+$/.test(b[0]) - /^\d+$/.test(a[0]));
        entries.forEach(([, m]) => {
            const key = normalize(m.n);
            const merged = byName.get(key);
            const access = missionAccess(m, buildings);
            if (!merged) {
                // Was schon dem Grundeinsatz fehlt (z. B. eine Wasserrettungswache), darf auch den Varianten fehlen
                baseUnknown[key] = access.unknown.concat(access.unmet.map(u => u.key));
                byName.set(key, { n: m.n, r: Object.assign({}, m.r), h: Object.assign({}, m.h), p: m.p && m.p.slice(), g: m.g, c: m.c, words: normalizeTitle(m.n).split(' ') });
                return;
            }
            if (access.capped || !access.unknown.concat(access.unmet.map(u => u.key)).every(k => baseUnknown[key].includes(k))) return;
            merged.h = Object.assign({}, m.h, merged.h);
            Object.entries(m.r).forEach(([k, v]) => {
                if (typeof v === 'number') merged.r[k] = Math.max(merged.r[k] || 0, v);
            });
            if (m.p) merged.p = merged.p ? merged.p.map((v, i) => Math.max(v, m.p[i])) : m.p.slice();
        });
        return byName;
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

    // Vergleicht den Inhalt einer AAO ([{ typeId | attr, amount }]) mit dem Bedarf eines Einsatzes
    function checkAao(text, allSpecs, mission) {
        const aaoTypes = new Map(window.aao_types || []);
        // Mengenangaben und Rettungsdienst bleiben außen vor: ob RTW, NEF oder LNA in der AAO stehen, ist Geschmackssache
        const specs = allSpecs.filter(s => (s.attr === undefined ? !MEDICAL_TYPES.includes(s.typeId) : !AMOUNT_ATTRS.test(s.attr) && !MEDICAL_ATTRS.test(s.attr)));
        const demands = missionDemands(mission, 0).demands;
        const issues = [];
        const have = d => specs.filter(s => specMatches(s, d.demand)).reduce((sum, s) => sum + s.amount, 0);

        // Pflicht ist nur, was der Einsatz immer verlangt und was nicht zum Rettungsdienst gehört.
        // Der LKW K 9 zieht den BRmG R und kommt mit ihm zusammen, zählt also nicht einzeln.
        const required = d => !d.medical && d.chance >= 100 && d.key !== 'thw_lkw' && !d.demand.types.every(type => MEDICAL_TYPES.includes(type));
        demands.filter(required).forEach(d => {
            if (have(d) < d.need) issues.push(`fehlt: ${d.need - have(d)}× ${d.label}`);
        });
        const excess = new Set();
        specs.forEach(spec => {
            const matched = demands.filter(d => specMatches(spec, d.demand));
            if (!matched.length) {
                issues.push(`nicht benötigt: ${spec.amount}× ${spec.attr !== undefined ? aaoTypes.get(spec.attr) || spec.attr : `Fahrzeugtyp #${spec.typeId}`}`);
            } else if (matched.length === 1 && required(matched[0]) && have(matched[0]) > matched[0].need) {
                excess.add(matched[0]);
            }
        });
        excess.forEach(d => issues.push(`evtl. zu viel: ${have(d) - d.need}× ${d.label}`));

        const bracket = text.match(/\[(\d+)(?:\/\d+)?\]/);
        if (bracket && mission.p && parseInt(bracket[1]) !== mission.p[0]) issues.push(`Klammer [${bracket[1]}…] – laut Spieldaten bis zu ${mission.p[0]} Patienten`);
        return issues;
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
                if (!color) return;
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

    // Waldbrand-Update (Typen 187–192): Besatzung aus der Kaufseite des Spiels, Lehrgang aus /api/mission_type_data
    [187, 188, 189, 190].forEach(type => {
        STAFF[type] = [1, 3];
        TRAINING[type] = { wildfire: 1 };
    });
    [191, 192].forEach(type => (STAFF[type] = [0, 0]));

    // Bezeichnungen aus den Spieldaten: Anforderungen und Voraussetzungen (Schlüssel -> deutscher Name)
    // ... sowie Fahrzeugnamen, wo ein Fahrzeug gekauft werden kann, und offizielle Gebäudenamen
    // reqForms: Einzahl und Mehrzahl jeder Anforderung (normalisiert) -> Anforderungs-Schlüssel, für die Namen in „fehlende Fahrzeuge“
    const dataLabels = { req: {}, reqForms: {}, pre: {}, vehicles: {}, possible: {}, buildings: {} };

    // Stammdaten aktualisieren sich täglich, damit Neues nach einem Spiel-Update ohne Skript-Update bekannt wird:
    // Fahrzeuge (Besatzung, Lehrgänge) und Bezeichnungen aus der offenen Datenbank des LSS-Managers,
    // Lehrgangsnamen aus der offiziellen Schnittstelle des Spiels. Die Tabellen oben sind der Rückfall.
    const VEHICLE_DATA_KEY = 'lsshelper_game_data_v4';

    function applyVehicleData(data) {
        if (!data || !data.staff) return;
        ['req', 'reqForms', 'pre', 'vehicles', 'possible', 'buildings'].forEach(key => Object.assign(dataLabels[key], data[key] || {}));
        Object.entries(data.staff).forEach(([type, staff]) => {
            STAFF[type] = staff;
            if (data.training[type]) TRAINING[type] = data.training[type];
            else delete TRAINING[type];
        });
    }

    async function refreshVehicleData() {
        let cached = null;
        try {
            cached = JSON.parse(localStorage.getItem(VEHICLE_DATA_KEY) || 'null');
        } catch (e) {
            /* neu laden */
        }
        if (cached && Date.now() - cached.t < CACHE_TTL) return;
        const vehicles = await (await fetch('https://api.lss-manager.de/de_DE/vehicles')).json();
        const data = { t: Date.now(), staff: {}, training: {}, names: {}, req: {}, reqForms: {}, pre: {}, vehicles: {}, possible: {}, buildings: {} };
        // Die Zusatzquellen dürfen fehlen – dann bleibt es bei den eingebauten Bezeichnungen
        await sleep(150);
        const labels = await fetch('https://api.lss-manager.de/de_DE/einsaetze').then(r => r.json()).catch(() => ({}));
        const singular = text => String(text).split('|')[0].trim();
        Object.entries(labels.requirements || {}).forEach(([key, text]) => {
            data.req[key] = singular(text);
            String(text)
                .split('|')
                .forEach(form => form.trim() && (data.reqForms[normalize(form)] = key));
        });
        Object.entries(labels.prerequisites || {}).forEach(([key, text]) => (data.pre[key] = singular(text)));
        await sleep(150);
        const game = await fetch('/api/mission_type_data').then(r => r.json()).catch(() => ({}));
        (game.building_types || []).forEach(type => (data.buildings[type.id] = type.caption));
        (game.education_data || []).forEach(education => {
            if (education.education_key) data.names[education.education_key] = education.caption.replace(/ Lehrgang$/, '');
        });
        Object.entries(vehicles).forEach(([type, vehicle]) => {
            data.vehicles[type] = vehicle.caption;
            data.possible[type] = vehicle.possibleBuildings || [];
            if (!vehicle.staff) return;
            data.staff[type] = [vehicle.staff.min || 0, vehicle.staff.max || 0];
            const required = {};
            Object.values(vehicle.staff.training || {}).forEach(school => Object.entries(school).forEach(([key, rule]) => {
                const amount = rule.all ? 1 : rule.min || 0;
                if (amount > 0) required[key] = amount;
            }));
            if (Object.keys(required).length) data.training[type] = required;
        });
        localStorage.setItem(VEHICLE_DATA_KEY, JSON.stringify(data));
        applyVehicleData(data);
        // Eingebaute Namen gehen vor: Sie entsprechen der Schreibweise in der Personalliste
        Object.entries(data.names).forEach(([key, name]) => (TRAINING_NAMES[key] = TRAINING_NAMES[key] || name));
    }

    try {
        applyVehicleData(JSON.parse(localStorage.getItem(VEHICLE_DATA_KEY) || 'null'));
    } catch (e) {
        /* eingebaute Tabellen bleiben */
    }

    // Lehrgang -> Bezeichnung in der Personalliste
    // prettier-ignore
    const TRAINING_NAMES = {gw_messtechnik:'GW-Messtechnik',gw_gefahrgut:'GW-Gefahrgut',notarzt:'Notarzt',gw_hoehenrettung:'GW-Höhenrettung',elw2:'ELW 2',police_einsatzleiter:'Zugführer (leBefKw)',thw_zugtrupp:'Zugtrupp',thw_raumen:'Fachgruppe Räumen',wechsellader:'Wechsellader',police_fukw:'Hundertschaftsführer (FüKw)',dekon_p:'Dekon-P',lna:'LNA',orgl:'OrgL',fwk:'Feuerwehrkran',seg_elw:'Einsatzleitung (SEG)',seg_gw_san:'GW-San',polizeihubschrauber:'Polizeihubschrauber',gw_taucher:'GW-Taucher',gw_wasserrettung:'GW-Wasserrettung',police_wasserwerfer:'Wasserwerfer',arff:'Flugfeldlöschfahrzeug',rettungstreppe:'Rettungstreppe',police_sek:'SEK',police_mek:'MEK',werkfeuerwehr:'Werkfeuerwehr',seg_rescue_dogs:'Rettungshundeführer',thw_rescue_dogs:'Rettungshundeführer (THW)',k9:'Hundeführer (Schutzhund)',police_motorcycle:'Motorradstaffel',police_firefighting:'Brandbekämpfung',intensive_care:'Intensivpflege',criminal_investigation:'Kriminalpolizist',water_damage_pump:'Fachgruppe Wasserschaden/Pumpen',police_service_group_leader:'Dienstgruppenleitung',heavy_rescue:'FGr SB',thw_energy_supply:'FGr E',energy_supply:'NEA200',thw_drone:'Tr UL',fire_drone:'Drohnen-Schulung',seg_drone:'Drohnenoperator',care_service:'Betreuungshelfer',care_service_equipment:'Verpflegungshelfer',police_horse:'Reiterstaffel',fire_care_service:'Feuerwehr-Verpflegungseinheit',thw_command:'Fachzug Führung und Kommunikation',mountain_command:'EL Bergrettung',mountain_height_rescue:'Höhenretter',police_helicopter_lift:'Windenoperator',rescue_helicopter_lift:'Windenoperator',coastal_rescue:'Seenotretter',coastal_helicopter:'Hubschrauberpilot (Seenotrettung)',coastal_helicopter_lift:'Windenoperator',emergency_paramedic_water_rescue:'Notfallsanitäter mit Wasserrettungsausbildung',railway_fire:'Bahnrettung',police_speaker_operator:'Lautsprecheroperator',disaster_response_technology:'SEG - Technik und Sicherheit',thw_care_service:'Logistik-Verpflegung',thw_bridge_construction:'Fachgruppe Brückenbau',thw_bridge_construction_crane:'Kranführer',highway_police:'Autobahnpolizei'};

    try {
        const names = (JSON.parse(localStorage.getItem(VEHICLE_DATA_KEY) || '{}') || {}).names || {};
        Object.entries(names).forEach(([key, name]) => (TRAINING_NAMES[key] = TRAINING_NAMES[key] || name));
    } catch (e) {
        /* eingebaute Namen bleiben */
    }

    // Wachentyp -> Typ der Schule, die dessen Lehrgänge anbietet (Feuerwehr-, Rettungs-, Polizei-, THW-Schule)
    const SCHOOL_TYPES = { 0: 1, 18: 1, 2: 3, 5: 3, 20: 3, 6: 8, 19: 8, 9: 10 };

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
        leitstelle: change => submitEditForm(`/buildings/${change.building.id}/edit`, f => f.querySelector('[name="building[leitstelle_building_id]"]'), { 'building[leitstelle_building_id]': change.target.id }),
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
    // Gebäude und Fahrzeuge: nacheinander geladen (Fair-Use) und kurz zwischengespeichert, damit Werkzeuge sie teilen
    const BASICS_TTL = 60 * 1000;
    function loadBasics(force) {
        if (force || !shared.basics || Date.now() - shared.basics.t > BASICS_TTL) {
            const promise = (async () => {
                const buildings = await fetchJson('/api/buildings');
                await sleep(100);
                return { buildings, vehicles: await fetchJson('/api/vehicles') };
            })();
            shared.basics = { t: Date.now(), promise };
            promise.catch(() => (shared.basics = null));
        }
        return shared.basics.promise;
    }

    // Personallisten ändern sich selten: 10 Minuten im Speicher halten
    const PERSONNEL_TTL = 10 * 60 * 1000;
    async function cachedPersonnel(buildingId) {
        shared.personnel = shared.personnel || {};
        const hit = shared.personnel[buildingId];
        if (hit && Date.now() - hit.t < PERSONNEL_TTL) return { persons: hit.persons, cached: true };
        const persons = await loadPersonnel(buildingId);
        shared.personnel[buildingId] = { t: Date.now(), persons };
        return { persons, cached: false };
    }

    // Nach Änderungen im Spiel neu lesen
    function forgetFleet() {
        shared.basics = null;
        shared.personnel = {};
    }

    async function planFleet(onlyBuildingId, onProgress) {
        const { buildings, vehicles: allVehicles } = await loadBasics();
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
            const crewed = station.vehicles.filter(v => v.max > 0);
            station.seats = crewed.reduce((sum, v) => sum + v.max, 0);
            // Die Personalliste (eine Abfrage pro Wache) wird nur gebraucht, wenn Lehrgänge im Spiel sind oder das Personal knapp ist;
            // sonst reicht die Personalzahl aus den Gebäudedaten
            const needsList = crewed.some(v => TRAINING[v.type]) || station.building.personal_count < station.seats;
            let persons;
            if (needsList) {
                onProgress(`Lese Personal … ${index + 1}/${stations.length} (${station.building.caption})`);
                const result = await cachedPersonnel(station.building.id).catch(() => ({ persons: [], cached: true }));
                persons = result.persons;
                if (!result.cached) await sleep(100);
            } else {
                persons = Array.from({ length: station.building.personal_count }, () => ({ id: null, name: '', edu: new Set(), bound: '' }));
            }
            station.personnel = persons.length;
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
                // Gleichnamige Fahrzeuge lassen sich in der Personalliste nicht unterscheiden
                if (!needs || !v.staffed || duplicate(v.caption)) return;
                const bound = persons.filter(p => p.bound === v.caption);
                v.trained.filter(p => !bound.includes(p) && p.id).forEach(person => {
                    changes.push({ kind: 'assign', station, vehicle: v, person, text: `${person.name} → ${v.caption}${person.bound ? ` (bisher ${person.bound})` : ''}` });
                });
            });
            // Lehrgangsbedarf: so viele Ausgebildete brauchen die Fahrzeuge der Wache zusammen, so viele gibt es
            const demand = {};
            crewed.forEach(v => v.partial.forEach(([key, n]) => {
                demand[key] = demand[key] || { need: 0, vehicles: [] };
                demand[key].need += n;
                demand[key].vehicles.push(v.caption);
            }));
            Object.entries(demand).forEach(([key, { need, vehicles }]) => {
                const missing = need - persons.filter(p => p.edu.has(key)).length;
                if (missing > 0) changes.push({ kind: 'training', station, text: `braucht noch ${missing}× ${TRAINING_NAMES[key] || key} (für ${vehicles.join(', ')})` });
            });
        }
        if (!onlyBuildingId) changes.push(...planLeitstellen(buildings), ...planBuildingNames(buildings));
        else changes.push(...planLeitstellen(buildings).filter(c => String(c.building.id) === String(onlyBuildingId)));
        changes.push(...planNames(stations));
        return { stations, changes, buildings };
    }

    // Wachen ohne Leitstelle bekommen die nächstgelegene eigene Leitstelle vorgeschlagen
    function planLeitstellen(buildings) {
        const centers = buildings.filter(b => b.building_type === 7);
        if (!centers.length) return [];
        return buildings
            .filter(b => b.building_type !== 7 && !b.leitstelle_building_id)
            .map(building => {
                const distance = other => Math.hypot(other.latitude - building.latitude, other.longitude - building.longitude);
                const target = centers.slice().sort((a, b) => distance(a) - distance(b))[0];
                return { kind: 'leitstelle', building, target, text: `${building.caption} → ${target.caption}` };
            });
    }

    // Zahl der offenen Vorschläge für den Zähler am Menüeintrag
    const COUNT_KEY = 'lsshelper_dash_count';
    const COUNT_TTL = 30 * 60 * 1000;

    function showDashCount(count) {
        try {
            localStorage.setItem(COUNT_KEY, JSON.stringify({ t: Date.now(), n: count }));
        } catch (e) {
            /* Zähler ist nur Komfort */
        }
        const root = window.top === window ? document : null;
        if (!root) return;
        root.querySelectorAll('.lsshelper-menu-badge').forEach(badge => {
            badge.textContent = count ? String(count) : '';
            badge.style.display = count ? '' : 'none';
        });
    }

    const countOpen = changes => changes.filter(c => !c.done && !c.optional && c.kind !== 'training').length;

    const DASH_GROUPS = [
        { title: 'Leitstelle', kinds: ['leitstelle'], button: 'Leitstelle zuweisen' },
        { title: 'Namen', kinds: ['name', 'building'], button: 'Namen übernehmen' },
        { title: 'Sitzlimits', kinds: ['limit'], button: 'Sitzlimits übernehmen' },
        { title: 'Lehrgangspersonal', kinds: ['assign'], button: 'Lehrgangspersonal zuweisen' },
    ];

    const THEME_KEY = 'lsshelper_dash_theme';
    const TAB_KEY = 'lsshelper_dash_tab';

    function dashEl(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text) node.textContent = text;
        return node;
    }

    function dashButton(text, cls, onClick) {
        const btn = dashEl('a', `lsshelper-btn ${cls || ''}`, text);
        btn.href = '#';
        btn.addEventListener('click', e => {
            e.preventDefault();
            onClick(btn);
        });
        return btn;
    }

    // Karte mit Titel und Zähler; weitere Knöpfe kommen in card.head
    function dashCard(parent, title, count, countClass) {
        const card = dashEl('div', 'lsshelper-dash-card');
        card.head = dashEl('div', 'lsshelper-dash-card-head');
        card.head.append(dashEl('span', 'lsshelper-dash-card-title', title));
        if (count !== undefined) card.head.append(dashEl('span', `lsshelper-dash-count ${countClass || ''}`, String(count)));
        else card.head.append(dashEl('span', 'lsshelper-dash-spacer'));
        card.append(card.head);
        parent.append(card);
        return card;
    }

    // Überschrift einer Wache; ein Klick öffnet das Gebäude im Fenster des Spiels (selber Tab), z. B. um dort auszubauen
    function stationHeading(ctx, building) {
        const head = dashEl('div', 'lsshelper-dash-station');
        const link = dashEl('a', 'lsshelper-dash-link', building.caption);
        link.href = `/buildings/${building.id}`;
        link.title = 'Gebäude öffnen';
        link.addEventListener('click', e => {
            if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || typeof window.lightboxOpen !== 'function') return;
            e.preventDefault();
            ctx.close();
            window.lightboxOpen(link.getAttribute('href'));
        });
        head.append(link);
        return head;
    }

    // Führt angehakte Vorschläge nacheinander aus und markiert jede Zeile als erledigt oder fehlgeschlagen
    async function applyChanges(todo, label, ctx, btn) {
        if (!todo.length || btn.dataset.busy) return;
        btn.dataset.busy = '1';
        btn.classList.add('lsshelper-btn-busy');
        let failed = 0;
        for (const [index, change] of todo.entries()) {
            ctx.status(`${label}: ${index + 1}/${todo.length} …`);
            try {
                await APPLY[change.kind](change);
                change.done = true;
                change.box.disabled = true;
                change.row.classList.add('lsshelper-dash-done');
            } catch (err) {
                failed++;
                change.row.append(dashEl('em', '', ` – ${err.message}`));
                change.row.classList.add('lsshelper-dash-failed');
            }
            await sleep(250);
        }
        forgetFleet();
        delete btn.dataset.busy;
        btn.classList.remove('lsshelper-btn-busy');
        ctx.status(`${label}: ${todo.length - failed} übernommen${failed ? `, ${failed} fehlgeschlagen` : ''}. Zum Neuberechnen das Werkzeug erneut öffnen.`);
    }

    /* ---------------- Werkzeug: Wachen ---------------- */

    async function renderStationsTool(ctx) {
        ctx.status('Lese Wachen und Fahrzeuge …');
        const plan = await ctx.fleet();
        const actionable = plan.changes.filter(c => c.kind !== 'training');
        ctx.status(`${plan.stations.length} Wachen geprüft · ${actionable.length} Vorschläge · nichts wird geändert, bevor du „übernehmen“ drückst.`);
        const updateCount = () => !ctx.onlyBuildingId && showDashCount(countOpen(plan.changes));

        // Neu im Spiel: Anforderungen und Fahrzeugtypen, die das Skript nach einem Spiel-Update noch nicht kennt
        const unknown = unknownRequirements(await getMissions());
        const newTypes = Array.from(new Set(plan.stations.flatMap(s => s.vehicles).filter(v => !STAFF[v.type]).map(v => `${v.caption} (Typ ${v.type})`)));
        if (Object.keys(unknown).length || newTypes.length) {
            const card = dashCard(ctx.body, 'Neu im Spiel', Object.keys(unknown).length + newTypes.length, 'lsshelper-dash-count-warn');
            card.append(dashEl('div', 'lsshelper-dash-empty', 'Das Spiel kennt Dinge, die dem Skript noch fehlen. Neue Einsätze kommen von selbst, für diese Punkte braucht es ein Skript-Update:'));
            Object.entries(unknown).forEach(([key, count]) => {
                const auto = demandForKey(key);
                card.append(dashEl('div', 'lsshelper-dash-note', `Anforderung „${key}“ in ${count} Einsätzen – ${auto ? `vorläufig dem AAO-Feld „${auto.label}“ zugeordnet` : 'keine Zuordnung, erscheint nur als Info-Zeile'}`));
            });
            newTypes.forEach(text => card.append(dashEl('div', 'lsshelper-dash-note', `Fahrzeug ${text}: Besatzung und Lehrgang unbekannt, bei Sitzlimits übersprungen`)));
        }

        // Neues Fahrzeug fertig einrichten: Name, Sitzlimit und Lehrgangspersonal in einem Rutsch
        if (actionable.length) {
            const card = dashCard(ctx.body, 'Alles auf einmal', actionable.length);
            card.append(dashEl('div', 'lsshelper-dash-empty', 'Übernimmt alle angehakten Vorschläge unten der Reihe nach – z. B. um ein neu gekauftes Fahrzeug fertig einzurichten.'));
            card.head.append(
                dashButton('Alles übernehmen', 'lsshelper-btn-primary', async btn => {
                    const order = DASH_GROUPS.flatMap(g => g.kinds);
                    const todo = actionable.filter(c => c.box && c.box.checked && !c.done).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
                    await applyChanges(todo, 'Alles', ctx, btn);
                    updateCount();
                })
            );
        }

        DASH_GROUPS.forEach(group => {
            const items = plan.changes.filter(c => group.kinds.includes(c.kind));
            const card = dashCard(ctx.body, group.title, items.length || '✓', items.length ? '' : 'lsshelper-dash-count-ok');
            if (!items.length) return card.append(dashEl('div', 'lsshelper-dash-empty', 'Alles in Ordnung.'));
            const byStation = new Map();
            items.forEach(c => {
                const key = c.station ? c.station.building.caption : 'Wachen';
                byStation.set(key, (byStation.get(key) || []).concat(c));
            });
            byStation.forEach((list, caption) => {
                const station = list[0].station;
                const stationHead = station ? stationHeading(ctx, station.building) : dashEl('div', 'lsshelper-dash-station', caption);
                if (station) stationHead.append(dashEl('small', '', `Personal ${station.personnel} · Sitzplätze ${station.seats}`));
                card.append(stationHead);
                list.forEach(change => {
                    change.row = dashEl('label', 'lsshelper-dash-row');
                    change.box = dashEl('input');
                    change.box.type = 'checkbox';
                    change.box.checked = !change.optional;
                    change.row.append(change.box, dashEl('span', '', change.text));
                    card.append(change.row);
                });
            });
            card.head.append(
                dashButton('alle an/aus', 'lsshelper-btn-quiet', () => {
                    const open = items.filter(c => !c.done);
                    const allOn = open.every(c => c.box.checked);
                    open.forEach(c => (c.box.checked = !allOn));
                }),
                dashButton(group.button, 'lsshelper-btn-primary', async btn => {
                    await applyChanges(items.filter(c => c.box.checked && !c.done), group.title, ctx, btn);
                    updateCount();
                })
            );
        });

        // Lehrgangsbedarf: fehlende Ausbildungen je Wache, mit Sprung zur passenden eigenen Schule oder zu den Verbandslehrgängen
        const trainings = plan.changes.filter(c => c.kind === 'training');
        const notes = plan.stations.filter(s => s.note && s.note !== 'kein Personal').map(s => `${s.building.caption}: ${s.note}`);
        if (trainings.length || notes.length) {
            const card = dashCard(ctx.body, 'Lehrgangsbedarf', trainings.length + notes.length, 'lsshelper-dash-count-warn');
            trainings.forEach(change => {
                const row = dashEl('div', 'lsshelper-dash-note', `${change.station.building.caption} ${change.text} `);
                const school = plan.buildings.find(b => b.building_type === SCHOOL_TYPES[change.station.building.building_type]);
                const link = dashEl('a', 'lsshelper-btn lsshelper-btn-quiet', school ? `${school.caption} öffnen` : 'Verbandslehrgänge öffnen');
                link.href = school ? `/buildings/${school.id}` : '/schoolings';
                link.target = '_blank';
                row.append(link);
                card.append(row);
            });
            notes.forEach(text => card.append(dashEl('div', 'lsshelper-dash-note', text)));
        }
        updateCount();
    }

    /* ---------------- Werkzeug: Ausbau ---------------- */

    // Voraussetzungen der Einsätze -> wie sie sich aus den eigenen Gebäuden zählen lassen:
    // base = Gebäudetypen, die selbst zählen; ext = Erweiterungen (Name laut Spiel) auf Gebäuden der Typen in "on"
    const PREREQ_RULES = {
        fire_stations: { base: [0, 18] },
        rescue_stations: { base: [2, 20] },
        police_stations: { base: [6, 19] },
        thw: { base: [9] },
        bereitschaftspolizei: { base: [11] },
        seg: { base: [12] },
        police_helicopter_stations: { base: [13] },
        mountain_rescue: { base: [25] },
        coastal_rescue_count: { base: [26] },
        water_rescue_heliport_count: { base: [28] },
        wasserrettung: { base: [15], on: [0, 12], ext: /^Wasserrettung$/ },
        highway_police: { base: [29], on: [6], ext: /Autobahnpolizei/ },
        rescue_dog_units: { base: [21], on: [12, 25], ext: /Rettungshundestaffel/ },
        police_horse: { base: [24], on: [11, 24], ext: /Reiterstaffel/ },
        riot_unit_count: { base: [11], on: [11], ext: /Zug der 1\. Hundertschaft/ },
        thw_gkw_count: { base: [9], on: [9], ext: /Bergungsgruppe/ },
        thw_zugtrupp_count: { on: [9], ext: /Zugtrupp/ },
        thw_bergung_count: { on: [9], ext: /Notversorgung/ },
        thw_fg_raeumen_count: { on: [9], ext: /Fachgruppe Räumen/ },
        heavy_rescue: { on: [9], ext: /Schwere Bergung/ },
        thw_command: { on: [9], ext: /Führung und Kommunikation/ },
        water_damage_pump_count: { on: [9], ext: /Wasserschaden/ },
        thw_bridge_construction: { on: [9], ext: /Brückenbau/ },
        drone: { on: [0, 9, 12, 25], ext: /Drohne|Unbemannte Luftfahrt/ },
        wildfire: { on: [0], ext: /Wald- und Vegetation/ },
        ventilation: { on: [0], ext: /Großlüfter/ },
        fire_care_service: { on: [0], ext: /^Verpflegungsdienst$/ },
        railway_fire: { on: [0], ext: /Bahnrettung/ },
        energy_supply: { on: [0], ext: /Netzersatzanlage 50/ },
        energy_supply_2: { on: [0], ext: /Netzersatzanlage 200/ },
        werkfeuerwehr: { on: [0], ext: /Werkfeuerwehr/ },
        animal_rescue: { on: [0], ext: /Tierrettung/ },
        care_service: { on: [12], ext: /Betreuungs- und Verpflegungsdienst/ },
        disaster_response_technology: { on: [12], ext: /Technik und Sicherheit/ },
        police_service_group_leader: { on: [6], ext: /Dienstgruppenleitung/ },
        criminal_investigation_count: { on: [6], ext: /Kriminalpolizei/ },
        police_motorcycle: { on: [6], ext: /Motorradstaffel/ },
        guard_dog_count: { on: [6, 11, 17], ext: /Diensthundestaffel/ },
        police_speaker: { on: [11], ext: /Lautsprecherkraftwagen/ },
        detention_unit_count: { on: [11], ext: /Gefangenenkraftwagen/ },
        water_cannon: { on: [11], ext: /Wasserwerfer/ },
        mek: { on: [11, 17], ext: /^MEK/ },
        sek: { on: [11, 17], ext: /^SEK/ },
        lift: { on: [5, 13], ext: /Windenrettung/ },
        mountain_height_rescue: { on: [25], ext: /Höhenrettung/ },
    };
    // Rückfall-Namen, falls die Spieldaten (dataLabels) noch nicht geladen sind
    const BUILDING_NAMES = { 0: 'Feuerwache', 2: 'Rettungswache', 5: 'Rettungshubschrauber-Station', 6: 'Polizeiwache', 9: 'THW', 11: 'Bereitschaftspolizei', 12: 'Schnelleinsatzgruppe (SEG)', 13: 'Polizeihubschrauberstation', 15: 'Wasserrettung', 17: 'Polizei-Sondereinheiten', 21: 'Rettungshundestaffel', 24: 'Reiterstaffel', 25: 'Bergrettungswache', 26: 'Seenotrettungswache', 28: 'Hubschrauberstation (Seenotrettung)', 29: 'Autobahnpolizei' };
    const buildingName = type => dataLabels.buildings[type] || BUILDING_NAMES[type] || `Gebäudetyp ${type}`;
    const prereqName = key => dataLabels.pre[key] || key.replace(/_/g, ' ');

    // Zählt pro Voraussetzung, was die eigenen Gebäude hergeben (einmal pro Gebäudeliste)
    const prereqCache = new WeakMap();
    function prereqCounts(buildings) {
        if (prereqCache.has(buildings)) return prereqCache.get(buildings);
        const counts = {};
        Object.entries(PREREQ_RULES).forEach(([key, rule]) => {
            let have = buildings.filter(b => (rule.base || []).includes(b.building_type)).length;
            if (rule.ext) {
                buildings.filter(b => rule.on.includes(b.building_type)).forEach(b => {
                    have += (b.extensions || []).filter(e => e.available !== false && e.enabled !== false && rule.ext.test(e.caption)).length;
                });
            }
            counts[key] = have;
        });
        prereqCache.set(buildings, counts);
        return counts;
    }

    // Prüft die Voraussetzungen eines Einsatzes gegen die eigenen Gebäude und Erweiterungen.
    // unknown = Voraussetzungen, die das Skript nicht zählen kann.
    function missionAccess(mission, buildings) {
        const counts = prereqCounts(buildings);
        const result = { unmet: [], unknown: [], mainMissing: null, capped: false };
        Object.entries(mission.q || {}).forEach(([key, value]) => {
            if (key === 'main_building') {
                const same = { 0: [0, 18], 2: [2, 20], 6: [6, 19] }[value] || [value];
                if (value >= 0 && !buildings.some(b => same.includes(b.building_type))) result.mainMissing = value;
            } else if (key in counts) {
                if (counts[key] < value) result.unmet.push({ key, value, have: counts[key] });
            } else if (key.startsWith('max_')) {
                const base = key.slice(4);
                if (base in counts && counts[base] > value) result.capped = true;
            } else if (value > 0) {
                result.unknown.push(key);
            }
        });
        return result;
    }

    // Grundeinsätze ohne Varianten, Verbands-, Folge- und Zeiteinsätze
    const baseMissions = missions => Object.entries(missions).filter(([id, m]) => /^\d+$/.test(id) && !m.x);

    /* ---------------- Werkstatt-Statistik: zu wenig verfügbare Fahrzeuge ---------------- */

    // Im Einsatzfenster mitgezählt: welche Fahrzeuge beim ersten Öffnen eines Einsatzes nicht in ausreichender Zahl frei waren
    const SHORTAGE_KEY = 'lsshelper_shortages';

    function readShortages() {
        try {
            const stats = JSON.parse(localStorage.getItem(SHORTAGE_KEY) || 'null');
            if (stats && stats.counts) return stats;
        } catch (e) {
            /* neu beginnen */
        }
        return { since: Date.now(), counts: {}, seen: [] };
    }

    function recordShortages(mission, present) {
        const id = (location.pathname.match(/^\/missions\/(\d+)/) || [])[1];
        if (!id || !mission) return;
        const stats = readShortages();
        if (stats.seen.includes(id)) return;
        const free = Array.from(document.querySelectorAll('#vehicle_show_table_body_all .vehicle_checkbox'))
            .map(box => parseInt(box.getAttribute('vehicle_type_id')))
            .filter(type => !isNaN(type));
        const demands = missionDemands(mission, document.querySelectorAll('.mission_patient').length).demands.filter(d => d.chance >= settings.minChance);
        // Was schon unterwegs oder vor Ort ist, fehlt nicht; angehakte Fahrzeuge stehen noch in der Liste der freien
        applyPresent(demands, { driving: present.driving, atScene: present.atScene, selected: [] }, 'all');
        demands.forEach(d => {
            if (d.need <= 0 || !d.demand.types.length) return;
            const available = free.filter(type => d.demand.types.includes(type)).length;
            if (available < d.need) stats.counts[d.demand.label] = (stats.counts[d.demand.label] || 0) + 1;
        });
        stats.seen = stats.seen.concat(id).slice(-1000);
        try {
            localStorage.setItem(SHORTAGE_KEY, JSON.stringify(stats));
        } catch (e) {
            log('Statistik konnte nicht gespeichert werden', e);
        }
    }

    /* ---------------- Werkzeug: Fuhrpark & Ausbau ---------------- */

    // Kleine Tabelle; jede Zeile ist ein Array aus Text oder Knoten, optional mit Tooltip (title)
    function dashTable(parent, headers, rows) {
        const table = dashEl('table', 'lsshelper-dash-table');
        const head = table.createTHead().insertRow();
        headers.forEach(text => head.append(dashEl('th', '', text)));
        const body = table.createTBody();
        rows.forEach(row => {
            const tr = body.insertRow();
            if (row.title) tr.title = row.title;
            row.cells.forEach(cell => {
                const td = tr.insertCell();
                if (cell instanceof Node) td.append(cell);
                else td.textContent = cell;
            });
        });
        parent.append(table);
        return table;
    }

    async function renderExpansionTool(ctx) {
        ctx.status('Lese Gebäude, Fahrzeuge und Einsatzdaten …');
        const { buildings, vehicles } = await loadBasics();
        const missions = await getMissions();
        const counts = prereqCounts(buildings);
        const ownTypes = new Set(buildings.map(b => b.building_type));

        // Einsätze, die du bekommen kannst – gleichnamige Varianten zählen einzeln nach ihrem höchsten Bedarf
        const reachable = Object.values(missions).filter(m => {
            if (m.x) return false;
            const access = missionAccess(m, buildings);
            return !access.capped && access.mainMissing === null && !access.unmet.length && !access.unknown.length;
        });
        ctx.status(`${reachable.length} Einsatzvarianten erreichbar mit deinen Gebäuden. Hier wird nichts geändert.`);

        /* Fahrzeugbedarf: Einsätze, für die dein ganzer Fuhrpark nicht reicht, plus was im Einsatzfenster wirklich gefehlt hat */
        const stats = readShortages();
        const rows = [];
        const seenDemands = new Set();
        reachable.forEach(m => Object.keys(m.r).forEach(key => {
            const demand = demandForKey(key);
            if (demand && demand.types.length) seenDemands.add(demand);
        }));
        Object.keys(stats.counts).forEach(label => {
            const demand = DEMANDS.find(d => d.label === label);
            if (demand) seenDemands.add(demand);
        });
        seenDemands.forEach(demand => {
            const owned = vehicles.filter(v => demand.types.includes(v.vehicle_type)).length;
            const needs = {};
            reachable.forEach(m => demand.keys.forEach(key => {
                const need = m.r[key];
                if (typeof need === 'number' && need > 0 && (!m.h || !(m.h[key] < settings.minChance))) needs[m.n] = Math.max(needs[m.n] || 0, need);
            }));
            const list = Object.entries(needs);
            const short = list.filter(([, need]) => need > owned);
            const live = stats.counts[demand.label] || 0;
            if (!short.length && !live) return;
            const gain = extra => short.filter(([, need]) => need <= owned + extra).length;
            // Was kaufen und wohin: erster kaufbarer Typ, Wache mit freiem Stellplatz bevorzugt
            const buyable = demand.types.filter(type => STAFF[type] && STAFF[type][1] > 0 && (dataLabels.possible[type] || []).some(t => ownTypes.has(t)));
            const type = buyable[0];
            const extension = type === undefined ? null : TYPE_EXTENSIONS.find(([types]) => types.includes(type));
            const hasExtension = b => !extension || (b.extensions || []).some(e => e.available !== false && extension[1].test(e.caption));
            const places = type === undefined ? [] : buildings.filter(b => (dataLabels.possible[type] || []).includes(b.building_type) && hasExtension(b));
            const free = places.filter(b => b.level + 1 > vehicles.filter(v => v.building_id === b.id && STAFF[v.vehicle_type] && STAFF[v.vehicle_type][1] > 0).length);
            const where = extension && !places.length ? `braucht Erweiterung „${extension[2]}“` : !places.length ? '' : free.length ? `frei: ${free.slice(0, 2).map(b => b.caption).join(', ')}` : 'alle passenden Wachen voll';
            const einsaetze = n => `${n} ${n === 1 ? 'Einsatz' : 'Einsätze'}`;
            rows.push({
                score: live * 5 + short.length,
                title: short.length ? `Fehlt bei: ${short.map(([name, need]) => `${name} (${need})`).join(', ')}` : '',
                cells: [
                    demand.label,
                    String(owned),
                    short.length ? `${short.length} (bis ${Math.max(...short.map(([, need]) => need))} nötig)` : '–',
                    live ? `${live}×` : '–',
                    type === undefined ? '–' : `+1 ${dataLabels.vehicles[type] || demand.label}: ${einsaetze(gain(1))}${short.length > gain(1) ? `, +2: ${gain(2)}` : ''}`,
                    where,
                ],
            });
        });
        rows.sort((a, b) => b.score - a.score);
        const need = dashCard(ctx.body, 'Fahrzeugbedarf', rows.length || '✓', rows.length ? '' : 'lsshelper-dash-count-ok');
        need.append(
            dashEl(
                'div',
                'lsshelper-dash-empty',
                `„Einsätze“: erreichbare Einsätze, die mehr verlangen, als du insgesamt besitzt. „Zu wenig frei“: so oft war das Fahrzeug beim Öffnen eines Einsatzes nicht in ausreichender Zahl verfügbar (${stats.seen.length} Einsätze seit ${new Date(stats.since).toLocaleDateString('de-DE')}). Maus über eine Zeile zeigt die Einsätze.`
            )
        );
        if (rows.length) dashTable(need, ['Fahrzeug', 'Bestand', 'Einsätze', 'Zu wenig frei', 'Vorschlag', 'Stellplatz'], rows.slice(0, 15));
        else need.append(dashEl('div', 'lsshelper-dash-empty', 'Dein Fuhrpark deckt alle erreichbaren Einsätze ab.'));
        need.head.append(
            dashButton('Statistik zurücksetzen', 'lsshelper-btn-quiet', () => {
                localStorage.removeItem(SHORTAGE_KEY);
                ctx.open('expansion');
            })
        );

        /* Freischaltungen: was die nächste Wache oder Erweiterung bringt */
        const gains = {};
        const add = (id, label, have, step, name) => {
            gains[id] = gains[id] || { label, have, steps: {} };
            (gains[id].steps[step] = gains[id].steps[step] || new Set()).add(name);
        };
        Object.values(missions).forEach(m => {
            if (m.x) return;
            const access = missionAccess(m, buildings);
            if (access.capped || access.unknown.length) return;
            if (access.mainMissing !== null) {
                if (!access.unmet.length) add(`b${access.mainMissing}`, `${buildingName(access.mainMissing)} (neues Gebäude)`, 0, 1, m.n);
                return;
            }
            if (access.unmet.length !== 1) return;
            const { key, value, have } = access.unmet[0];
            if (value - have <= 2) add(key, prereqName(key), have, value - have, m.n);
        });
        const unlockRows = Object.values(gains)
            .map(g => {
                const one = g.steps[1] || new Set();
                const two = new Set([...one, ...(g.steps[2] || [])]);
                return { one, two, g };
            })
            .filter(r => r.two.size)
            .sort((a, b) => b.one.size - a.one.size || b.two.size - a.two.size)
            .slice(0, 15)
            .map(({ one, two, g }) => ({
                title: `+1: ${Array.from(one).join(', ') || '–'}`,
                cells: [g.label, String(g.have), one.size ? `${one.size}` : '–', two.size > one.size ? `${two.size}` : '–'],
            }));
        const unlock = dashCard(ctx.body, 'Freischaltungen', unlockRows.length || '✓', unlockRows.length ? '' : 'lsshelper-dash-count-ok');
        unlock.append(dashEl('div', 'lsshelper-dash-empty', 'Neue Einsatzarten durch eine weitere Wache oder Erweiterung. Maus über eine Zeile zeigt die Einsätze.'));
        if (unlockRows.length) dashTable(unlock, ['Gebäude / Erweiterung', 'Du hast', '+1 bringt', '+2 bringt'], unlockRows);
        else unlock.append(dashEl('div', 'lsshelper-dash-empty', 'Keine Freischaltungen über eine oder zwei weitere Wachen oder Erweiterungen gefunden.'));

        /* Wo noch Personal und Platz für weitere Fahrzeuge ist */
        const room = buildings
            .filter(b => STATION_TYPES.includes(b.building_type))
            .map(b => {
                const own = vehicles.filter(v => v.building_id === b.id);
                const seats = own.reduce((sum, v) => sum + (STAFF[v.vehicle_type] ? STAFF[v.vehicle_type][1] : 0), 0);
                const slots = b.level + 1;
                const used = own.filter(v => STAFF[v.vehicle_type] && STAFF[v.vehicle_type][1] > 0).length;
                return { b, spare: b.personal_count - seats, slots, used };
            })
            .filter(r => r.spare > 0)
            .sort((a, b) => b.spare - a.spare);
        const roomCard = dashCard(ctx.body, 'Platz für neue Fahrzeuge');
        if (room.length) {
            dashTable(
                roomCard,
                ['Wache', 'Personal ohne Sitzplatz', 'Stellplätze'],
                room.map(r => ({ cells: [stationHeading(ctx, r.b).firstChild, String(r.spare), `${r.used}/${r.slots}${r.used >= r.slots ? ' – Ausbaustufe nötig' : ''}`] }))
            );
        } else roomCard.append(dashEl('div', 'lsshelper-dash-empty', 'Auf keiner Wache steht Personal ohne Sitzplatz.'));
    }

    // Fahrzeugtypen, die nur mit einer bestimmten Erweiterung gekauft werden können: [Typen, Erweiterung (Name laut Spiel), Anzeigename]
    const TYPE_EXTENSIONS = [
        [[75, 76], /Flughafenfeuerwehr/, 'Flughafenfeuerwehr'],
        [[83, 84, 85, 86], /Werkfeuerwehr/, 'Werkfeuerwehr'],
        [[110, 111, 175, 179], /Netzersatzanlage 50/, 'Netzersatzanlage 50'],
        [[112, 113, 180], /Netzersatzanlage 200/, 'Netzersatzanlage 200'],
        [[114, 115, 116], /Großlüfter/, 'Großlüfter'],
        [[126, 128, 129], /Drohne/, 'Drohneneinheit'],
        [[162, 163, 164], /Bahnrettung/, 'Bahnrettung'],
        [[185, 186], /Tierrettung/, 'Tierrettung'],
        [[187, 188, 189, 190, 191, 192], /Wald- und Vegetation/, 'Wald- und Vegetationsbrandbekämpfung'],
        [[64, 66, 67, 68, 70, 71], /Wasserrettung/, 'Wasserrettung'],
        [[138, 139, 140, 141, 142], /Verpflegungsdienst/, 'Verpflegungsdienst'],
    ];

    // Wachen, auf denen Fahrzeuge stehen (keine Schulen, Krankenhäuser, Leitstellen)
    const STATION_TYPES = [0, 2, 5, 6, 9, 11, 12, 13, 15, 17, 18, 19, 20, 21, 24, 25, 26, 28, 29];

    /* ---------------- Werkzeug: AAO ---------------- */

    const CATEGORY_LABELS = { fire: 'Feuerwehr', ambulance: 'Rettungsdienst', police: 'Polizei', thw: 'THW', riot_police: 'Bereitschaftspolizei', water_rescue: 'Wasserrettung', mountain: 'Bergrettung', coastal: 'Seenotrettung', factory_fire_brigade: 'Werkfeuerwehr', airport: 'Flughafen', airport_specialization: 'Flughafen (Spezialisierung)', seg: 'SEG', seg_medical_service: 'SEG-Sanitätsdienst', criminal_investigation: 'Kriminalpolizei', highway_police: 'Autobahnpolizei', energy_supply: 'Stromversorgung (NEA50)', energy_supply_2: 'Stromversorgung (NEA200)', animal_rescue: 'Tierrettung' };

    // AAO aus der Spielschnittstelle -> { id, caption, textContent, specs, categoryId, color, textColor }
    async function loadAaos() {
        const list = await fetchJson('/api/v1/aaos');
        return list.map(aao => ({
            id: aao.id,
            caption: aao.caption,
            textContent: aao.caption,
            categoryId: aao.aao_category_id,
            color: aao.color,
            textColor: aao.text_color,
            specs: Object.entries(aao.vehicle_classes || {})
                .map(([attr, amount]) => ({ attr, amount: parseInt(amount) }))
                .concat(Object.entries(aao.vehicle_types || {}).map(([typeId, amount]) => ({ typeId: parseInt(typeId), amount: parseInt(amount) })))
                .filter(spec => spec.amount > 0),
        }));
    }

    // Merkt sich pro AAO-Kategorie die häufigste Farbe, damit neue AAOs sie übernehmen
    function saveCategoryStylesFromApi(aaos) {
        const counts = {};
        aaos.filter(a => a.categoryId && a.color).forEach(a => {
            const key = [`#${a.color}`, a.textColor ? `#${a.textColor}` : '', ''].join('|');
            counts[a.categoryId] = counts[a.categoryId] || {};
            counts[a.categoryId][key] = (counts[a.categoryId][key] || 0) + 1;
        });
        const styles = {};
        Object.entries(counts).forEach(([category, byStyle]) => {
            styles[category] = Object.keys(byStyle).sort((a, b) => byStyle[b] - byStyle[a])[0].split('|');
        });
        try {
            localStorage.setItem(STYLES_KEY, JSON.stringify(styles));
        } catch (e) {
            log('Farben konnten nicht gespeichert werden', e);
        }
    }

    async function renderAaoTool(ctx) {
        ctx.status('Lese AAOs und Einsatzdaten …');
        const aaos = await loadAaos();
        const missions = await getMissions();
        const { buildings } = await loadBasics();
        saveCategoryStylesFromApi(aaos);
        ctx.status(`${aaos.length} AAOs gelesen. Hier wird nichts geändert – „anlegen“ und „bearbeiten“ öffnen das Formular des Spiels.`);
        await sleep(0);

        // Fehlende AAOs: Einsätze, die du bekommen kannst, für die aber keine AAO mit passendem Namen existiert
        const variants = aaos.map(aao => nameVariants(aao.caption));
        const seen = new Set();
        const missing = [];
        baseMissions(missions).forEach(([id, mission]) => {
            const key = normalizeTitle(mission.n);
            if (seen.has(key)) return;
            seen.add(key);
            const access = missionAccess(mission, buildings);
            if (access.capped || access.mainMissing !== null || access.unmet.length) return;
            const words = key.split(' ');
            if (variants.some(v => nameScore(v, words) >= 0)) return;
            missing.push({ id, mission, uncertain: access.unknown.length > 0 });
        });
        missing.sort((a, b) => (a.mission.c[0] || '').localeCompare(b.mission.c[0] || '') || a.mission.n.localeCompare(b.mission.n));

        const card = dashCard(ctx.body, 'Fehlende AAOs', missing.length || '✓', missing.length ? '' : 'lsshelper-dash-count-ok');
        if (!missing.length) card.append(dashEl('div', 'lsshelper-dash-empty', 'Für jeden verfügbaren Einsatz gibt es eine AAO.'));
        else {
            const search = dashEl('input', 'lsshelper-dash-search');
            search.type = 'search';
            search.placeholder = 'Einsatz suchen …';
            card.head.append(search);
            const list = dashEl('div');
            card.append(list, dashEl('div', 'lsshelper-dash-empty', '* braucht evtl. eine Erweiterung, die du noch nicht hast – das lässt sich aus den Gebäudedaten nicht sicher ablesen.'));
            const LIMIT = 150;
            const draw = () => {
                const term = normalize(search.value);
                const shown = missing.filter(m => !m.done && (!term || normalize(m.mission.n).includes(term)));
                list.textContent = '';
                let category = null;
                shown.slice(0, LIMIT).forEach(entry => {
                    const current = CATEGORY_LABELS[entry.mission.c[0]] || entry.mission.c[0] || 'Sonstige';
                    if (current !== category) list.append(dashEl('div', 'lsshelper-dash-station', (category = current)));
                    const row = dashEl('div', 'lsshelper-dash-note', `${entry.mission.n}${entry.uncertain ? ' *' : ''} `);
                    row.append(
                        dashButton('anlegen', 'lsshelper-btn-quiet', () => {
                            try {
                                localStorage.setItem(DRAFT_KEY, JSON.stringify({ type: entry.id, mission: entry.mission }));
                            } catch (e) {
                                log('Entwurf konnte nicht gespeichert werden', e);
                            }
                            // Nach dem Speichern im Formular-Tab verschwindet der Eintrag hier
                            const onSaved = event => {
                                if (event.key !== SAVED_KEY || !event.newValue) return;
                                window.removeEventListener('storage', onSaved);
                                entry.done = true;
                                draw();
                            };
                            window.addEventListener('storage', onSaved);
                            window.open(`/aaos/new?${AAO_PARAM}=${encodeURIComponent(entry.id)}`, AAO_WINDOW);
                        })
                    );
                    list.append(row);
                });
                if (shown.length > LIMIT) list.append(dashEl('div', 'lsshelper-dash-empty', `… und ${shown.length - LIMIT} weitere – Suche nutzen.`));
            };
            search.addEventListener('input', draw);
            draw();
        }

        // AAO-Prüfung: bestehende AAOs gegen die Spieldaten
        const audit = dashCard(ctx.body, 'AAO-Prüfung');
        const result = dashEl('div');
        audit.append(dashEl('div', 'lsshelper-dash-empty', 'Vergleicht jede AAO, deren Name zu einem Einsatz passt, mit dessen größter Variante. Rettungsdienst zählt nicht als fehlend.'), result);
        audit.head.append(
            dashButton('Prüfung starten', 'lsshelper-btn-primary', async () => {
                ctx.status('Prüfe AAOs …');
                await sleep(0);
                const byName = missionsByName(missions, buildings);
                const stats = { ok: 0, bad: 0, ambiguous: 0, unmatched: 0 };
                result.textContent = '';
                aaos.forEach(aao => {
                    const found = missionsForAao(aao.caption, byName);
                    if (!found.missions.length) return found.ambiguous ? stats.ambiguous++ : stats.unmatched++;
                    const problems = found.missions.map(mission => ({ mission, issues: checkAao(aao.caption, aao.specs, mission) })).filter(p => p.issues.length);
                    if (!problems.length) return stats.ok++;
                    stats.bad++;
                    const row = dashEl('div', 'lsshelper-dash-note');
                    row.append(dashEl('b', '', aao.caption), ...problems.map(p => ` → ${p.mission.n}: ${p.issues.join(' · ')} `));
                    const edit = dashEl('a', 'lsshelper-btn lsshelper-btn-quiet', 'bearbeiten');
                    edit.href = `/aaos/${aao.id}/edit`;
                    edit.target = '_blank';
                    row.append(edit);
                    result.append(row);
                });
                ctx.status(`AAO-Prüfung: ${stats.bad} mit Abweichungen, ${stats.ok} in Ordnung, ${stats.ambiguous} mehrdeutig, ${stats.unmatched} keinem Einsatz zugeordnet (z. B. Fahrzeug-AAOs).`);
                if (!stats.bad) result.append(dashEl('div', 'lsshelper-dash-empty', 'Keine Abweichungen gefunden.'));
            })
        );
    }

    /* ---------------- Werkzeug: Einstellungen ---------------- */

    const SETTINGS_OPEN_KEY = 'lsshelper_settings_open';

    function renderSettingsTool(ctx) {
        ctx.status('Änderungen werden sofort gespeichert und gelten ab dem nächsten geöffneten Fenster.');
        const opened = new Set(readJsonSafe(SETTINGS_OPEN_KEY, ['dispatch']));
        const counters = [];
        const save = () => {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            counters.forEach(update => update());
            ctx.status('✓ Gespeichert – gilt ab dem nächsten geöffneten Fenster.');
        };
        const rowsByKey = {};
        const refreshDependencies = () =>
            SETTINGS_SECTIONS.forEach(section =>
                section.items.forEach(([key, , , dependsOn]) => {
                    if (dependsOn && rowsByKey[key]) rowsByKey[key].classList.toggle('lsshelper-set-off', !settings[dependsOn]);
                })
            );

        const control = key => {
            const type = typeof DEFAULTS[key];
            const input = dashEl('input');
            if (type === 'boolean') {
                input.type = 'checkbox';
                input.className = 'lsshelper-switch';
                input.checked = settings[key];
                input.addEventListener('change', () => ((settings[key] = input.checked), save(), refreshDependencies()));
            } else if (type === 'number') {
                input.type = 'number';
                input.className = 'lsshelper-set-number';
                input.value = settings[key];
                input.addEventListener('change', () => ((settings[key] = Number(input.value) || 0), save()));
            } else if (/^#/.test(DEFAULTS[key])) {
                input.type = 'color';
                input.className = 'lsshelper-set-color';
                input.value = settings[key];
                input.addEventListener('change', () => ((settings[key] = input.value), save()));
            } else {
                // Tasten: ein Zeichen, Groß/Klein egal
                input.type = 'text';
                input.maxLength = 1;
                input.className = 'lsshelper-dash-key';
                input.value = settings[key];
                input.addEventListener('input', () => ((settings[key] = input.value.toLowerCase()), save()));
            }
            return input;
        };

        SETTINGS_SECTIONS.forEach(section => {
            const box = dashEl('details', 'lsshelper-dash-card lsshelper-set-section');
            box.open = opened.has(section.id);
            box.addEventListener('toggle', () => {
                if (box.open) opened.add(section.id);
                else opened.delete(section.id);
                localStorage.setItem(SETTINGS_OPEN_KEY, JSON.stringify(Array.from(opened)));
            });
            const summary = dashEl('summary', 'lsshelper-set-summary');
            const switches = section.items.filter(([key]) => typeof DEFAULTS[key] === 'boolean').map(([key]) => key);
            const count = dashEl('small');
            const updateCount = () => (count.textContent = switches.length ? `${switches.filter(key => settings[key]).length} von ${switches.length} an` : '');
            updateCount();
            counters.push(updateCount);
            summary.append(dashEl('span', 'lsshelper-dash-card-title', section.title), count);
            box.append(summary);
            if (section.intro) box.append(dashEl('div', 'lsshelper-set-intro', section.intro));
            section.items.forEach(([key, title, hint]) => {
                const row = dashEl('label', 'lsshelper-set-row');
                const text = dashEl('span', 'lsshelper-set-text');
                text.append(dashEl('span', 'lsshelper-set-title', title));
                if (hint) text.append(dashEl('small', '', hint));
                row.append(text, control(key));
                rowsByKey[key] = row;
                box.append(row);
            });
            if (section.id === 'dispatch') box.append(dispatchDiagnoseButton());
            ctx.body.append(box);
        });
        refreshDependencies();

        const footer = dashCard(ctx.body, 'Zurücksetzen');
        footer.append(dashEl('div', 'lsshelper-dash-empty', 'Setzt alle Einstellungen auf die Standardwerte zurück.'));
        footer.head.append(
            dashButton('Standard wiederherstellen', 'lsshelper-btn-quiet', () => {
                if (!confirm('Alle Einstellungen auf Standard zurücksetzen?')) return;
                localStorage.removeItem(SETTINGS_KEY);
                Object.assign(settings, DEFAULTS);
                ctx.open('settings');
            })
        );
    }

    const readJsonSafe = (key, fallback) => {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
        } catch (e) {
            return fallback;
        }
    };

    const DASH_TOOLS = [
        { id: 'check', title: 'Tagescheck', render: (...args) => renderCheckTool(...args) },
        { id: 'stations', title: 'Wachen', render: renderStationsTool },
        { id: 'expansion', title: 'Fuhrpark & Ausbau', render: renderExpansionTool },
        { id: 'aao', title: 'AAO', render: renderAaoTool },
        { id: 'settings', title: 'Einstellungen', render: renderSettingsTool },
    ];

    // Das Dashboard ist eine Werkzeugsammlung: oben die Reiter, darunter das gewählte Werkzeug
    function openDashboard(onlyBuildingId, startTool) {
        addStyles();
        document.querySelectorAll('#lsshelper-dash-backdrop').forEach(node => node.remove());
        const backdrop = dashEl('div');
        backdrop.id = 'lsshelper-dash-backdrop';
        const dash = dashEl('div');
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
        const theme = dashButton('', '', () => {
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

        const head = dashEl('div', 'lsshelper-dash-head');
        const title = dashEl('div', 'lsshelper-dash-title', 'LSS Helper');
        title.append(dashEl('small', '', onlyBuildingId ? 'Werkzeuge · Wachen-Werkzeug nur für diese Wache' : 'Werkzeuge für Wachen, Ausbau und AAO'));
        head.append(title, theme, dashButton('✕', '', closeDash));
        const tabs = dashEl('div', 'lsshelper-dash-tabs');
        const status = dashEl('div', 'lsshelper-dash-status');
        const body = dashEl('div', 'lsshelper-dash-body');
        dash.append(head, tabs, status, body);
        document.body.append(backdrop);

        let fleet = null;
        let current = 0;
        const ctx = {
            body,
            onlyBuildingId,
            close: closeDash,
            status: text => {
                status.textContent = text;
                status.classList.remove('lsshelper-dash-failed');
            },
            // Wachen und Personal werden einmal gelesen und von den Werkzeugen geteilt
            fleet: () => (fleet = fleet || planFleet(onlyBuildingId, text => ctx.status(text))),
            open: async id => {
                const tool = DASH_TOOLS.find(t => t.id === id) || DASH_TOOLS[0];
                const run = ++current;
                localStorage.setItem(TAB_KEY, tool.id);
                tabs.querySelectorAll('a').forEach(tab => tab.classList.toggle('lsshelper-tab-active', tab.dataset.tool === tool.id));
                // Jedes Öffnen bekommt eine eigene Fläche, damit ein noch ladendes Werkzeug nicht in das nächste schreibt
                body.textContent = '';
                const pane = dashEl('div', 'lsshelper-dash-pane');
                body.append(pane);
                try {
                    await tool.render(Object.assign({}, ctx, { body: pane }));
                } catch (err) {
                    console.error(`[LSS Helper] ${tool.id}`, err);
                    // Nach einem Fehler beim Lesen soll der nächste Versuch neu laden
                    fleet = null;
                    if (run === current) {
                        status.textContent = `Fehler: ${err.message}`;
                        status.classList.add('lsshelper-dash-failed');
                    }
                }
            },
        };
        DASH_TOOLS.forEach(tool => {
            const tab = dashButton(tool.title, 'lsshelper-tab', () => ctx.open(tool.id));
            tab.dataset.tool = tool.id;
            tabs.append(tab);
        });
        return ctx.open(startTool || (onlyBuildingId ? 'stations' : localStorage.getItem(TAB_KEY)));
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
            open.textContent = 'LSS Helper ';
            item.append(open);
            aao.closest('li').after(item);
            // Zähler offener Vorschläge: am Menüeintrag und am Profil-Symbol, damit man ihn ohne Aufklappen sieht
            const badge = () => {
                const span = document.createElement('span');
                span.className = 'lsshelper-menu-badge';
                span.style.display = 'none';
                return span;
            };
            open.append(badge());
            const toggle = item.closest('li.dropdown') && item.closest('li.dropdown').querySelector('a.dropdown-toggle');
            if (toggle) toggle.append(badge());
            let cached = null;
            try {
                cached = JSON.parse(localStorage.getItem(COUNT_KEY) || 'null');
            } catch (e) {
                /* neu berechnen */
            }
            if (cached) showDashCount(cached.n);
            // Höchstens alle 30 Minuten im Hintergrund neu berechnen, mit Abstand zum Seitenaufbau
            if (!cached || Date.now() - cached.t > COUNT_TTL) {
                setTimeout(() => planFleet(null, () => {}).then(plan => showDashCount(countOpen(plan.changes))).catch(log), 8000);
            }
        } else {
            open.classList.add('lsshelper-dash-floating');
            document.body.append(open);
        }
    }

    /* ------------------------------------------------------------------ *
     * Feature: Weiterleitung zum nächsten Sprechwunsch
     * ------------------------------------------------------------------ */

    // Nach der Wahl von Krankenhaus oder Zelle: weiter zum nächsten Sprechwunsch, sonst zurück zum Einsatz, sonst Fenster schließen
    function nextTransport() {
        if (!settings.nextTransport) return;
        const afterChoice = /^\/vehicles\/\d+\/(patient|gefangener)\/-?\d+/.test(location.pathname);
        // Auf der normalen Fahrzeugseite nur nach einer Erfolgsmeldung – sonst könnte man kein Fahrzeug mehr ansehen
        if (!afterChoice && !(document.querySelector('.alert-success') && !document.querySelector('[data-transport-request="true"]'))) return;
        const next = document.getElementById('next-vehicle-fms-5');
        const mission = document.querySelector('a.btn.btn-success[href^="/missions/"]');
        // Im Leitstellen-Modus bestimmt dessen Warteschlange, was als Nächstes kommt
        let mode = null;
        try {
            mode = window.top.LSSHelperShared && window.top.LSSHelperShared.dispatch;
        } catch (e) {
            /* fremder Ursprung */
        }
        if (afterChoice && mode && mode.active) {
            return setTimeout(() => {
                const item = mode.takeNext();
                if (item) {
                    mode.expectUrl = item.url;
                    location.href = item.url;
                } else if (typeof window.tellParent === 'function') window.tellParent('lightboxClose();');
            }, 300);
        }
        setTimeout(() => {
            if (next) return next.click();
            if (!afterChoice) return;
            if (mission) return mission.click();
            if (typeof window.tellParent === 'function') window.tellParent('lightboxClose();');
        }, 300);
    }

    /* ------------------------------------------------------------------ *
     * Feature: Personalbedarf und Ausbauten in der Gebäudeansicht
     * ------------------------------------------------------------------ */

    // Restzeit als „2 T 4 Std.“ bzw. „3:05:09“
    function formatRemaining(ms) {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (days) return `${days} T ${hours} Std.`;
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    async function buildingInfo() {
        const id = (location.pathname.match(/^\/buildings\/(\d+)\/?$/) || [])[1];
        const info = document.querySelector('dl.dl-horizontal');
        if (!id || !info) return;

        // Ausbauten aus dem Reiter „Ausbauten“ oben zusammenfassen, damit man nicht erst umschalten muss
        const rows = Array.from(document.querySelectorAll('#ausbauten tbody tr'));
        if (settings.buildingExpansions && rows.length) {
            const groups = { running: [], inactive: [], active: [], missing: [] };
            const timers = [];
            rows.forEach(row => {
                const name = row.querySelector('b');
                if (!name) return;
                const caption = name.textContent.trim();
                const end = row.querySelector('[data-end-time]');
                if (end) {
                    const label = document.createElement('span');
                    label.className = 'label label-info';
                    const endTime = parseInt(end.getAttribute('data-end-time'));
                    timers.push(() => (label.textContent = `${caption} · noch ${formatRemaining(endTime - Date.now())}`));
                    groups.running.push(label);
                } else if (row.querySelector('.label-danger')) {
                    groups.inactive.push(Object.assign(document.createElement('span'), { className: 'label label-danger', textContent: `${caption} · ${row.querySelector('.label-danger').textContent.trim() || 'inaktiv'}` }));
                } else if (row.querySelector('.label-success') || row.querySelector('a[href*="extension_ready"]')) {
                    groups.active.push(Object.assign(document.createElement('span'), { className: 'label label-success', textContent: caption }));
                } else {
                    groups.missing.push(Object.assign(document.createElement('span'), { className: 'label label-default', textContent: caption }));
                }
            });
            const box = document.createElement('div');
            box.id = 'lsshelper-expansions';
            box.style.cssText = 'margin: 6px 0; line-height: 2;';
            [['running', 'Im Bau'], ['active', 'Aktiv'], ['inactive', 'Gebaut, aber inaktiv'], ['missing', 'Nicht gebaut']].forEach(([key, title]) => {
                if (!groups[key].length) return;
                const line = document.createElement('div');
                line.append(Object.assign(document.createElement('b'), { textContent: `${title}: ` }));
                groups[key].forEach(label => line.append(label, ' '));
                box.append(line);
            });
            const tick = () => timers.forEach(update => update());
            tick();
            if (timers.length) setInterval(tick, 1000);
            info.after(box);
        }

        // Personalbedarf: Summe der Mindest- und Höchstbesatzung, in Klammern ohne Fahrzeuge in Status 6
        if (settings.buildingPersonnel && document.getElementById('vehicle_table')) {
            const vehicles = await fetchJson(`/api/buildings/${id}/vehicles`).catch(() => null);
            if (!Array.isArray(vehicles) || !vehicles.length) return;
            const maxOf = v => (v.max_personnel_override === null || v.max_personnel_override === undefined ? (STAFF[v.vehicle_type] || [0, 0])[1] : v.max_personnel_override);
            const sum = (list, get) => list.reduce((total, v) => total + get(v), 0);
            const active = vehicles.filter(v => v.fms_real !== 6);
            const minOf = v => (STAFF[v.vehicle_type] || [0, 0])[0];
            const dt = document.createElement('dt');
            dt.append(Object.assign(document.createElement('strong'), { textContent: 'Personalbedarf:' }));
            const dd = document.createElement('dd');
            dd.textContent = `min ${sum(vehicles, minOf)} / max ${sum(vehicles, maxOf)}`;
            if (active.length !== vehicles.length) dd.textContent += ` (ohne Status 6: ${sum(active, minOf)} / ${sum(active, maxOf)})`;
            info.append(dt, dd);
        }
    }

    /* ------------------------------------------------------------------ *
     * Feature: Leitstellen-Modus
     * Hauptfenster: merkt sich Einsätze und Sprechwünsche, sammelt neue Ereignisse in einer Warteschlange
     * und öffnet sie nacheinander. Fenster (Einsatz/Fahrzeug): Leiste mit „alarmieren & weiter“ und „überspringen“.
     * Alarmiert wird nie automatisch.
     * ------------------------------------------------------------------ */

    // Spielfunktion umhüllen: erst das Spiel, dann unser Rückruf – ein Fehler bei uns darf das Spiel nie stören
    function hookGame(name, after) {
        const original = window[name];
        if (typeof original !== 'function') return false;
        window[name] = function (...args) {
            const result = original.apply(this, args);
            try {
                after(...args);
            } catch (e) {
                console.error(`[LSS Helper] ${name}`, e);
            }
            return result;
        };
        return true;
    }

    // Tippt man gerade Text? Häkchen und Knöpfe zählen nicht – nach dem Anhaken eines Fahrzeugs sollen die Tasten weiter gehen
    const typingIn = target =>
        !!(target && target.closest && (target.closest('textarea, select, [contenteditable]') || (target.matches('input') && !/^(checkbox|radio|button|submit)$/i.test(target.type))));

    // „Fehlende Fahrzeuge: 2 LF, 1 RW“ -> { LF: 2, RW: 1 }
    function parseMissing(text) {
        const result = {};
        String(text || '')
            .replace(/^[^:]*:/, '')
            .split(',')
            .forEach(part => {
                const match = part.trim().match(/^(\d+)\s+(.+)$/);
                if (match) result[match[2].trim()] = (result[match[2].trim()] || 0) + parseInt(match[1]);
                else if (part.trim()) result[part.trim()] = (result[part.trim()] || 0) + 1;
            });
        return result;
    }

    const DISPATCH_LISTS = { mission_list: 'own', mission_list_alliance: 'alliance', mission_list_sicherheitswache: 'planned', mission_list_sicherheitswache_alliance: 'planned', mission_list_krankentransporte: 'own' };
    const panelList = panel => (panel && panel.parentElement ? DISPATCH_LISTS[panel.parentElement.id] || 'other' : null);
    const listAllowed = list => list === 'own' || (list === 'alliance' && settings.dispatchAlliance) || (list === 'planned' && settings.dispatchPlanned);
    // Rot 0, gelb 1, grün 2 – aus der Klasse des Spiels (mission_panel_red/yellow/green)
    function panelState(panel) {
        const box = panel.querySelector('[class*="mission_panel_"]') || panel;
        const match = box.className.match(/mission_panel_(red|yellow|green)/);
        return match ? { red: 0, yellow: 1, green: 2 }[match[1]] : null;
    }
    const panelMissing = panel => {
        const el = panel.querySelector('[id^="mission_missing_"]');
        return el && el.offsetParent !== null ? el.textContent.trim() : el ? el.textContent.trim() : '';
    };

    // Einsatzfenster: Bedarfe, für die gerade kein passendes Fahrzeug frei in der Liste steht -> [{ label, types }]
    async function unmetDemands() {
        return (await demandStatus()).unmet;
    }

    // Offene Bedarfe des Einsatzfensters und welche davon gerade kein freies Fahrzeug haben
    async function demandStatus() {
        let demands = lastDemands;
        // Bei einer AAO mit Einsatznamen gibt es keine Einzelbedarfe – dann aus den Einsatzdaten ermitteln
        if (!demands) {
            const type = getMissionType();
            const missions = type ? await getMissions().catch(() => ({})) : {};
            const mission = type ? missions[type] || missions[type.split(/[-/]/)[0]] : null;
            if (!mission) return { open: [], unmet: [], known: false };
            demands = missionDemands(mission, document.querySelectorAll('.mission_patient').length).demands;
            applyPresent(demands, presentVehicles(), 'all');
            demands = demands.filter(d => d.need > 0 && !(d.chance !== undefined && d.chance < settings.minChance));
        }
        const free = new Set(
            Array.from(document.querySelectorAll('#vehicle_show_table_all tbody tr'))
                .filter(row => !row.querySelector('.vehicle_checkbox:checked'))
                .map(row => {
                    const el = row.querySelector('[vehicle_type_id]');
                    return el ? parseInt(el.getAttribute('vehicle_type_id')) : NaN;
                })
        );
        const unmet = demands.filter(d => d.demand && d.demand.types.length && !d.demand.types.some(type => free.has(type))).map(d => ({ label: d.demand.label || d.label, types: d.demand.types }));
        return { open: demands, unmet, known: true };
    }

    // Startdaten der Hauptseite: das Spiel ruft beim Laden missionMarkerAdd({...}) für jeden Einsatz auf
    function pageMarkers() {
        const markers = [];
        Array.from(document.scripts).forEach(script => {
            const text = script.textContent || '';
            if (!text.includes('missionMarkerAdd(')) return;
            const pattern = /missionMarkerAdd\((\{.*?\})\);/g;
            let match;
            while ((match = pattern.exec(text))) {
                try {
                    markers.push(JSON.parse(match[1]));
                } catch (e) {
                    /* kein reines JSON – überspringen */
                }
            }
        });
        return markers;
    }

    function dispatchMain() {
        if (inFrame || !document.getElementById('missions-panel-body')) return;
        addStyles();
        const mode = (shared.dispatch = shared.dispatch || { active: false, queue: [], opened: new Set(), log: [], pendingUrl: null, opened_missing: {}, fms: {}, vehicleType: {}, waiting: {} });
        const loadedAt = Date.now();
        const time = () => new Date().toLocaleTimeString('de-DE');
        const note = text => {
            mode.log.unshift(`${time()} ${text}`);
            mode.log.length = Math.min(mode.log.length, 60);
            renderPanel();
        };

        // Ein Datensatz je Einsatz: aus den Meldungen des Spiels, ergänzt um die Einsatzliste
        mode.note = note;
        const missions = new Map();
        const panelOf = id => document.getElementById(`mission_${id}`);
        const unknownNoted = new Set();
        // Fahrzeuge auf Anfahrt je Einsatz (Status 3): zählen nicht als „fehlend“, auch wenn das Spiel sie noch so anzeigt
        const driving = new Map();
        const setDriving = (vehicleId, missionId) => {
            driving.forEach(set => set.delete(String(vehicleId)));
            if (missionId) (driving.get(String(missionId)) || driving.set(String(missionId), new Set()).get(String(missionId))).add(String(vehicleId));
        };
        // Fehlende Fahrzeuge abzüglich der passenden Fahrzeuge auf Anfahrt
        const effectiveMissing = (id, missing) => {
            const onTheWay = Array.from(driving.get(String(id)) || []).map(v => mode.vehicleType[v]);
            const result = {};
            Object.entries(missing).forEach(([name, count]) => {
                const demand = demandForName(name);
                if (!demand && !unknownNoted.has(name) && !/^(l\b|liter|feuerwehr|polizist|thw-einsatz|rettungsdienst|personen|l\/min)/i.test(name)) {
                    unknownNoted.add(name);
                    note(`Fahrzeugname nicht zugeordnet: „${name}“`);
                }
                let left = count;
                if (demand) {
                    onTheWay.forEach((type, i) => {
                        if (left > 0 && type !== undefined && demand.types.includes(type)) {
                            left--;
                            onTheWay[i] = undefined;
                        }
                    });
                }
                if (left > 0) result[name] = left;
            });
            return result;
        };
        // Liste aus den Daten der Meldung (zuverlässig, auch wenn der Listeneintrag noch fehlt); sonst aus der Einsatzliste
        const listOfMarker = marker => {
            if (marker.sw) return 'planned';
            if (marker.user_id !== undefined && marker.user_id !== null && String(marker.user_id) !== String(window.user_id)) return 'alliance';
            if (marker.user_id !== undefined && marker.user_id !== null) return 'own';
            return null;
        };
        const recordFromMarker = marker => ({
            id: String(marker.id),
            name: marker.caption || '',
            state: marker.vehicle_state,
            missing: marker.missing_text || '',
            type: `${marker.mtid}|${marker.additive_overlays || ''}|${marker.overlay_index || ''}`,
            list: listOfMarker(marker),
            created: !marker.created_at ? null : typeof marker.created_at === 'number' ? (marker.created_at < 1e12 ? marker.created_at * 1000 : marker.created_at) : Date.parse(marker.created_at) || null,
        });
        const recordFromPanel = (id, panel) => {
            const caption = panel.querySelector('[id^="mission_caption_"]');
            return { id, name: caption ? caption.textContent.trim() : '', state: panelState(panel), missing: panelMissing(panel), type: null, list: panelList(panel), created: null };
        };
        const nameOf = id => {
            const rec = missions.get(String(id));
            const caption = panelOf(id) && panelOf(id).querySelector('[id^="mission_caption_"]');
            return (rec && rec.name) || (caption && caption.textContent.trim()) || `Einsatz ${id}`;
        };
        const listOf = id => {
            const rec = missions.get(String(id));
            return (rec && rec.list) || panelList(panelOf(id));
        };

        // Ausgangslage beim Laden: alles, was jetzt da ist, ist nicht „neu“
        pageMarkers().forEach(marker => marker.id !== undefined && missions.set(String(marker.id), Object.assign(recordFromMarker(marker), { decided: true })));
        document.querySelectorAll('#missions-panel-body .missionSideBarEntry').forEach(panel => {
            const id = panel.getAttribute('mission_id') || panel.id.replace('mission_', '');
            if (!missions.has(id)) missions.set(id, Object.assign(recordFromPanel(id, panel), { decided: true }));
        });
        // Einsatz-IDs steigen: alles bis zur höchsten bekannten ID gab es schon beim Laden
        const baselineId = Math.max(0, ...Array.from(missions.keys()).map(Number).filter(n => !isNaN(n)));
        const isNew = rec => (rec.created ? rec.created > loadedAt - 60 * 1000 : baselineId > 0 ? Number(rec.id) > baselineId : true);

        // Ist gerade ein Spielfenster offen? Sichtbares iframe mit einer Spielseite – auch wenn es noch lädt (dann zählt die Zieladresse)
        const GAME_PAGE = /^\/(missions|vehicles|buildings|aaos|profile|credits|verband|alliance)/;
        let lastOpen = 0;
        // Erst die Zieladresse prüfen: ein frisch eingefügtes Fenster nicht anfassen, solange es lädt
        const blockingFrame = () =>
            Array.from(document.querySelectorAll('iframe')).find(frame => {
                if (!frame.getClientRects().length || frame.offsetWidth < 200) return false;
                if (GAME_PAGE.test(new URL(frame.getAttribute('src') || 'about:blank', location.origin).pathname)) return true;
                try {
                    return GAME_PAGE.test(frame.contentWindow.location.pathname);
                } catch (e) {
                    return false;
                }
            });
        const windowOpen = () => Date.now() - lastOpen < 1500 || !!blockingFrame();

        // ----- Bedienung im Hauptfenster: Start/Stopp und Übersicht -----
        const wrap = document.createElement('div');
        wrap.id = 'lsshelper-dispatch';
        const button = document.createElement('a');
        button.href = '#';
        button.id = 'lsshelper-dispatch-toggle';
        const details = document.createElement('details');
        details.className = 'lsshelper-dispatch-panel';
        const summary = document.createElement('summary');
        summary.textContent = 'Übersicht';
        const panelBody = document.createElement('div');
        details.append(summary, panelBody);
        wrap.append(button, details);

        const render = () => {
            button.className = `btn btn-xs ${mode.active ? 'btn-danger' : 'btn-success'}`;
            const waiting = Object.keys(mode.waiting).length;
            const extra = [mode.queue.length ? `${mode.queue.length} offen` : '', waiting ? `${waiting} warten auf Fahrzeuge` : ''].filter(Boolean).join(', ');
            button.textContent = mode.active ? `■ Leitstellen-Modus stoppen${extra ? ` (${extra})` : ''}` : '▶ Leitstellen-Modus';
            details.style.display = mode.active || mode.log.length ? '' : 'none';
            renderPanel();
        };
        // Übersicht: Warteschlange und Warteliste (antippen öffnet sofort) sowie das Protokoll
        function renderPanel() {
            if (!details.open) return;
            panelBody.textContent = '';
            const section = (title, rows, empty) => {
                panelBody.append(Object.assign(document.createElement('b'), { textContent: title }));
                const list = document.createElement('div');
                list.className = 'lsshelper-dispatch-list';
                if (!rows.length) list.append(Object.assign(document.createElement('div'), { className: 'lsshelper-dispatch-empty', textContent: empty }));
                rows.forEach(row => list.append(row));
                panelBody.append(list);
            };
            const link = (text, onTap) => {
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = text;
                a.addEventListener('click', e => {
                    e.preventDefault();
                    onTap();
                });
                return a;
            };
            section('Als Nächstes', mode.queue.map(item => link(item.label, () => openNow(item))), mode.active ? 'Nichts offen' : 'Modus ist aus');
            section('Wartet auf Fahrzeuge', Object.entries(mode.waiting).map(([id, wait]) => link(`${nameOf(id)} – wartet auf ${wait.labels.join(', ')}`, () => openNow(missionItem(id, 'manual', {})))), 'Nichts');
            const log = document.createElement('pre');
            log.className = 'lsshelper-dispatch-log';
            log.textContent = mode.log.join('\n') || '–';
            const copy = link('Protokoll kopieren', () => {
                const text = mode.log.join('\n');
                if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => (copy.textContent = 'Kopiert ✓'), () => prompt('Protokoll:', text));
                else prompt('Protokoll:', text);
            });
            panelBody.append(Object.assign(document.createElement('b'), { textContent: 'Protokoll ' }), copy, log);
        }
        details.addEventListener('toggle', renderPanel);

        // ----- Warteschlange -----
        const enqueue = item => {
            if (!mode.active) return;
            if (mode.opened.has(item.sig) || mode.queue.some(q => q.sig === item.sig)) return;
            // Pro Einsatz bzw. Fahrzeug nur ein Eintrag in der Schlange – der neuere Anlass ersetzt den älteren
            mode.queue = mode.queue.filter(q => q.key !== item.key);
            mode.queue.push(item);
            // Sprechwünsche zuerst, dann Nachalarmierungen, dann neue/offene Einsätze; sonst in Ankunftsreihenfolge
            mode.queue.sort((a, b) => a.priority - b.priority || a.at - b.at);
            note(`+ ${item.label}`);
            render();
            setTimeout(processQueue, 0);
        };
        const drop = (key, reason) => {
            const before = mode.queue.length;
            mode.queue = mode.queue.filter(q => q.key !== key);
            if (before !== mode.queue.length) {
                if (reason) note(`− ${reason}`);
                render();
            }
        };
        const markOpened = item => {
            mode.opened.add(item.sig);
            if (item.missing) mode.opened_missing[item.key] = item.missing;
            if (item.type === 'mission') delete mode.waiting[item.id];
        };
        // Nimmt den nächsten Eintrag aus der Schlange und merkt ihn als geöffnet (wird nie wieder geöffnet)
        mode.takeNext = () => {
            const item = mode.queue.shift();
            if (item) {
                markOpened(item);
                note(`→ ${item.label}`);
            }
            render();
            return item || null;
        };
        mode.count = () => mode.queue.length;
        // Übersprungen oder nur teilweise alarmiert: Einsatz wartet, bis ein Fahrzeug eines fehlenden Typs frei wird
        mode.waitFor = (id, unmet) => {
            if (!unmet || !unmet.length) {
                delete mode.waiting[id];
                return render();
            }
            mode.waiting[id] = { types: new Set(unmet.flatMap(u => u.types)), labels: unmet.map(u => u.label) };
            note(`⏳ ${nameOf(id)} wartet auf ${mode.waiting[id].labels.join(', ')}`);
            render();
        };
        // Aus der Übersicht angetippt: sofort öffnen
        const openNow = item => {
            mode.queue = mode.queue.filter(q => q.key !== item.key);
            markOpened(item);
            note(`→ ${item.label} (von Hand)`);
            mode.expectUrl = item.url;
            mode.manualUrl = item.url;
            lastOpen = Date.now();
            render();
            if (typeof window.lightboxOpen === 'function') window.lightboxOpen(item.url);
        };
        let blockedSince = 0;
        const processQueue = () => {
            if (!mode.active || mode.starting || typeof window.lightboxOpen !== 'function') return;
            if (!mode.pendingUrl && !mode.queue.length) return (blockedSince = 0);
            if (windowOpen()) {
                // Hängt die Warteschlange lange an einem Fenster, steht im Protokoll, an welchem
                const frame = blockingFrame();
                if (!blockedSince) blockedSince = Date.now();
                else if (Date.now() - blockedSince > 30000) {
                    blockedSince = Date.now();
                    note(`… wartet, weil ein Fenster offen ist${frame ? ` (${new URL(frame.getAttribute('src') || '', location.origin).pathname})` : ''}`);
                }
                return;
            }
            blockedSince = 0;
            const url = mode.pendingUrl || mode.takeNext().url;
            mode.pendingUrl = null;
            mode.expectUrl = url;
            lastOpen = Date.now();
            window.lightboxOpen(url);
        };
        mode.stop = () => {
            mode.active = false;
            mode.queue = [];
            mode.pendingUrl = null;
            note('Modus gestoppt');
            render();
        };

        const missionItem = (id, reason, missing) => {
            const labels = { backlog: 'offen', new: 'neu', escalation: 'Nachalarmierung', manual: 'von Hand' };
            return {
                key: `m${id}`,
                sig: reason === 'escalation' ? `m${id}|${JSON.stringify(missing)}` : reason === 'manual' ? `m${id}|hand|${Date.now()}` : `m${id}|start`,
                url: `/missions/${id}`,
                type: 'mission',
                id: String(id),
                missing,
                priority: reason === 'escalation' ? 1 : 2,
                at: Date.now(),
                label: `${nameOf(id)} (${labels[reason]})`,
            };
        };
        // Neue fehlende Fahrzeuge, die beim letzten Öffnen noch nicht gefehlt haben?
        const missingGrew = (id, missing) => {
            const before = mode.opened_missing[`m${id}`] || {};
            return Object.entries(missing).some(([name, count]) => count > (before[name] || 0));
        };

        // Neuer Stand eines Einsatzes (aus Meldung oder Abgleich): entscheidet, ob er in die Warteschlange kommt.
        // „decided“: Ob der Einsatz neu ist, wurde schon entschieden (sonst fällt die Entscheidung, sobald die Liste feststeht).
        const update = (cur, source) => {
            const prev = missions.get(cur.id);
            if (prev) {
                // Fehlende Angaben aus dem alten Stand übernehmen (der Abgleich kennt z. B. weder Typ noch Erstellungszeit)
                ['list', 'created', 'type', 'name'].forEach(key => (cur[key] = cur[key] || prev[key]));
                if (cur.state === null || cur.state === undefined) cur.state = prev.state;
                cur.decided = prev.decided;
            }
            missions.set(cur.id, cur);
            if (!mode.active || !cur.list) return;
            const name = cur.name || `Einsatz ${cur.id}`;
            const firstSight = !cur.decided;
            cur.decided = true;
            if (!listAllowed(cur.list)) {
                if (firstSight) note(`übersprungen (${{ alliance: 'Verbandseinsatz', planned: 'geplanter Einsatz', other: 'andere Liste' }[cur.list] || cur.list}): ${name}`);
                return;
            }
            // Alles da und nichts fehlt: wartende Einträge zu diesem Einsatz sind erledigt
            if (cur.state === 2 && !cur.missing) {
                delete mode.waiting[cur.id];
                return drop(`m${cur.id}`, `${name} ist versorgt`);
            }
            if (firstSight) {
                if (!isNew(cur)) return note(`nicht neu (gab es schon vorher): ${name}`);
                if (settings.dispatchNew) enqueue(missionItem(cur.id, 'new', parseMissing(cur.missing)));
                return;
            }
            if (!settings.dispatchEscalation || !prev) return;
            const missing = effectiveMissing(cur.id, parseMissing(cur.missing));
            const spread = prev.type && cur.type && cur.type !== prev.type && !/^undefined/.test(prev.type);
            if ((cur.missing && cur.missing !== prev.missing && Object.keys(missing).length && missingGrew(cur.id, missing)) || spread) {
                enqueue(missionItem(cur.id, 'escalation', spread ? Object.assign({ Ausbreitung: Date.now() }, missing) : missing));
            }
        };

        hookGame('missionMarkerAdd', marker => {
            if (!marker || marker.id === undefined) return;
            if (marker.created_at) (shared.missionCreated = shared.missionCreated || {})[String(marker.id)] = marker.created_at;
            const cur = recordFromMarker(marker);
            // Liste noch unbekannt (Meldung ohne Besitzer): aus der Einsatzliste, sobald der Eintrag da ist
            if (!cur.list) cur.list = panelList(panelOf(cur.id));
            update(cur, 'marker');
        });
        hookGame('missionDelete', id => {
            missions.delete(String(id));
            delete mode.waiting[String(id)];
            drop(`m${id}`, `${nameOf(id)} beendet`);
        });

        // Abgleich mit der Einsatzliste: holt nach, was über Meldungen nicht ankam (neue Einträge, fehlende Listenzuordnung, „versorgt“)
        const scan = () => {
            if (!mode.active) return;
            document.querySelectorAll('#missions-panel-body .missionSideBarEntry').forEach(panel => {
                if (panel.classList.contains('mission_deleted')) return;
                const id = panel.getAttribute('mission_id') || panel.id.replace('mission_', '');
                const prev = missions.get(id);
                const cur = recordFromPanel(id, panel);
                if (!prev) return update(cur, 'scan');
                // Aus Meldungen bekannt, aber noch nicht entschieden (Liste fehlte): jetzt mit der Liste aus der Einsatzliste
                if (!prev.decided) return update(Object.assign({}, prev, { list: prev.list || cur.list }), 'scan');
                // Aus Meldungen bekannt: deren Angaben sind genauer – hier nur „versorgt“ nachziehen
                if (prev.type) {
                    if (cur.state === 2 && !cur.missing && prev.state !== 2) update(Object.assign({}, prev, { state: 2, missing: '' }), 'scan');
                    return;
                }
                // Nur aus der Liste bekannt: Liste mit Liste vergleichen (gleiches Textformat)
                if (prev.state !== cur.state || prev.missing !== cur.missing) update(cur, 'scan');
            });
        };
        setInterval(scan, 2000);

        // Fahrzeugtyp eines unbekannten (z. B. neu gekauften) Fahrzeugs einzeln nachfragen
        const typeOf = async id => {
            if (mode.vehicleType[id] !== undefined) return mode.vehicleType[id];
            const vehicle = await fetchJson(`/api/vehicles/${id}`).catch(() => null);
            if (vehicle && vehicle.vehicle_type !== undefined) mode.vehicleType[id] = vehicle.vehicle_type;
            return mode.vehicleType[id];
        };
        hookGame('radioMessage', async message => {
            if (!message || message.type !== 'vehicle_fms' || message.user_id !== window.user_id) return;
            const was = mode.fms[message.id];
            mode.fms[message.id] = message.fms_real;
            setDriving(message.id, message.fms_real === 3 ? message.mission_id : null);
            if (message.fms_real === 3 && mode.vehicleType[message.id] === undefined) typeOf(message.id);
            if (message.fms_real !== 5) drop(`v${message.id}`);
            // Ein Sprechwunsch zählt einmal, bis das Fahrzeug Status 5 wieder verlässt
            if (message.fms_real === 5 && was !== 5 && mode.active && settings.dispatchTransport) {
                enqueue({ key: `v${message.id}`, sig: `v${message.id}|${Date.now()}`, url: `/vehicles/${message.id}`, type: 'vehicle', id: message.id, priority: 0, at: Date.now(), label: `Sprechwunsch ${message.caption || message.id}` });
            }
            // Fahrzeug frei (Status 1/2): wartende Einsätze, denen genau dieser Typ fehlte, wieder öffnen
            if (!mode.active || (message.fms_real !== 1 && message.fms_real !== 2) || !Object.keys(mode.waiting).length) return;
            const type = await typeOf(message.id);
            if (type === undefined) return note(`Fahrzeugtyp unbekannt: ${message.caption || message.id}`);
            Object.entries(mode.waiting).forEach(([missionId, wait]) => {
                if (!wait.types.has(type)) return;
                const panel = panelOf(missionId);
                if (panel && panel.classList.contains('mission_deleted')) return delete mode.waiting[missionId];
                delete mode.waiting[missionId];
                const item = missionItem(missionId, 'escalation', {});
                item.sig = `m${missionId}|frei|${Date.now()}`;
                item.label = `${nameOf(missionId)} (${message.caption || 'Fahrzeug'} frei für ${wait.labels.join(', ')})`;
                enqueue(item);
            });
        });

        // Wird ein Fenster geschlossen, kommt das nächste dran
        hookGame('lightboxClose', () => setTimeout(processQueue, 100));
        setInterval(processQueue, 1000);
        let watchTimer = 0;
        new MutationObserver(() => {
            if (!mode.active || watchTimer) return;
            watchTimer = setTimeout(() => ((watchTimer = 0), processQueue()), 150);
        }).observe(document.body, { childList: true });

        const start = async () => {
            mode.active = true;
            // Erst alles einsammeln (offene Einsätze und Sprechwünsche), dann in der richtigen Reihenfolge öffnen
            mode.starting = true;
            mode.queue = [];
            mode.opened = new Set();
            mode.opened_missing = {};
            mode.waiting = {};
            note('Modus gestartet');
            scan();
            if (settings.dispatchBacklog) {
                // Offen: rot oder mit fehlenden Fahrzeugen – in der Reihenfolge der Einsatzliste, dann der Rest
                const order = Array.from(document.querySelectorAll('#missions-panel-body .missionSideBarEntry')).map(p => p.getAttribute('mission_id') || p.id.replace('mission_', ''));
                const ids = order.concat(Array.from(missions.keys()).filter(id => !order.includes(id)));
                ids.forEach(id => {
                    const rec = missions.get(id);
                    const panel = panelOf(id);
                    if (!rec || !listAllowed(rec.list || panelList(panel)) || (panel && (panel.style.display === 'none' || panel.classList.contains('mission_deleted')))) return;
                    if (rec.state === 0 || (rec.state !== 2 && rec.missing)) enqueue(missionItem(id, 'backlog', parseMissing(rec.missing)));
                });
            }
            const vehicles = await fetchJson('/api/vehicles').catch(() => []);
            driving.clear();
            (Array.isArray(vehicles) ? vehicles : []).forEach(v => {
                mode.fms[v.id] = v.fms_real;
                mode.vehicleType[v.id] = v.vehicle_type;
                if (v.fms_real === 3 && v.target_type === 'mission' && v.target_id) setDriving(v.id, v.target_id);
                if (v.fms_real === 5 && settings.dispatchTransport) enqueue({ key: `v${v.id}`, sig: `v${v.id}|start`, url: `/vehicles/${v.id}`, type: 'vehicle', id: v.id, priority: 0, at: Date.now(), label: `Sprechwunsch ${v.caption}` });
            });
            note(`${mode.queue.length} Einträge zum Start`);
            mode.starting = false;
            render();
            processQueue();
        };
        button.addEventListener('click', e => {
            e.preventDefault();
            if (mode.active) mode.stop();
            else start();
        });
        render();
        const selections = document.querySelectorAll('.missions-panel-main .mission_selection');
        const anchor = selections[selections.length - 1];
        if (anchor) anchor.after(wrap);
        else document.getElementById('missions-panel-body').before(wrap);
    }

    // Leitstellen-Modus im Fenster: Leiste, Tasten und Knöpfe
    function dispatchWindow() {
        if (!inFrame) return;
        let mode;
        try {
            mode = window.top.LSSHelperShared && window.top.LSSHelperShared.dispatch;
        } catch (e) {
            return;
        }
        if (!mode || !mode.active) return;
        const note = text => mode.note && mode.note(text);
        // Navigieren und dabei merken, welche Seite der Modus erwartet
        const go = (url, replace) => {
            mode.expectUrl = url;
            if (replace) location.replace(url);
            else location.href = url;
        };
        const close = () => {
            if (typeof window.tellParent === 'function') window.tellParent('lightboxClose();');
            else if (window.top.lightboxClose) window.top.lightboxClose();
        };
        const forward = reason => {
            const next = mode.takeNext();
            if (reason) note(reason);
            if (next) go(next.url, true);
            else close();
        };
        // Nach dem Alarmieren: zum vorgemerkten Ziel (z. B. Sprechwunsch) weiter
        if (mode.pendingUrl) {
            const url = mode.pendingUrl;
            mode.pendingUrl = null;
            return go(url, true);
        }
        const isMission = /^\/missions\/\d+/.test(location.pathname);
        const isVehicle = /^\/vehicles\/\d+/.test(location.pathname);
        if (isVehicle) mode.vehicleSeenAt = Date.now();
        // Nach der Krankenhaus-/Zellenwahl leitet das Spiel teils auf den Einsatz um – der ist aber nicht dran
        let referrer = '';
        try {
            referrer = new URL(document.referrer || 'about:blank', location.origin).pathname;
        } catch (e) {
            /* ohne Herkunft */
        }
        if (isMission && /^\/vehicles\/\d+/.test(referrer) && mode.expectUrl !== location.pathname && Date.now() - (mode.vehicleSeenAt || 0) < 5 * 60 * 1000) {
            return forward('Umleitung nach Sprechwunsch übersprungen');
        }
        addStyles();
        const flash = text => {
            info.textContent = text;
            info.classList.add('lsshelper-dispatch-warn');
            setTimeout(() => ((info.classList.remove('lsshelper-dispatch-warn')), update()), 2500);
        };
        const missionId = (location.pathname.match(/^\/missions\/(\d+)/) || [])[1];
        const rememberUnmet = async () => {
            if (!missionId) return;
            const unmet = await unmetDemands().catch(() => []);
            mode.waitFor(missionId, unmet);
        };
        const skip = async () => {
            await rememberUnmet();
            const next = mode.takeNext();
            if (next) go(next.url);
            else close();
        };
        const alarmNext = async () => {
            const alarm = document.getElementById('mission_alarm_btn');
            if (!isMission || !alarm) return skip();
            if (!document.querySelector('.vehicle_checkbox:checked')) return flash('Kein Fahrzeug angehakt – erst auswählen (oder überspringen).');
            // Teilalarm: was danach noch fehlt und nicht frei ist, kommt auf die Warteliste
            await rememberUnmet();
            const next = mode.takeNext();
            const field = document.getElementById('next_mission_id');
            // Nächster Einsatz: über das Feld des Spiels; sonst (Sprechwunsch) nach dem Alarmieren selbst hinspringen
            if (next && next.type === 'mission' && field) {
                field.value = next.id;
                mode.expectUrl = next.url;
            } else if (next) mode.pendingUrl = next.url;
            alarm.click();
        };
        // Nur im Verband freigeben (ohne Alarm) und weiter
        let sharing = false;
        const shareNext = async () => {
            const id = (location.pathname.match(/^\/missions\/(\d+)/) || [])[1];
            if (!id || sharing) return;
            sharing = true;
            info.textContent = 'Gebe im Verband frei …';
            const response = await fetch(`/missions/${id}/alliance`, { credentials: 'same-origin' }).catch(() => null);
            sharing = false;
            if (!response || !response.ok) return flash('Freigeben hat nicht geklappt – bitte im Spiel prüfen.');
            const next = mode.takeNext();
            if (next) go(next.url);
            else close();
        };
        const stop = () => {
            mode.stop();
            bar.remove();
        };

        const bar = document.createElement('div');
        bar.id = 'lsshelper-dispatch-bar';
        const info = document.createElement('span');
        info.className = 'lsshelper-dispatch-info';
        const update = () => {
            const waiting = Object.keys(mode.waiting || {}).length;
            info.textContent = `🚨 Leitstellen-Modus · ${mode.count()} offen${waiting ? ` · ${waiting} warten auf Fahrzeuge` : ''}`;
        };
        update();
        setInterval(update, 2000);
        bar.append(info);
        const key = k => (k ? ` (${k.toUpperCase()})` : '');
        if (settings.dispatchButtons) {
            const add = (text, cls, onTap) => {
                const btn = document.createElement('a');
                btn.href = '#';
                btn.className = `btn btn-sm ${cls}`;
                btn.textContent = text;
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    onTap();
                });
                bar.append(btn);
            };
            if (isMission) add(`AAO${key(settings.hotkey)}`, 'btn-default', () => triggerHotkey());
            if (isMission) add(`Alarm & weiter${key(settings.dispatchKeyNext)}`, 'btn-success', alarmNext);
            if (isMission) add(`Verband & weiter${key(settings.dispatchKeyShare)}`, 'btn-primary', shareNext);
            add(`Überspringen${key(settings.dispatchKeySkip)}`, 'btn-default', skip);
            add('■', 'btn-danger', stop);
        }
        document.body.prepend(bar);

        const handled = e => !e.ctrlKey && !e.metaKey && !e.altKey && e.key && !typingIn(e.target);
        const onKey = k => {
            if (settings.dispatchKeyNext && k === settings.dispatchKeyNext && isMission) return alarmNext(), true;
            if (settings.dispatchKeySkip && k === settings.dispatchKeySkip) return skip(), true;
            if (settings.dispatchKeyShare && k === settings.dispatchKeyShare && isMission) return shareNext(), true;
            return false;
        };
        window.LSSHelper.dispatchKey = onKey;
        document.addEventListener(
            'keydown',
            e => {
                if (handled(e) && onKey(e.key.toLowerCase())) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            },
            true
        );

        // Kein einziges passendes Fahrzeug frei: gleich überspringen (nicht bei von Hand geöffneten Einsätzen)
        const manual = mode.manualUrl === location.pathname;
        mode.manualUrl = null;
        if (isMission && settings.dispatchAutoSkip && !manual) {
            (async () => {
                // Warten, bis die Markierung gerechnet hat (höchstens 5 Sekunden)
                for (let i = 0; i < 25 && !hotkeyReady; i++) await sleep(200);
                const status = await demandStatus().catch(() => ({ open: [], unmet: [], known: false }));
                if (lastUnknownNames.length) note(`Fahrzeugname nicht zugeordnet: ${lastUnknownNames.map(n => `„${n}“`).join(', ')}`);
                if (document.querySelector('.vehicle_checkbox:checked')) return;
                // Laut Markierung fehlt nichts mehr (alles alarmiert bzw. auf Anfahrt): nicht aufhalten, nicht auf die Warteliste
                if (status.known && !status.open.length && !lastExtraMissing) {
                    info.textContent = 'Nichts mehr nötig – alles alarmiert oder auf Anfahrt – weiter …';
                    note('übersprungen, nichts mehr nötig (alles alarmiert oder auf Anfahrt)');
                    await sleep(700);
                    return skip();
                }
                if (!status.open.length || status.unmet.length < status.open.length) return;
                info.textContent = `Nichts frei (${status.unmet.map(u => u.label).join(', ')}) – überspringe …`;
                note(`automatisch übersprungen, nichts frei: ${status.unmet.map(u => u.label).join(', ')}`);
                await sleep(700);
                skip();
            })();
        }
    }

    // Hauptseite im Spielfenster (passiert nach manchen Weiterleitungen): weiter zum nächsten Eintrag bzw. Fenster schließen
    function homeInFrame() {
        if (!inFrame) return;
        let top;
        try {
            top = window.top;
            if (top.location.pathname !== '/' || typeof top.lightboxClose !== 'function') return;
        } catch (e) {
            return;
        }
        const mode = top.LSSHelperShared && top.LSSHelperShared.dispatch;
        if (mode && mode.active) {
            const url = mode.pendingUrl || (mode.queue.length ? mode.takeNext().url : null);
            mode.pendingUrl = null;
            if (mode.note) mode.note('Hauptseite im Fenster – weiter');
            if (url) {
                mode.expectUrl = url;
                return location.replace(url);
            }
        }
        top.lightboxClose();
    }

    // Hauptfenster: Tasten des Modus ans offene Fenster weiterreichen (der Fokus liegt oft hier)
    function dispatchKeyRelay() {
        if (inFrame) return;
        document.addEventListener(
            'keydown',
            e => {
                const mode = shared.dispatch;
                if (!mode || !mode.active || e.ctrlKey || e.metaKey || e.altKey || !e.key || typingIn(e.target)) return;
                const k = e.key.toLowerCase();
                if (![settings.dispatchKeyNext, settings.dispatchKeySkip, settings.dispatchKeyShare].includes(k)) return;
                const done = Array.from(document.querySelectorAll('iframe')).some(frame => {
                    try {
                        const inner = frame.contentWindow;
                        return frame.getClientRects().length > 0 && inner.LSSHelper && inner.LSSHelper.dispatchKey && inner.LSSHelper.dispatchKey(k);
                    } catch (err) {
                        return false;
                    }
                });
                if (done) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            },
            true
        );
    }

    // Prüfanzeige für die Einstellungen: was der Modus in der Einsatzliste erkennt
    function dispatchDiagnoseButton() {
        const wrap = dashEl('div', 'lsshelper-set-intro');
        const out = dashEl('pre', 'lsshelper-set-diag');
        out.hidden = true;
        wrap.append(
            dashButton('Prüfanzeige', '', () => {
                const lines = [];
                const hooks = ['missionMarkerAdd', 'missionDelete', 'radioMessage', 'lightboxOpen', 'lightboxClose'].map(name => `${name} ${typeof window[name] === 'function' ? '✓' : '✗'}`);
                lines.push(`Spielfunktionen: ${hooks.join(' · ')}`);
                const panels = Array.from(document.querySelectorAll('#missions-panel-body .missionSideBarEntry'));
                const byList = {};
                panels.forEach(panel => {
                    const list = panel.parentElement ? panel.parentElement.id : '?';
                    const entry = (byList[list] = byList[list] || { total: 0, red: 0, yellow: 0, green: 0, unknown: 0, missing: 0 });
                    entry.total++;
                    const state = panelState(panel);
                    entry[state === 0 ? 'red' : state === 1 ? 'yellow' : state === 2 ? 'green' : 'unknown']++;
                    if (panelMissing(panel)) entry.missing++;
                });
                if (!panels.length) lines.push('Keine Einsätze gefunden (die Prüfung im Hauptfenster öffnen).');
                Object.entries(byList).forEach(([list, e]) =>
                    lines.push(`${list} → ${DISPATCH_LISTS[list] || 'unbekannt'}: ${e.total} Einsätze · rot ${e.red} · gelb ${e.yellow} · grün ${e.green} · Status unbekannt ${e.unknown} · mit fehlenden Fahrzeugen ${e.missing}`)
                );
                const example = panels[0];
                if (example) lines.push(`Beispiel-Klassen: ${(example.querySelector('[class*="panel"]') || example).className}`);
                const mode = shared.dispatch;
                lines.push(`Modus: ${mode && mode.active ? `aktiv, ${mode.queue.length} offen` : 'aus'}`);
                if (mode && mode.waiting) Object.entries(mode.waiting).forEach(([id, wait]) => lines.push(`⏳ Einsatz ${id} wartet auf ${wait.labels.join(', ')}`));
                if (mode && mode.log.length) lines.push('Letzte Ereignisse:', ...mode.log.slice(0, 15));
                out.textContent = lines.join('\n');
                out.hidden = false;
            }),
            out
        );
        return wrap;
    }

    /* ------------------------------------------------------------------ *
     * Werkzeug: Tagescheck – was gerade Aufmerksamkeit braucht
     * ------------------------------------------------------------------ */

    // Erstellungszeit der Einsätze: aus den Startdaten der Seite (missionMarkerAdd({...}) im Seitenquelltext) und aus späteren Meldungen
    function missionCreatedTimes() {
        const times = Object.assign({}, shared.missionCreated || {});
        pageMarkers().forEach(marker => {
            if (marker.id && marker.created_at) times[String(marker.id)] = times[String(marker.id)] || marker.created_at;
        });
        return times;
    }

    async function renderCheckTool(ctx) {
        ctx.status('Lese Gebäude und Fahrzeuge …');
        const { buildings, vehicles } = await loadBasics();
        const buildingById = Object.fromEntries(buildings.map(b => [b.id, b]));
        const where = v => (buildingById[v.building_id] ? buildingById[v.building_id].caption : '');
        // Spielfenster öffnen: Dashboard schließen, damit das Fenster sichtbar ist
        const open = (text, href, detail) => {
            const row = dashEl('div', 'lsshelper-check-row');
            const link = dashEl('a', 'lsshelper-dash-link', text);
            link.href = href;
            link.addEventListener('click', e => {
                if (typeof window.lightboxOpen !== 'function') return;
                e.preventDefault();
                ctx.close();
                window.lightboxOpen(href);
            });
            row.append(link);
            if (detail) row.append(dashEl('small', '', detail));
            return row;
        };
        const ok = [];
        const checks = [];
        // level: 'bad' = jetzt erledigen, 'warn' = demnächst, 'info' = zur Kenntnis
        const add = (title, level, rows, hint) => (rows.length ? checks.push({ title, level, rows, hint }) : ok.push(title));

        if (settings.tcCrew) {
            const short = vehicles.filter(v => {
                const min = (STAFF[v.vehicle_type] || [0, 0])[0];
                return min > 0 && (v.assigned_personnel_count || 0) < min && v.fms_real !== 6;
            });
            add('Fahrzeuge ohne genug Personal', 'bad', short.map(v => open(v.caption, `/vehicles/${v.id}/zuweisung`, `${v.assigned_personnel_count || 0} von mind. ${STAFF[v.vehicle_type][0]} · ${where(v)}`)), 'Antippen öffnet die Personalzuweisung.');
        }
        if (settings.tcTransport) {
            add('Offene Sprechwünsche', 'bad', vehicles.filter(v => v.fms_real === 5).map(v => open(v.caption, `/vehicles/${v.id}`, where(v))));
        }
        if (settings.tcExpiring) {
            const times = missionCreatedTimes();
            const last2am = new Date();
            last2am.setUTCHours(2, 0, 0, 0);
            if (Date.now() < last2am) last2am.setUTCDate(last2am.getUTCDate() - 1);
            const panels = Array.from(document.querySelectorAll('#mission_list .missionSideBarEntry')).filter(p => p.style.display !== 'none' && !p.classList.contains('mission_deleted'));
            const known = panels.filter(p => times[p.getAttribute('mission_id')]);
            const expiring = known.filter(p => {
                const created = times[p.getAttribute('mission_id')];
                // created_at kommt als Unix-Sekunden oder als Zeitstempel-Text
                const date = typeof created === 'number' ? new Date(created < 1e12 ? created * 1000 : created) : new Date(created);
                return !isNaN(date) && date < last2am;
            });
            if (panels.length && !known.length) {
                checks.push({ title: 'Einsätze, die heute Nacht verfallen', level: 'info', rows: [dashEl('div', 'lsshelper-dash-empty', 'Das Spiel liefert hier keine Erstellungszeiten – dieser Punkt lässt sich nicht prüfen.')] });
            } else {
                add('Einsätze, die heute Nacht verfallen', 'bad', expiring.map(p => {
                    const caption = p.querySelector('[id^="mission_caption_"]');
                    return open(caption ? caption.textContent.trim() : `Einsatz ${p.getAttribute('mission_id')}`, `/missions/${p.getAttribute('mission_id')}`);
                }), 'Nur Einsätze aus deiner eigenen Liste.');
            }
        }
        const extensions = buildings.flatMap(b => (b.extensions || []).map(ext => ({ b, ext })));
        if (settings.tcExtInactive) {
            add('Gebaute, aber inaktive Ausbauten', 'warn', extensions.filter(({ ext }) => ext.available && ext.enabled === false).map(({ b, ext }) => open(b.caption, `/buildings/${b.id}`, ext.caption)));
        }
        if (settings.tcExtSoon) {
            const soon = extensions.filter(({ ext }) => !ext.available && ext.available_at && new Date(ext.available_at) - Date.now() < 24 * 3600 * 1000);
            add('Ausbauten, die in 24 Stunden fertig werden', 'info', soon.sort((x, y) => new Date(x.ext.available_at) - new Date(y.ext.available_at)).map(({ b, ext }) => open(b.caption, `/buildings/${b.id}`, `${ext.caption} · ${new Date(ext.available_at).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`)));
        }
        if (settings.tcLeitstelle) {
            add('Gebäude ohne Leitstelle', 'warn', planLeitstellen(buildings).map(c => open(c.building.caption, `/buildings/${c.building.id}`, `Vorschlag: ${c.target.caption} (im Reiter „Wachen“ übernehmen)`)));
        }
        if (settings.tcStatus6) {
            const byBuilding = {};
            vehicles.filter(v => v.fms_real === 6).forEach(v => (byBuilding[v.building_id] = byBuilding[v.building_id] || []).push(v));
            const many = Object.entries(byBuilding).filter(([, list]) => list.length >= Math.max(1, settings.tcStatus6Min));
            add('Wachen mit vielen Fahrzeugen in Status 6', 'info', many.sort((a, b) => b[1].length - a[1].length).map(([id, list]) => open(buildingById[id] ? buildingById[id].caption : `Gebäude ${id}`, `/buildings/${id}`, `${list.length} außer Dienst: ${list.map(v => v.caption).join(', ')}`)));
        }

        const order = { bad: 0, warn: 1, info: 2 };
        checks.sort((a, b) => order[a.level] - order[b.level]);
        const urgent = checks.filter(c => c.level === 'bad').reduce((sum, c) => sum + c.rows.length, 0);
        ctx.status(urgent ? `${urgent} Punkte zum Erledigen · Stand ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : `Nichts Dringendes · Stand ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`);
        const COUNT_CLASS = { bad: '', warn: 'lsshelper-dash-count-warn', info: 'lsshelper-dash-count-info' };
        checks.forEach(check => {
            const card = dashCard(ctx.body, check.title, check.rows.length, COUNT_CLASS[check.level]);
            if (check.hint) card.append(dashEl('div', 'lsshelper-dash-empty', check.hint));
            // Lange Listen gekürzt, Rest auf Antippen
            const LIMIT = 8;
            check.rows.slice(0, LIMIT).forEach(row => card.append(row));
            if (check.rows.length > LIMIT) {
                const more = dashButton(`alle ${check.rows.length} zeigen`, 'lsshelper-btn-quiet', () => {
                    check.rows.slice(LIMIT).forEach(row => more.before(row));
                    more.remove();
                });
                card.append(more);
            }
        });

        // Lehrgänge: braucht die Personallisten, daher erst auf Wunsch
        if (settings.tcTrainings) {
            const card = dashCard(ctx.body, 'Fehlende Lehrgänge');
            const body = dashEl('div', 'lsshelper-dash-empty', 'Liest die Personallisten aller Wachen mit Lehrgangsfahrzeugen.');
            card.append(body);
            card.head.append(
                dashButton('Prüfen', '', async btn => {
                    btn.classList.add('lsshelper-btn-busy');
                    const plan = await ctx.fleet();
                    const training = plan.changes.filter(c => c.kind === 'training');
                    body.remove();
                    btn.remove();
                    if (!training.length) card.append(dashEl('div', 'lsshelper-dash-empty', '✓ Alle Wachen haben genug ausgebildetes Personal.'));
                    training.forEach(c => card.append(open(c.station.building.caption, `/buildings/${c.station.building.id}`, c.text)));
                    ctx.status(`${training.length} Wachen brauchen Lehrgänge.`);
                })
            );
        }

        if (ok.length) {
            const card = dashCard(ctx.body, 'In Ordnung', ok.length, 'lsshelper-dash-count-ok');
            ok.forEach(title => card.append(dashEl('div', 'lsshelper-dash-empty', `✓ ${title}: nichts zu tun`)));
        }
        ctx.body.append(
            dashButton('Neu prüfen', 'lsshelper-btn-quiet', () => {
                forgetFleet();
                ctx.open('check');
            })
        );
    }

    /* ------------------------------------------------------------------ *
     * Feature-Register: neue Features hier eintragen
     * ------------------------------------------------------------------ */

    const FEATURES = [
        // Einsatzdaten im Hauptfenster vorladen, damit Einsatzfenster nicht warten müssen
        { name: 'preloadMissions', match: /^\/$/, run: getMissions },
        { name: 'refreshVehicleData', match: /^\/$/, run: refreshVehicleData },
        { name: 'hotkeyRelay', match: /^\/$/, run: hotkeyRelay },
        { name: 'aaoHighlight', match: /^\/missions\/\d+/, run: aaoHighlightLive },
        { name: 'aaoCreate', match: /^\/aaos\/new\/?$/, run: aaoCreate },
        { name: 'dashboardButton', match: /^\/($|buildings\/\d+\/?$)/, run: dashboardButton },
        { name: 'aaoSaved', match: /^\/aaos(\/|$)/, run: aaoSaved },
        { name: 'nextTransport', match: /^\/vehicles\/\d+/, run: nextTransport },
        { name: 'dispatchMain', match: /^\/$/, run: dispatchMain },
        { name: 'dispatchKeyRelay', match: /^\/$/, run: dispatchKeyRelay },
        { name: 'dispatchWindow', match: /^\/(missions|vehicles)\/\d+\/?$/, run: dispatchWindow },
        { name: 'homeInFrame', match: /^\/$/, run: homeInFrame },
        { name: 'buildingInfo', match: /^\/buildings\/\d+\/?$/, run: buildingInfo },
    ];

    window.LSSHelper = { features: Object.fromEntries(FEATURES.map(f => [f.name, f.run])), getMissions, demandForName, nameVariants, nameScore, planFleet, openDashboard, hotkey: triggerHotkey, applyChange: change => APPLY[change.kind](change), rerun: () => (clearMarks(), aaoHighlight()) };

    FEATURES.filter(f => f.match.test(location.pathname)).forEach(f => {
        try {
            Promise.resolve(f.run()).catch(e => console.error(`[LSS Helper] ${f.name}`, e));
        } catch (e) {
            console.error(`[LSS Helper] ${f.name}`, e);
        }
    });
})();
