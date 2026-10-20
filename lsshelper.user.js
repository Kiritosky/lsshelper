// ==UserScript==
// @name         LSS Helper
// @namespace    lsshelper
// @version      0.23.0
// @description  Helfer für das Leitstellenspiel: markiert passende AAOs, legt AAOs an, prüft sie, passt die Fahrzeugbesatzung einer Wache ans Personal an und bietet zuschaltbare Manager-Funktionen (z. B. fürs iPad).
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
    const CACHE_KEY = 'lsshelper_missions_v7';
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
        crewButton: true,
        pulse: true,
        colorName: '#ff00d4',
        colorVehicles: '#00e5ff',
        minChance: 50,
        hotkey: 'y',
        // Manager-Funktionen (Ersatz für einige LSS-Manager-Module, z. B. auf dem iPad); alles hängt am Hauptschalter
        manager: false,
        touchButtons: true,
        touchLarge: true,
        mlCredits: true,
        mlRemaining: true,
        mlRemainingGreen: true,
        mlPatients: true,
        mlHideZero: true,
        mlPatientTime: true,
        mlPumpTime: true,
        mlStar: true,
        mlCollapse: true,
        mlSort: true,
        mlSortWindow: true,
        mlShare: false,
        mlShareMin: 0,
        mlEvents: true,
        mwCredits: true,
        mwGenerated: true,
        mwGeneratedYellow: 12,
        mwExpireRed: true,
        mwPatientSummary: true,
        mwCollapsePatients: 8,
        mwPatientTime: true,
        mwCounters: true,
        mwStickyHeader: true,
        mwLoadInHeader: true,
        mwHideVehicleList: false,
        mwCenterMap: true,
        mwVehicleType: true,
        mwAlarmTime: true,
        mwReset: true,
        mwStagingCounter: true,
        cxMenu: true,
        cxCreditsInNav: true,
        cxToplist: true,
        cxAllianceFunds: true,
        cxGoals: '',
        cxGoalBar: false,
        dcSummary: true,
        dcAverage: true,
        cxHistory: true,
        cxHistoryDays: 7,
        mlEventList: '🇪🇺: 704, 705, 706, 707, 708; ❄️: 53, 428, 581, 665, 677, 787, 788, 789, 793, 794, 795, 831, 861, 861/a, 861/b, 861/ab, 862, 862/a; 🌞: 183, 184, 185, 461, 546, 546/a, 547, 548, 646, 647, 648, 754, 863, 863/a; 🌹: 360, 361, 362, 363, 364, 365, 597, 598, 599, 600, 601, 602, 603, 604, 605, 790, 791, 792, 833, 834, 917, 918, 919, 920; 🌼: 722, 723, 724, 725, 726, 727, 728, 729, 730, 965; 🍂: 672, 673, 674, 675, 676, 677, 678, 679, 680; 🍺: 88, 216, 217, 218, 219, 220, 452, 453, 454, 456, 457, 626, 627, 628, 629, 629/a, 630, 844, 845, 846; 🎃: 111, 112, 113, 114, 115, 116, 116/a, 117, 118, 118/a, 119, 943, 944, 945, 946; 🎅: 52, 54, 55, 56, 129, 130, 202, 203, 582, 583, 583/a, 584, 584/a, 584/b, 584/ab, 585, 585/a, 585/b, 585/ab, 586, 587, 588, 589, 590, 783, 784, 785, 786, 901, 911, 912, 913; 🎈: 756, 757, 758, 759, 760, 761, 762, 763, 764, 765, 766, 767, 768, 769, 770, 771, 772; 🏅: 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878; 💐: 360, 742, 743, 744, 745, 746, 747, 748, 847, 847/a; 🥅: 371, 372, 373, 374, 375, 376, 641, 642, 849, 850, 850/a, 851, 852; 🥚: 284, 285, 286, 286/a, 286/b, 286/ab, 287, 288, 289, 290, 291, 291/a, 442, 443, 444, 445, 446, 618, 618/a, 618/b, 618/ab, 732, 733, 733/a, 733/b, 733/ab, 734, 735, 735/a, 736, 737, 739, 739/a, 927, 927/a, 928, 928/a, 928/b, 928/c, 928/ab, 928/ac, 928/bc, 928/abc, 929, 929/a, 929/b, 929/ab; 🥸: 710, 711, 712, 713, 714, 715, 716, 717, 718, 719; 🧨: 259, 259-0, 260, 261, 262, 263, 264, 265, 266, 267, 268, 268/a, 269, 270, 326, 591, 695, 695/a, 695/b, 695/ab, 695-0, 695-0/a, 695-0/b, 695-0/ab, 695-1, 695-1/a, 695-1/b, 695-1/ab',
    };
    const SETTINGS_LABELS = {
        hotkey: 'Taste, die im Einsatzfenster die markierte AAO auswählt (leer = aus)',
        markName: 'AAO mit Einsatznamen markieren',
        markVehicles: 'Fahrzeug-AAOs markieren',
        subtractPresent: 'Bereits alarmierte und angehakte Fahrzeuge abziehen',
        countForeign: 'Dabei Fahrzeuge anderer Spieler mitzählen',
        showList: 'Fahrzeugliste in der Leiste anzeigen',
        openTab: 'AAO-Tab automatisch öffnen',
        createButton: 'Button „AAO anlegen“ anzeigen',
        crewButton: 'Menüeintrag und Wachen-Knopf für das Dashboard anzeigen',
        pulse: 'Markierung pulsieren lassen',
        colorName: 'Farbe Namens-Treffer',
        colorVehicles: 'Farbe Fahrzeug-AAOs',
        minChance: 'Fahrzeuge erst ab dieser Wahrscheinlichkeit (%) markieren und in neue AAOs aufnehmen',
        manager: 'Manager-Funktionen einschalten (z. B. auf dem iPad, wo der LSS-Manager nicht läuft)',
        touchButtons: 'Touch-Knöpfe im Einsatzfenster: „AAO wählen“ (wie die Taste) und „Alarmieren & weiter“',
        touchLarge: 'Größere Knöpfe und Häkchen zum Antippen',
        mlCredits: 'Ø Credits am Einsatz anzeigen',
        mlRemaining: 'Verbleibende Einsatzdauer anzeigen',
        mlRemainingGreen: '… nur bei grünen Einsätzen (alles Nötige vor Ort)',
        mlPatients: 'Zahl der Patienten und Gefangenen am Einsatz anzeigen',
        mlHideZero: '… 0 ausblenden',
        mlPatientTime: 'Restbehandlungsdauer der Patienten anzeigen',
        mlPumpTime: 'Restdauer beim Abpumpen anzeigen',
        mlStar: 'Einsätze mit Stern markieren (bleiben oben in der Liste)',
        mlCollapse: 'Einsätze einklappen (einzeln und alle auf einmal)',
        mlSort: 'Einsatzliste sortieren (Auswahl über der Liste)',
        mlSortWindow: 'Vor-/Zurück-Knöpfe im Einsatzfenster folgen der Sortierung',
        mlShare: 'Knopf zum Teilen im Verband an eigenen Einsätzen',
        mlShareMin: '… nur bei Einsätzen ab so vielen Ø Credits',
        mlEvents: 'Saison-Symbole vor dem Einsatznamen',
        mlEventList: 'Saison-Symbole: „Symbol: Einsatz-IDs; …“',
        mwCredits: 'Ø Credits neben dem Einsatznamen',
        mwGenerated: 'Generierungszeitpunkt neben der Adresse',
        mwGeneratedYellow: '… gelb umranden ab so vielen Stunden (0 = aus)',
        mwExpireRed: '… rot umranden, wenn der Einsatz in der nächsten Nacht verfällt',
        mwPatientSummary: 'Patienten-Zusammenfassung: was an Rettungsmitteln noch fehlt',
        mwCollapsePatients: 'Patienten einklappen ab so vielen Patienten (0 = nie)',
        mwPatientTime: 'Restbehandlungsdauer an den Patienten',
        mwCounters: 'Fahrzeug- und Spielerzähler (Anfahrt | vor Ort | gesamt, antippen für Details)',
        mwStickyHeader: 'Kopfleiste beim Scrollen festhalten',
        mwLoadInHeader: '„Fehlende Fahrzeuge laden“ zusätzlich in der Kopfleiste',
        mwHideVehicleList: 'Fahrzeugliste zuklappbar machen (startet zugeklappt)',
        mwCenterMap: 'Symbol zum Zentrieren der Karte auf den Einsatz',
        mwVehicleType: 'Fahrzeugtyp in der Fahrzeugauswahl anzeigen',
        mwAlarmTime: 'Längste Anfahrtszeit der ausgewählten Fahrzeuge am Alarmieren-Knopf',
        mwReset: 'Knopf „Auswahl zurücksetzen“ (hebt alle Häkchen auf)',
        mwStagingCounter: 'Zähler der ausgewählten Fahrzeuge im Bereitstellungsraum',
        cxMenu: 'Credits-Menü in der Kopfleiste (Credits, Coins, Rang, Topliste, Verbandskasse)',
        cxCreditsInNav: '… Credits statt Sparschwein anzeigen',
        cxToplist: '… Platz in der Topliste anzeigen (alle 5 Minuten aktualisiert)',
        cxAllianceFunds: '… Verbandskasse anzeigen',
        cxGoals: 'Credits-Ziele, z. B. „1000000, 5000000“ – beim Erreichen wird der Stand grün, bis du ihn antippst',
        cxGoalBar: '… Fortschrittsbalken zum nächsten Ziel',
        dcSummary: 'Tageszusammenfassung: Summen pro Kategorie, Filter und Export',
        dcAverage: '… Durchschnitt pro Buchung anzeigen',
        cxHistory: 'Dashboard-Reiter „Geld“: Einnahmen und Ausgaben der letzten Tage',
        cxHistoryDays: '… so viele Tage (1–30)',
    };
    // Aufbau der Einstellungsseite. Gruppen mit master hängen an diesem Schalter: ist er aus, wirkt keine ihrer Einstellungen.
    const SETTINGS_SECTIONS = [
        { title: 'AAO-Markierung', keys: ['markName', 'markVehicles', 'subtractPresent', 'countForeign', 'showList', 'openTab', 'createButton', 'pulse', 'colorName', 'colorVehicles', 'minChance', 'hotkey'] },
        { title: 'Dashboard', keys: ['crewButton'] },
        {
            title: 'Manager-Funktionen',
            master: 'manager',
            note: 'Nachgebaute Funktionen aus dem LSS-Manager. Am PC mit LSS-Manager ausgeschaltet lassen, damit nichts doppelt erscheint.',
            groups: [
                { title: 'Touch / iPad', keys: ['touchButtons', 'touchLarge'] },
                {
                    title: 'Einsatzfenster',
                    keys: ['mwCredits', 'mwGenerated', 'mwGeneratedYellow', 'mwExpireRed', 'mwPatientSummary', 'mwCollapsePatients', 'mwPatientTime', 'mwCounters', 'mwStickyHeader', 'mwLoadInHeader', 'mwHideVehicleList', 'mwCenterMap', 'mwVehicleType', 'mwAlarmTime', 'mwReset', 'mwStagingCounter'],
                },
                { title: 'Geld', keys: ['cxMenu', 'cxCreditsInNav', 'cxToplist', 'cxAllianceFunds', 'cxGoals', 'cxGoalBar', 'dcSummary', 'dcAverage', 'cxHistory', 'cxHistoryDays'] },
                { title: 'Einsatzliste', keys: ['mlCredits', 'mlRemaining', 'mlRemainingGreen', 'mlPatients', 'mlHideZero', 'mlPatientTime', 'mlPumpTime', 'mlStar', 'mlCollapse', 'mlSort', 'mlSortWindow', 'mlShare', 'mlShareMin', 'mlEvents', 'mlEventList'] },
            ],
        },
    ];
    // Manager-Funktion aktiv? Nur wenn der Hauptschalter an ist
    const managerOn = key => settings.manager && !!settings[key];
    const settings = Object.assign({}, DEFAULTS);
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
        Object.keys(DEFAULTS).forEach(key => {
            if (typeof saved[key] === typeof DEFAULTS[key]) settings[key] = saved[key];
        });
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
                // Durchschnittliche Credits (Manager-Funktionen: Einsatzliste, Sortierung, Teilen)
                $: e.average_credits || 0,
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
            .lsshelper-dash-savebar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
            #lsshelper-dash label.lsshelper-dash-master { font-weight: 700; }
            .lsshelper-dash-groups { margin-left: 22px; }
            .lsshelper-dash-off { opacity: 0.45; }
            #lsshelper-dash label.lsshelper-dash-row:has(textarea) { flex-direction: column-reverse; align-items: stretch; }
            #lsshelper-dash textarea.lsshelper-dash-text { width: 100%; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 12px; }
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

    // Liefert true, wenn die Taste hier etwas auslöst (auch vom Hauptfenster aus aufrufbar); der Touch-Knopf geht auch ohne Taste
    function triggerHotkey(viaTouch) {
        if (!settings.hotkey && !viaTouch) return false;
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
    const dataLabels = { req: {}, pre: {}, vehicles: {}, possible: {}, buildings: {} };

    // Stammdaten aktualisieren sich täglich, damit Neues nach einem Spiel-Update ohne Skript-Update bekannt wird:
    // Fahrzeuge (Besatzung, Lehrgänge) und Bezeichnungen aus der offenen Datenbank des LSS-Managers,
    // Lehrgangsnamen aus der offiziellen Schnittstelle des Spiels. Die Tabellen oben sind der Rückfall.
    const VEHICLE_DATA_KEY = 'lsshelper_game_data_v3';

    function applyVehicleData(data) {
        if (!data || !data.staff) return;
        ['req', 'pre', 'vehicles', 'possible', 'buildings'].forEach(key => Object.assign(dataLabels[key], data[key]));
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
        const data = { t: Date.now(), staff: {}, training: {}, names: {}, req: {}, pre: {}, vehicles: {}, possible: {}, buildings: {} };
        // Die Zusatzquellen dürfen fehlen – dann bleibt es bei den eingebauten Bezeichnungen
        await sleep(150);
        const labels = await fetch('https://api.lss-manager.de/de_DE/einsaetze').then(r => r.json()).catch(() => ({}));
        const singular = text => String(text).split('|')[0].trim();
        Object.entries(labels.requirements || {}).forEach(([key, text]) => (data.req[key] = singular(text)));
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

    function renderSettingsTool(ctx) {
        ctx.status('Einstellungen gelten ab dem nächsten geöffneten Einsatz- oder Wachenfenster.');
        // Knöpfe in einer mitlaufenden Leiste, damit man bei langen Listen nicht zurückscrollen muss
        const bar = dashEl('div', 'lsshelper-dash-savebar');
        ctx.body.append(bar);
        const inputs = [];
        const addRow = (parent, key) => {
            const row = dashEl('label', 'lsshelper-dash-row');
            // Lange Texte (z. B. Listen) als mehrzeiliges Feld
            const long = typeof DEFAULTS[key] === 'string' && DEFAULTS[key].length > 40;
            const input = dashEl(long ? 'textarea' : 'input');
            input.dataset.key = key;
            if (long) {
                input.rows = 3;
                input.className = 'lsshelper-dash-text';
            } else input.type = typeof DEFAULTS[key] === 'boolean' ? 'checkbox' : typeof DEFAULTS[key] === 'number' ? 'number' : /^#/.test(DEFAULTS[key]) ? 'color' : 'text';
            if (input.type === 'checkbox') input.checked = settings[key];
            else input.value = settings[key];
            if (key === 'hotkey') {
                input.maxLength = 1;
                input.className = 'lsshelper-dash-key';
            } else if (input.type === 'text') {
                input.className = 'lsshelper-dash-search';
            }
            row.append(input, dashEl('span', '', SETTINGS_LABELS[key]));
            parent.append(row);
            inputs.push(input);
            return input;
        };
        SETTINGS_SECTIONS.forEach(section => {
            const card = dashCard(ctx.body, section.title);
            if (section.note) card.append(dashEl('div', 'lsshelper-dash-empty', section.note));
            (section.keys || []).forEach(key => addRow(card, key));
            if (!section.master) return;
            const master = addRow(card, section.master);
            master.parentElement.classList.add('lsshelper-dash-master');
            const groups = dashEl('div', 'lsshelper-dash-groups');
            section.groups.forEach(group => {
                groups.append(dashEl('div', 'lsshelper-dash-station', group.title));
                group.keys.forEach(key => addRow(groups, key));
            });
            card.append(groups);
            // Ohne Hauptschalter sind die Unterpunkte ohne Wirkung – sichtbar bleiben sie, damit man vorab einstellen kann
            const dim = () => groups.classList.toggle('lsshelper-dash-off', !master.checked);
            master.addEventListener('change', dim);
            dim();
        });
        bar.append(
            dashEl('span', 'lsshelper-dash-spacer'),
            dashButton('Standard wiederherstellen', 'lsshelper-btn-quiet', () => {
                localStorage.removeItem(SETTINGS_KEY);
                Object.assign(settings, DEFAULTS);
                ctx.open('settings');
            }),
            dashButton('Speichern', 'lsshelper-btn-primary', () => {
                inputs.forEach(input => {
                    const key = input.dataset.key;
                    settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : key === 'hotkey' ? input.value.toLowerCase() : input.value;
                });
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                ctx.status('Gespeichert. Gilt ab dem nächsten geöffneten Einsatz- oder Wachenfenster.');
            })
        );
    }

    const DASH_TOOLS = [
        { id: 'stations', title: 'Wachen', render: renderStationsTool },
        { id: 'expansion', title: 'Fuhrpark & Ausbau', render: renderExpansionTool },
        { id: 'aao', title: 'AAO', render: renderAaoTool },
        { id: 'money', title: 'Geld', render: (...args) => renderMoneyTool(...args), when: () => managerOn('cxHistory') },
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
        // Manche Werkzeuge gibt es nur mit eingeschalteter Manager-Funktion
        const tools = DASH_TOOLS.filter(t => !t.when || t.when());
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
                const tool = tools.find(t => t.id === id) || tools[0];
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
        tools.forEach(tool => {
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
     * Manager-Funktionen: Nachbau einiger LSS-Manager-Module (Hauptschalter in den Einstellungen)
     * ------------------------------------------------------------------ */

    const inFrame = window.top !== window;

    function addManagerStyles() {
        if (document.getElementById('lsshelper-manager-style')) return;
        const style = document.createElement('style');
        style.id = 'lsshelper-manager-style';
        style.textContent = `
            #lsshelper-touch { position: fixed; right: 10px; bottom: 10px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
            #lsshelper-touch a { display: block; min-width: 128px; padding: 12px 14px; border-radius: 10px; font-size: 15px; font-weight: 700; text-align: center; color: #fff; text-decoration: none; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4); -webkit-tap-highlight-color: transparent; user-select: none; }
            #lsshelper-touch a:active { transform: scale(0.96); }
            #lsshelper-touch .lsshelper-touch-aao { background: #6a1b9a; }
            #lsshelper-touch .lsshelper-touch-next { background: #2e7d32; }
            #lsshelper-touch .lsshelper-touch-off { opacity: 0.45; }
            #missions-panel-body.lsshelper-ml-flex > [id^="mission_list"]:not([style*="display: none"]) { display: flex !important; flex-direction: column; }
            .lsshelper-ml-info { margin-left: 2px; }
            .lsshelper-ml-btns { display: inline-flex; margin-right: 3px; }
            .lsshelper-ml-event { margin-right: 4px; white-space: nowrap; }
            .lsshelper-collapsed .panel-body > *:not(:has([id^="mission_bar_outer_"], [id^="mission_overview_countdown_"])):not([id^="mission_bar_outer_"]):not([id^="mission_overview_countdown_"]) { display: none !important; }
            .lsshelper-ml-tools { display: inline-flex; gap: 4px; margin-left: 4px; vertical-align: middle; }
            .lsshelper-ml-sort { height: 22px; max-width: 170px; padding: 0 2px; font-size: 12px; color: #000; }
            .lsshelper-ml-time { display: inline-block; margin-right: 4px; font-size: 11px; }
            .lsshelper-mw-generated { padding: 0 3px; border-radius: 3px; white-space: nowrap; }
            .lsshelper-mw-yellow { border: 1px solid #e0b000; }
            .lsshelper-mw-red { border: 2px solid #d32f2f; }
            .lsshelper-mw-center { margin-right: 6px; text-decoration: none !important; cursor: pointer; }
            .lsshelper-mw-credits { font-size: 12px; vertical-align: middle; }
            .lsshelper-mw-sticky { position: sticky; top: 0; z-index: 3; }
            .lsshelper-mw-load { margin-left: 8px; }
            .lsshelper-mw-patients { margin: 4px 0; padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.5); border-radius: 4px; }
            .lsshelper-mw-counter { position: relative; margin-left: 6px; }
            .lsshelper-mw-counter .label { cursor: pointer; }
            .lsshelper-mw-counter-table { position: absolute; right: 0; z-index: 5; width: auto; min-width: 240px; max-height: 60vh; overflow: auto; display: block; background: #fff; color: #333; border: 1px solid #999; border-radius: 4px; text-transform: none; font-weight: normal; }
            .lsshelper-mw-counter-table[hidden] { display: none; }
            body.dark .lsshelper-mw-counter-table { background: #222; color: #eee; }
            .lsshelper-mw-reset, .lsshelper-mw-hide { margin-right: 4px; }
            .lsshelper-mw-alarmtime { margin-left: 4px; }
            .lsshelper-cx-menu { min-width: 300px; }
            .lsshelper-cx-menu > li { display: flex; align-items: center; gap: 4px; padding-right: 8px; }
            .lsshelper-cx-menu > li.divider { display: block; padding: 0; }
            .lsshelper-cx-menu > li > a:first-child { flex: 1; }
            .lsshelper-cx-menu .lsshelper-cx-text { padding: 3px 20px; color: #777; white-space: nowrap; }
            li.lsshelper-cx-goal > a { background: #2e7d32 !important; color: #fff !important; }
            .lsshelper-mgr-pill { display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 8px; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 10px; font-weight: 700; line-height: 15px; white-space: nowrap; vertical-align: middle; }
        `;
        // Größere Bedienelemente nur in den Fenstern (Einsatz, Fahrzeug, Wache), die Hauptseite bleibt kompakt
        if (managerOn('touchLarge') && inFrame) {
            style.textContent += `
                input[type="checkbox"], input[type="radio"] { width: 20px; height: 20px; }
                .btn-xs { padding: 5px 9px; font-size: 13px; }
                a.aao, a.vehicle_group { min-height: 30px; line-height: 20px; }
                #mission_vehicle_driving td, #mission_vehicle_at_mission td, #vehicle_show_table_all td { padding-top: 6px; padding-bottom: 6px; }
            `;
        }
        document.head.append(style);
    }

    /* ---------------- Touch-Knöpfe im Einsatzfenster ---------------- */

    function touchButtons() {
        if (!settings.manager) return;
        addManagerStyles();
        if (!managerOn('touchButtons') || !document.getElementById('mission-aao-group')) return;
        const box = document.createElement('div');
        box.id = 'lsshelper-touch';
        const button = (text, cls, onTap) => {
            const btn = document.createElement('a');
            btn.href = '#';
            btn.className = cls;
            btn.textContent = text;
            btn.addEventListener('click', e => {
                e.preventDefault();
                onTap(btn);
            });
            box.append(btn);
            return btn;
        };
        const aao = button('AAO wählen', 'lsshelper-touch-aao', () => triggerHotkey(true));
        // Das Spiel hat für „Alarmieren und zum nächsten Einsatz“ je einen Knopf oben und unten – der erste sichtbare reicht
        button('Alarm & weiter', 'lsshelper-touch-next', () => {
            const next = Array.from(document.querySelectorAll('.alert_next')).find(el => el.getClientRects().length) || document.getElementById('mission_alarm_btn');
            if (next) next.click();
        });
        // Ohne Markierung ist der AAO-Knopf blass, bleibt aber antippbar (die Markierung kann noch nachkommen)
        const refresh = () => aao.classList.toggle('lsshelper-touch-off', !hotkeyChoices.length);
        refresh();
        setInterval(refresh, 1000);
        document.body.append(box);
    }

    /* ---------------- Gemeinsame Helfer ---------------- */

    // Spielfunktion umhüllen: erst läuft das Spiel, danach unser Rückruf. Ein Fehler bei uns darf das Spiel nie stören.
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

    const readJson = (key, fallback) => {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
        } catch (e) {
            return fallback;
        }
    };
    const writeJson = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            log('Speichern fehlgeschlagen', key, e);
        }
    };

    const formatNumber = n => Math.round(n).toLocaleString('de-DE');
    // Mit echtem Minuszeichen, damit Beträge in Spalten sauber untereinander stehen
    const formatSigned = n => (Math.round(n) < 0 ? `−${formatNumber(-n)}` : formatNumber(n));
    // Sekunden als 1:05:09 bzw. 5:09 (wie die Countdowns des Spiels)
    function formatSeconds(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = String(seconds % 60).padStart(2, '0');
        return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    }

    /* ---------------- Einsatzliste (Hauptfenster) ---------------- */

    const ML_STAR_KEY = 'lsshelper_ml_starred';
    const ML_COLLAPSE_KEY = 'lsshelper_ml_collapsed';
    const ML_SORT_KEY = 'lsshelper_ml_sort';

    const missionPanels = () => Array.from(document.querySelectorAll('#missions-panel-body .missionSideBarEntry'));
    const panelId = panel => panel.getAttribute('mission_id') || panel.id.replace(/^mission_/, '');

    // Einsatztyp-Schlüssel wie in einsaetze.json: Typ, "-Overlay", "/Zusatz-Overlays"
    function panelMissionType(panel) {
        let type = panel.getAttribute('mission_type_id');
        if (!type || type === '-1' || type === 'null') return null;
        const overlay = panel.getAttribute('data-overlay-index');
        if (overlay && overlay !== 'null') type += `-${overlay}`;
        const additive = panel.getAttribute('data-additive-overlays');
        if (additive && additive !== 'null') type += `/${additive}`;
        return type;
    }

    const missionSpec = (missions, type) => (type && missions ? missions[type] || missions[type.split(/[-/]/)[0]] : null);

    // Patienten bzw. Gefangene, die gerade am Einsatz sind (liest die Einsatzliste des Spiels)
    function panelPatients(panel) {
        if (panel.querySelector('[id^="mission_patients_"] [id^="patient_"]')) return panel.querySelectorAll('.patient_progress').length;
        const summary = panel.querySelector('[id^="mission_patient_summary_"]');
        if (summary && summary.style.display !== 'none') {
            const strong = panel.querySelector('.mission_list_patient_icon + strong');
            return strong ? parseInt(strong.textContent.replace(/\D/g, '')) || 0 : 0;
        }
        return 0;
    }
    const panelPrisoners = panel => panel.querySelectorAll('.mission_prisoners[id^="mission_prisoners_"] .small[id^="prisoner_"]').length;

    const ML_SORTS = {
        default: { label: 'Sortierung: Spiel' },
        newest: { label: 'Neueste zuerst', key: p => -parseInt(panelId(p)) },
        oldest: { label: 'Älteste zuerst', key: p => parseInt(panelId(p)) },
        credits: { label: 'Meiste Credits zuerst', key: (p, info) => -(info.credits(p) || 0) },
        creditsAsc: { label: 'Wenigste Credits zuerst', key: (p, info) => info.credits(p) || 0 },
        patients: { label: 'Meiste Patienten zuerst', key: p => -panelPatients(p) },
        state: { label: 'Rot → Gelb → Grün', key: (p, info) => info.state(p) },
        name: { label: 'Name A–Z', key: p => (p.querySelector('[id^="mission_caption_"]') || p).textContent.trim().toLowerCase() },
    };

    // Saison-Symbole aus der Einstellung „Symbol: 1, 2/a; Symbol: 3“ lesen
    function parseEventList(text) {
        const byType = {};
        String(text || '')
            .split(';')
            .forEach(part => {
                const [symbol, ids] = part.split(':');
                if (!symbol || !ids || !symbol.trim()) return;
                ids.split(',').forEach(id => {
                    id = id.trim();
                    if (!id) return;
                    (byType[id] = byType[id] || []).push(symbol.trim());
                });
            });
        return byType;
    }

    async function missionList() {
        if (!settings.manager || inFrame) return;
        const body = document.getElementById('missions-panel-body');
        if (!body) return;
        addManagerStyles();
        const missions = await getMissions().catch(() => ({}));

        // Was das Spiel beim Aktualisieren eines Einsatzes mitliefert: Credits (auch für Einsätze ohne Typ) und Status
        const creditsById = {};
        const stateById = {};
        const info = {
            credits: panel => {
                const id = panelId(panel);
                if (creditsById[id] !== undefined) return creditsById[id];
                const spec = missionSpec(missions, panelMissionType(panel));
                return spec ? spec.$ : null;
            },
            // 0 = rot, 1 = gelb, 2 = grün; unbekannt zählt als gelb
            state: panel => (stateById[panelId(panel)] !== undefined ? stateById[panelId(panel)] : 1),
        };

        const starred = new Set(readJson(ML_STAR_KEY, []).map(String));
        const collapsed = readJson(ML_COLLAPSE_KEY, { all: false, ids: [] });
        const collapsedIds = new Set(collapsed.ids.map(String));
        // Gespeicherte Einsätze, die es nicht mehr gibt, vergessen
        const present = new Set(missionPanels().map(panelId));
        if (present.size) [starred, collapsedIds].forEach(set => set.forEach(id => !present.has(id) && set.delete(id)));
        const saveStars = () => writeJson(ML_STAR_KEY, Array.from(starred));
        const saveCollapsed = () => writeJson(ML_COLLAPSE_KEY, { all: collapsed.all, ids: Array.from(collapsedIds) });
        saveStars();
        saveCollapsed();
        let sortType = readJson(ML_SORT_KEY, 'default');
        if (!ML_SORTS[sortType]) sortType = 'default';
        const events = managerOn('mlEvents') ? parseEventList(settings.mlEventList) : {};

        // Reihenfolge über CSS (order) statt Umhängen im DOM, damit das Spiel seine Liste weiter selbst pflegen kann
        const ordering = managerOn('mlStar') || managerOn('mlSort');
        if (ordering) body.classList.add('lsshelper-ml-flex');
        let orderTimer = 0;
        const applyOrder = () => {
            orderTimer = 0;
            const sort = managerOn('mlSort') ? ML_SORTS[sortType] : ML_SORTS.default;
            body.querySelectorAll(':scope > [id^="mission_list"]').forEach(list => {
                const panels = Array.from(list.children).filter(el => el.classList.contains('missionSideBarEntry'));
                const ranked = panels.map((panel, index) => ({ panel, index, key: sort.key ? sort.key(panel, info) : 0 }));
                ranked.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index));
                ranked.forEach(({ panel }, rank) => {
                    panel.style.order = String((starred.has(panelId(panel)) ? -100000 : 0) + rank);
                });
            });
            if (typeof window.missionScrollUpdate === 'function') window.missionScrollUpdate();
        };
        const queueOrder = () => {
            if (ordering && !orderTimer) orderTimer = setTimeout(applyOrder, 150);
        };

        let searchTimer = 0;
        const button = (cls, title, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-xs ${cls}`;
            btn.title = title;
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                onClick(btn);
            });
            return btn;
        };
        const icon = (btn, glyph) => {
            btn.textContent = '';
            const span = document.createElement('span');
            span.className = `glyphicon glyphicon-${glyph}`;
            btn.append(span);
        };
        const styleStar = (btn, on) => {
            btn.className = `btn btn-xs ${on ? 'btn-warning' : 'btn-default'} lsshelper-ml-star`;
            icon(btn, on ? 'star' : 'star-empty');
        };
        const styleCollapse = (btn, on) => icon(btn, on ? 'chevron-down' : 'chevron-up');
        const setCollapsed = (panel, on) => {
            panel.classList.toggle('lsshelper-collapsed', on);
            const btn = panel.querySelector('.lsshelper-ml-collapse');
            if (btn) styleCollapse(btn, on);
        };

        // Fügt unsere Elemente an einen Einsatz an bzw. aktualisiert sie; das Spiel baut Teile davon bei Änderungen neu
        const decorate = (panel, marker, patientCount) => {
            const id = panelId(panel);
            const isNew = !present.has(id);
            present.add(id);
            if (marker) {
                if (typeof marker.average_credits === 'number') creditsById[id] = marker.average_credits;
                if (typeof marker.vehicle_state === 'number') stateById[id] = marker.vehicle_state;
            }
            const heading = panel.querySelector('.panel-heading');
            const caption = panel.querySelector('[id^="mission_caption_"]');
            if (!heading) return;

            let bar = heading.querySelector(':scope > .lsshelper-ml-info');
            if (!bar) {
                bar = document.createElement('span');
                bar.className = 'lsshelper-ml-info';
                heading.append(bar);
            }
            const pills = [];
            if (managerOn('mlCredits')) {
                const credits = info.credits(panel);
                pills.push(['credits', credits === null ? '' : `≈ ${formatNumber(credits)} Cr`]);
            }
            if (managerOn('mlPatients')) {
                const patients = patientCount !== undefined ? patientCount : panelPatients(panel);
                const prisoners = panelPrisoners(panel);
                pills.push(['patients', patients || !settings.mlHideZero ? `🤕 ${patients}` : '']);
                pills.push(['prisoners', prisoners ? `🔗 ${prisoners}` : '']);
            }
            pills.forEach(([kind, text]) => {
                let pill = bar.querySelector(`.lsshelper-ml-${kind}`);
                if (!pill) {
                    pill = document.createElement('span');
                    pill.className = `lsshelper-mgr-pill lsshelper-ml-${kind}`;
                    bar.append(pill);
                }
                pill.textContent = text;
                pill.style.display = text ? '' : 'none';
            });

            // Saison-Symbol vor dem Namen, auch für die Suche des Spiels
            const symbols = events[panelMissionType(panel)];
            if (symbols && caption && !panel.querySelector('.lsshelper-ml-event')) {
                const prefix = `[${symbols.join(' ')}]`;
                const span = document.createElement('span');
                span.className = 'lsshelper-ml-event';
                span.textContent = prefix;
                caption.before(span);
                const search = panel.getAttribute('search_attribute') || '';
                if (!search.includes(prefix)) {
                    panel.setAttribute('search_attribute', `${search} ${prefix}`);
                    if (!searchTimer && typeof window.searchMission === 'function') searchTimer = setTimeout(() => ((searchTimer = 0), window.searchMission()), 0);
                }
            }

            // Knöpfe vor dem Alarm-Knopf
            const alarm = panel.querySelector('a[id^="alarm_button_"]');
            let group = panel.querySelector('.lsshelper-ml-btns');
            if (alarm && !group) {
                group = document.createElement('span');
                group.className = 'btn-group lsshelper-ml-btns';
                alarm.before(group);
            }
            if (!group) return;
            if (managerOn('mlStar') && !group.querySelector('.lsshelper-ml-star')) {
                const star = button('', 'Einsatz oben halten', btn => {
                    if (starred.has(id)) starred.delete(id);
                    else starred.add(id);
                    styleStar(btn, starred.has(id));
                    saveStars();
                    queueOrder();
                });
                styleStar(star, starred.has(id));
                group.append(star);
            }
            if (managerOn('mlCollapse') && !group.querySelector('.lsshelper-ml-collapse')) {
                const toggle = button('btn-default lsshelper-ml-collapse', 'Einsatz ein-/ausklappen', () => {
                    const on = !panel.classList.contains('lsshelper-collapsed');
                    if (on) collapsedIds.add(id);
                    else collapsedIds.delete(id);
                    setCollapsed(panel, on);
                    saveCollapsed();
                });
                group.append(toggle);
                // Neue Einsätze kommen eingeklappt, wenn zuletzt „alle einklappen“ gewählt war
                if (isNew && collapsed.all) collapsedIds.add(id);
                setCollapsed(panel, collapsedIds.has(id));
            }
            if (managerOn('mlShare')) {
                const shared = !!panel.querySelector('.panel-success');
                const own = !!panel.closest('#mission_list, #mission_list_sicherheitswache');
                const credits = info.credits(panel) || 0;
                const existing = group.querySelector('.lsshelper-ml-share');
                if (shared && existing) existing.remove();
                if (!shared && own && !existing && credits >= settings.mlShareMin) {
                    const share = button('btn-success lsshelper-ml-share', 'Im Verband freigeben', async btn => {
                        btn.disabled = true;
                        try {
                            const response = await fetch(`/missions/${id}/alliance`, { credentials: 'same-origin' });
                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            btn.remove();
                        } catch (e) {
                            btn.disabled = false;
                            btn.title = `Teilen fehlgeschlagen: ${e.message}`;
                        }
                    });
                    icon(share, 'share-alt');
                    group.append(share);
                }
            }
        };

        missionPanels().forEach(panel => decorate(panel));
        if (ordering) applyOrder();

        const byMarker = (missionId, marker, patients) => {
            const panel = document.getElementById(`mission_${missionId}`);
            if (panel) decorate(panel, marker, patients);
            queueOrder();
        };
        hookGame('missionMarkerAdd', marker => marker && byMarker(marker.id, marker));
        hookGame('missionDelete', queueOrder);
        if (managerOn('mlPatients') || ordering) {
            hookGame('patientMarkerAdd', marker => marker && byMarker(marker.mission_id));
            hookGame('patientMarkerAddCombined', marker => marker && byMarker(marker.mission_id, null, marker.count));
            hookGame('patientDelete', () => missionPanels().forEach(panel => decorate(panel)));
        }

        // Verbleibende Einsatzdauer: das Spiel rechnet sekündlich das Ende aus, wir zeigen es im Countdown-Feld an
        if (managerOn('mlRemaining')) {
            hookGame('missionTimer', mission => {
                if (!mission || !mission.date_end_calc || (settings.mlRemainingGreen && mission.vehicle_state !== 2)) return;
                const el = document.getElementById(`mission_overview_countdown_${mission.id}`);
                const now = typeof window.unix_timestamp === 'function' ? window.unix_timestamp() : Date.now() / 1000;
                const left = Math.floor(mission.date_end_calc - now);
                if (el && left >= 0) el.textContent = typeof window.formatTime === 'function' ? window.formatTime(left, false) : formatSeconds(left);
            });
        }

        // Restzeiten unter Patienten- und Abpump-Balken, einmal pro Sekunde
        const pumping = new Map();
        if (managerOn('mlPumpTime')) {
            hookGame('startProgressBar', params => {
                const bar = params && params.$element && params.$element[0];
                if (bar && params.endTime) pumping.set(bar, params.endTime);
            });
        }
        const timeLabel = barOuter => {
            let label = barOuter.parentElement && barOuter.parentElement.querySelector(':scope > .lsshelper-ml-time');
            if (!label) {
                label = document.createElement('div');
                label.className = 'mission_overview_countdown lsshelper-ml-time';
                barOuter.before(label);
            }
            return label;
        };
        if (managerOn('mlPatientTime') || managerOn('mlPumpTime')) {
            setInterval(() => {
                if (managerOn('mlPatientTime') && Array.isArray(window.patient_timers)) {
                    window.patient_timers.forEach(patient => {
                        const bar = document.getElementById(`patient_bar_${patient.patient_id}`);
                        if (!bar || !bar.parentElement || !patient.params || patient.params.target_percent) return;
                        timeLabel(bar.parentElement).textContent = formatSeconds((patient.miliseconds_by_percent / 1000) * patient.params.live_current_value);
                    });
                }
                pumping.forEach((endTime, bar) => {
                    if (!bar.isConnected || !bar.parentElement) return pumping.delete(bar);
                    timeLabel(bar.parentElement).textContent = formatSeconds(endTime / 1000 - Date.now() / 1000);
                });
            }, 1000);
        }

        // Bedienleiste über der Liste: Sortierung und „alle ein-/ausklappen“
        const selections = document.querySelectorAll('.missions-panel-main .mission_selection');
        const anchor = selections[selections.length - 1];
        if (anchor && (managerOn('mlSort') || managerOn('mlCollapse'))) {
            const tools = document.createElement('span');
            tools.className = 'lsshelper-ml-tools';
            if (managerOn('mlSort')) {
                const select = document.createElement('select');
                select.className = 'lsshelper-ml-sort';
                Object.entries(ML_SORTS).forEach(([key, sort]) => select.add(new Option(sort.label, key, false, key === sortType)));
                select.addEventListener('change', () => {
                    sortType = select.value;
                    writeJson(ML_SORT_KEY, sortType);
                    applyOrder();
                });
                tools.append(select);
            }
            if (managerOn('mlCollapse')) {
                const all = button('btn-default', 'Alle Einsätze ein-/ausklappen', () => {
                    const panels = missionPanels();
                    collapsed.all = panels.some(panel => !panel.classList.contains('lsshelper-collapsed'));
                    panels.forEach(panel => {
                        const id = panelId(panel);
                        if (collapsed.all) collapsedIds.add(id);
                        else collapsedIds.delete(id);
                        setCollapsed(panel, collapsed.all);
                    });
                    saveCollapsed();
                });
                icon(all, 'resize-vertical');
                tools.append(all);
            }
            anchor.after(tools);
        }
    }

    /* ---------------- Einsatzfenster ---------------- */

    // Einmal-Anforderungen: egal wie viele Patienten sie nennen, gebraucht wird nur eins
    const ONCE_PER_MISSION = ['LNA', 'OrgL', 'KdoW-LNA', 'KdoW-OrgL', 'ELW 1 (SEG)', 'GW-San'];

    async function missionWindow() {
        if (!settings.manager || !document.getElementById('mission_general_info')) return;
        addManagerStyles();
        const info = document.getElementById('mission_general_info');
        const title = document.getElementById('missionH1');
        const el = (tag, cls, text) => {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (text !== undefined) node.textContent = text;
            return node;
        };

        // Ø Credits neben dem Namen
        if (managerOn('mwCredits') && title) {
            const type = getMissionType();
            const spec = type ? missionSpec(await getMissions().catch(() => null), type) : null;
            if (spec && spec.$) title.append(el('span', 'lsshelper-mgr-pill lsshelper-mw-credits', `≈ ${formatNumber(spec.$)} Credits`));
        }

        // Generierungszeitpunkt; Einsätze werden ab 2 Uhr UTC gelöscht, wenn sie vor dem letzten 2-Uhr-Termin entstanden sind
        const generated = new Date(info.getAttribute('data-generation-time') || '');
        const small = info.querySelector(':scope > small');
        if (managerOn('mwGenerated') && small && !isNaN(generated)) {
            const hours = (Date.now() - generated) / 3600000;
            const ago = hours < 1 ? `vor ${Math.max(1, Math.round(hours * 60))} Min.` : hours < 48 ? `vor ${Math.floor(hours)} Std.` : `vor ${Math.floor(hours / 24)} Tagen`;
            const node = el('span', 'lsshelper-mw-generated', `🕓 ${ago} (${generated.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`);
            const last2am = new Date();
            last2am.setUTCHours(2, 0, 0, 0);
            if (Date.now() < last2am) last2am.setUTCDate(last2am.getUTCDate() - 1);
            if (settings.mwExpireRed && generated < last2am) {
                node.classList.add('lsshelper-mw-red');
                node.title = 'Dieser Einsatz wird in der nächsten Nacht (ab 2 Uhr UTC) gelöscht';
            } else if (settings.mwGeneratedYellow > 0 && hours >= settings.mwGeneratedYellow) {
                node.classList.add('lsshelper-mw-yellow');
            }
            small.append(' | ', node);
        }

        // Karte im Hauptfenster auf den Einsatz zentrieren
        if (managerOn('mwCenterMap') && title && inFrame) {
            const lat = parseFloat(info.getAttribute('data-latitude'));
            const lng = parseFloat(info.getAttribute('data-longitude'));
            const center = el('a', 'lsshelper-mw-center', '⌖');
            center.href = '#';
            center.title = 'Karte auf den Einsatz zentrieren';
            center.addEventListener('click', e => {
                e.preventDefault();
                try {
                    const top = window.top;
                    if (top.mapkit && top.map && top.map.setCenterAnimated) top.map.setCenterAnimated(new top.mapkit.Coordinate(lat, lng));
                    else if (top.map && top.map.setView) top.map.setView([lat, lng], top.map.getZoom());
                } catch (err) {
                    log('Karte nicht erreichbar', err);
                }
            });
            if (!isNaN(lat) && !isNaN(lng)) title.prepend(center);
        }

        // Kopfleiste festhalten: bleibt beim Scrollen oben stehen
        const header = document.querySelector('.mission_header_info');
        if (managerOn('mwStickyHeader') && header) {
            header.classList.add('lsshelper-mw-sticky');
            header.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
        }
        const loadBtn = document.querySelector('.missing_vehicles_load');
        if (managerOn('mwLoadInHeader') && header && loadBtn) {
            const copy = loadBtn.cloneNode(true);
            copy.removeAttribute('id');
            copy.classList.add('lsshelper-mw-load');
            copy.addEventListener('click', e => {
                e.preventDefault();
                loadBtn.click();
            });
            header.append(copy);
        }

        missionPatients();
        missionCounters();
        vehicleSelectionTools();
    }

    // Patienten: Zusammenfassung des Bedarfs, Einklappen und Restbehandlungsdauer
    function missionPatients() {
        const patients = Array.from(document.querySelectorAll('.mission_patient'));
        if (patients.length && (managerOn('mwPatientSummary') || (settings.manager && settings.mwCollapsePatients > 0 && patients.length >= settings.mwCollapsePatients))) {
            const needs = {};
            patients.forEach(patient => {
                const alert = patient.querySelector('.alert-danger');
                if (!alert) return;
                alert.textContent
                    .replace(/^[^:]*:/, '')
                    .split(',')
                    .map(text => text.trim())
                    .filter(Boolean)
                    .forEach(need => (needs[need] = ONCE_PER_MISSION.includes(need) ? 1 : (needs[need] || 0) + 1));
            });
            const box = document.createElement('div');
            box.className = 'lsshelper-mw-patients';
            const text = Object.keys(needs).sort().map(need => `${needs[need]}× ${need}`).join(', ');
            box.textContent = `🤕 ${patients.length} Patient${patients.length === 1 ? '' : 'en'}${text ? ` – es fehlt: ${text}` : ' – nichts offen'}`;
            if (settings.mwCollapsePatients > 0 && patients.length >= settings.mwCollapsePatients) {
                const toggle = document.createElement('a');
                toggle.href = '#';
                toggle.className = 'btn btn-default btn-xs';
                const apply = hidden => {
                    patients.forEach(patient => (patient.style.display = hidden ? 'none' : ''));
                    toggle.textContent = hidden ? 'Patienten zeigen' : 'Patienten einklappen';
                };
                let hidden = true;
                toggle.addEventListener('click', e => {
                    e.preventDefault();
                    apply((hidden = !hidden));
                });
                apply(hidden);
                box.append(' ', toggle);
            }
            patients[0].before(box);
        }
        // Das Spiel meldet die Behandlung pro Patient; daraus die Restzeit bis zum Ende ableiten
        if (managerOn('mwPatientTime')) {
            const ends = new Map();
            hookGame('patientTimerMission', patient => {
                if (!patient || patient.target_percent) return;
                const bar = document.getElementById(`mission_patients_${patient.id}`);
                if (bar && bar.parentElement) ends.set(bar.parentElement, Date.now() + patient.miliseconds_by_percent * patient.live_current_value);
            });
            setInterval(() => {
                ends.forEach((end, barOuter) => {
                    if (!barOuter.isConnected) return ends.delete(barOuter);
                    let label = barOuter.parentElement.querySelector(':scope > .lsshelper-ml-time');
                    if (!label) {
                        label = document.createElement('div');
                        label.className = 'mission_overview_countdown lsshelper-ml-time';
                        barOuter.before(label);
                    }
                    label.textContent = formatSeconds((end - Date.now()) / 1000);
                });
            }, 1000);
        }
    }

    // Zähler an „Personen vor Ort“: Fahrzeuge bzw. Spieler auf Anfahrt | vor Ort | gesamt, antippen öffnet die Aufstellung
    function missionCounters() {
        const holder = document.getElementById('amount_of_people');
        if (!managerOn('mwCounters') || !holder) return;
        const rows = {
            driving: Array.from(document.querySelectorAll('#mission_vehicle_driving tbody tr')),
            atScene: Array.from(document.querySelectorAll('#mission_vehicle_at_mission tbody tr')),
        };
        const count = keyOf => {
            const result = { driving: {}, atScene: {}, total: {}, names: {} };
            Object.entries(rows).forEach(([table, list]) =>
                list.forEach(row => {
                    const key = keyOf(row, result.names);
                    if (key === null) return;
                    result[table][key] = (result[table][key] || 0) + 1;
                    result.total[key] = (result.total[key] || 0) + 1;
                })
            );
            return result;
        };
        const vehicles = count((row, names) => {
            const el = row.querySelector('[vehicle_type_id]');
            if (!el) return null;
            const type = el.getAttribute('vehicle_type_id');
            names[type] = dataLabels.vehicles[type] || `Typ ${type}`;
            return type;
        });
        const players = count((row, names) => {
            const link = row.querySelector('a[href^="/profile/"]');
            if (!link) return null;
            names[link.getAttribute('href')] = link.textContent.trim();
            return link.getAttribute('href');
        });
        const field = (label, data, sum) => {
            const wrap = document.createElement('span');
            wrap.className = 'lsshelper-mw-counter';
            const pill = document.createElement('span');
            pill.className = 'label label-info';
            pill.textContent = `${label} ${sum(data.driving)}|${sum(data.atScene)}|${sum(data.total)} ▾`;
            const table = document.createElement('table');
            table.className = 'table table-condensed table-striped lsshelper-mw-counter-table';
            table.hidden = true;
            const head = table.createTHead().insertRow();
            ['', 'Anfahrt', 'vor Ort', 'gesamt'].forEach(text => (head.insertCell().outerHTML = `<th>${text}</th>`));
            const body = table.createTBody();
            Object.keys(data.total)
                .sort((a, b) => data.names[a].localeCompare(data.names[b]))
                .forEach(key => {
                    const row = body.insertRow();
                    [data.names[key], data.driving[key] || 0, data.atScene[key] || 0, data.total[key]].forEach(value => (row.insertCell().textContent = value));
                });
            pill.addEventListener('click', () => (table.hidden = !table.hidden));
            wrap.append(pill, table);
            holder.append(wrap);
        };
        field('Fahrzeuge', vehicles, list => Object.values(list).reduce((a, b) => a + b, 0));
        field('Spieler', players, list => Object.keys(list).length);
    }

    // Fahrzeugauswahl: Typ anzeigen, Auswahl zurücksetzen, Liste zuklappen, längste Anfahrtszeit, Zähler im Bereitstellungsraum
    function vehicleSelectionTools() {
        if (managerOn('mwVehicleType')) {
            document.querySelectorAll('#vehicle_show_table_all tbody tr').forEach(row => {
                const type = row.getAttribute('vehicle_type');
                const label = row.querySelector('td[vehicle_type_id] label.mission_vehicle_label, label.mission_vehicle_label');
                if (type && label && !label.querySelector('.lsshelper-mw-type')) {
                    const small = document.createElement('small');
                    small.className = 'lsshelper-mw-type';
                    small.textContent = ` [${type}]`;
                    label.append(small);
                }
            });
        }
        const dispatch = document.getElementById('dispatch_buttons');
        const alarmBtn = document.getElementById('mission_alarm_btn');
        const toolbar = dispatch || (alarmBtn && alarmBtn.parentElement);
        if (managerOn('mwReset') && toolbar) {
            const reset = document.createElement('a');
            reset.href = '#';
            reset.className = 'btn btn-default lsshelper-mw-reset';
            reset.textContent = '✕ Auswahl zurücksetzen';
            // Häkchen per Klick lösen, damit das Spiel seine Zähler und Anzeigen selbst nachführt
            reset.addEventListener('click', e => {
                e.preventDefault();
                document.querySelectorAll('.vehicle_checkbox:checked').forEach(box => box.click());
            });
            toolbar.prepend(reset);
        }
        if (managerOn('mwHideVehicleList') && toolbar) {
            const parts = ['h2_free_vehicles', 'vehicle_list_step', 'group_max_distance'].map(id => document.getElementById(id)).filter(Boolean);
            if (parts.length) {
                const toggle = document.createElement('a');
                toggle.href = '#';
                toggle.className = 'btn btn-success lsshelper-mw-hide';
                const apply = hidden => {
                    parts.forEach(part => part.classList.toggle('hidden', hidden));
                    toggle.textContent = hidden ? 'Fahrzeugliste zeigen' : 'Fahrzeugliste ausblenden';
                };
                let hidden = true;
                toggle.addEventListener('click', e => {
                    e.preventDefault();
                    apply((hidden = !hidden));
                });
                apply(hidden);
                toolbar.prepend(toggle);
            }
        }
        if (managerOn('mwAlarmTime') && alarmBtn) {
            const badge = document.createElement('span');
            badge.className = 'badge lsshelper-mw-alarmtime';
            alarmBtn.after(badge);
            // Die Liste ist nach Entfernung sortiert: das zuletzt angehakte Fahrzeug braucht am längsten
            const update = () => {
                const checked = Array.from(document.querySelectorAll('#vehicle_list_step #all .vehicle_checkbox:checked, #vehicle_show_table_all .vehicle_checkbox:checked'));
                const last = checked[checked.length - 1];
                const cell = last && document.getElementById(`vehicle_sort_${last.value}`);
                const text = cell && cell.childNodes[0] ? cell.childNodes[0].textContent.trim() : '';
                // Noch nicht berechnete Zeit beim Spiel anfragen
                if (cell && !/\d/.test(text)) {
                    const calc = cell.closest('tr') && cell.closest('tr').querySelector('.calculateTime');
                    if (calc && !calc.dataset.lsshelperAsked) {
                        calc.dataset.lsshelperAsked = '1';
                        calc.click();
                        setTimeout(update, 1500);
                    }
                }
                badge.textContent = /\d/.test(text) ? `⏱ ${text}` : '';
                badge.style.display = badge.textContent ? '' : 'none';
            };
            document.addEventListener('change', e => e.target.classList && e.target.classList.contains('vehicle_checkbox') && setTimeout(update, 50), true);
            document.addEventListener('click', e => e.target.closest && e.target.closest('a.aao, a.vehicle_group') && setTimeout(update, 600), true);
            update();
        }
    }

    // Bereitstellungsraum: wie viele Fahrzeuge gerade angehakt sind
    function stagingCounter() {
        const form = document.querySelector('form[action^="/buildings/alarm/"]');
        if (!managerOn('mwStagingCounter') || !form) return;
        addManagerStyles();
        const counters = Array.from(form.querySelectorAll('input.btn.btn-success[type="submit"]')).map(btn => {
            const counter = document.createElement('span');
            counter.className = 'badge';
            btn.after(counter);
            return counter;
        });
        const update = () => {
            const amount = String(form.querySelectorAll('input.vehicle_checkbox:checked').length);
            counters.forEach(counter => (counter.textContent = amount));
        };
        form.addEventListener('change', update);
        form.addEventListener('click', () => setTimeout(update, 300));
        update();
    }

    // Einsatzfenster: Vor/Zurück in der Reihenfolge, die die Einsatzliste im Hauptfenster gerade zeigt
    function missionWindowOrder() {
        if (!managerOn('mlSortWindow') || !(managerOn('mlSort') || managerOn('mlStar')) || !inFrame) return;
        let top;
        try {
            top = window.top.document;
        } catch (e) {
            return;
        }
        const id = (location.pathname.match(/^\/missions\/(\d+)/) || [])[1];
        const current = top.getElementById(`mission_${id}`);
        if (!current || !current.parentElement || !top.getElementById('missions-panel-body').classList.contains('lsshelper-ml-flex')) return;
        const visible = Array.from(current.parentElement.children).filter(el => el.classList.contains('missionSideBarEntry') && !el.classList.contains('mission_deleted') && el.style.display !== 'none');
        const ordered = visible.map((el, index) => ({ el, index, order: parseInt(el.style.order) || 0 })).sort((a, b) => a.order - b.order || a.index - b.index).map(item => item.el);
        const position = ordered.indexOf(current);
        if (position < 0) return;
        const link = (selector, neighbour) => {
            document.querySelectorAll(selector).forEach(btn => {
                if (neighbour) btn.setAttribute('href', `/missions/${panelId(neighbour)}`);
            });
        };
        link('#mission_previous_mission_btn', ordered[position - 1]);
        link('#mission_next_mission_btn', ordered[position + 1]);
    }

    /* ---------------- Geld: Kategorien der Tageszusammenfassung ---------------- */

    // Reihenfolge zählt: die erste passende Kategorie gewinnt (Fehlalarme vor eigenen Einsätzen)
    const MONEY_CATEGORIES = [
        ['allianceMission', 'Verbandseinsätze', /^\[Verband\]/],
        ['eventMission', 'Event-Einsätze', /Belohnung für das Verbands-Event/],
        ['falseAlarm', 'Fehlalarme (BMA)', /Fehlalarm/],
        ['cancelled', 'Abgebrochene Einsätze', / - [aA]bgebrochen$/],
        ['mission', 'Eigene Einsätze', (desc, names) => names.has(desc.replace(/ \(Brandmeldeanlage\)$/, ''))],
        ['patients', 'Patienten', /Patienten Behandlung/],
        ['alliancePatients', 'Verbandseinlieferung Krankenhaus', /Krankenhaus - Verbandseinlieferung/],
        ['prisoners', 'Gefangene', /Gefangenen? transportiert/],
        ['alliancePrisoners', 'Verbandseinlieferung Polizei', /Polizei - Verbandseinlieferung/],
        ['tasks', 'Erfüllte Aufgaben', /Erfüllte Aufgabe/],
        ['login', 'Login-Bonus', /Täglicher Login-Bonus/],
        ['vehicles', 'Fahrzeuge gekauft', /Fahrzeug gekauft/],
        ['equipment', 'Ausrüstung gekauft', /Ausrüstung gekauft/],
        ['convert', 'Fahrzeuge umgerüstet', /Fahrzeug umgerüstet/],
        ['buildings', 'Gebäude gebaut/abgerissen', /(Gebäude gebaut|Rückerstattung Gebäude$|Gebäude abgerissen)/],
        ['upgrades', 'Gebäude ausgebaut', /(Wache (erweitert( \(von Kleinwache\))?|ausgebaut)|Abbrechen:|Rückerstattung Gebäudeausbau|Spezialisierung (abgebrochen|gebaut))/],
        ['complexes', 'Gebäudekomplexe', /(An den Gebäudekomplex angehängte Gebäude|Aus(bau|gebaut) zu einem Gebäudekomplex)/],
        ['schoolings', 'Lehrgänge', /(Ausbildung( fremdes)? Personal|Lehrgang)/],
        ['others', 'Sonstiges', () => true],
    ];
    const MONEY_TITLES = Object.fromEntries(MONEY_CATEGORIES.map(([key, title]) => [key, title]));

    const parseCredits = text => parseInt(String(text || '').replace(/[^\d-]/g, '')) || 0;

    // Zeilen der Tageszusammenfassung (#daily_table): Summe, Durchschnitt, Anzahl, Beschreibung
    async function parseDaily(doc) {
        const missions = await getMissions().catch(() => ({}));
        const names = new Set(Object.values(missions).map(m => m.n));
        return Array.from(doc.querySelectorAll('#daily_table tbody tr'))
            .map(row => {
                const cells = row.children;
                if (cells.length < 4) return null;
                const desc = cells[3].textContent.trim();
                const category = MONEY_CATEGORIES.find(([, , test]) => (typeof test === 'function' ? test(desc, names) : test.test(desc)))[0];
                return { row, total: parseCredits(cells[0].textContent), average: parseCredits(cells[1].textContent), amount: parseCredits(cells[2].textContent), desc, category };
            })
            .filter(Boolean);
    }

    // { income, expense, categories: { key: { income, expense, amount } } }
    function summarizeMoney(entries) {
        const sum = { income: 0, expense: 0, categories: {} };
        entries.forEach(entry => {
            const cat = (sum.categories[entry.category] = sum.categories[entry.category] || { income: 0, expense: 0, amount: 0 });
            if (entry.total >= 0) {
                cat.income += entry.total;
                sum.income += entry.total;
            } else {
                cat.expense -= entry.total;
                sum.expense -= entry.total;
            }
            cat.amount += entry.amount;
        });
        return sum;
    }

    function addMoneyStyles() {
        if (document.getElementById('lsshelper-money-style')) return;
        const style = document.createElement('style');
        style.id = 'lsshelper-money-style';
        // Farben: Einnahmen Blau, Ausgaben Orange (geprüft für Farbsehschwächen, hell und dunkel)
        style.textContent = `
            .lsshelper-money { --m-surface: #fcfcfb; --m-text: #1c1f24; --m-muted: #6b7280; --m-line: #e1e4ea; --m-in: #2a78d6; --m-out: #eb6834; color: var(--m-text); font-size: 13px; }
            body.dark .lsshelper-money, .lsshelper-dark .lsshelper-money { --m-surface: #1f2229; --m-text: #e8eaed; --m-muted: #9aa3af; --m-line: #323742; --m-in: #3987e5; --m-out: #d95926; }
            .lsshelper-dash-pane > .lsshelper-money { display: grid; gap: 12px; }
            .lsshelper-money-box { margin: 8px 0; padding: 10px 12px; background: var(--m-surface); border: 1px solid var(--m-line); border-radius: 10px; }
            .lsshelper-money-kpis { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-bottom: 8px; }
            .lsshelper-money-kpi small { display: block; color: var(--m-muted); font-size: 11px; }
            .lsshelper-money-kpi b { font-size: 20px; font-weight: 700; }
            .lsshelper-money-legend { display: flex; gap: 14px; color: var(--m-muted); font-size: 12px; margin: 4px 0; }
            .lsshelper-money-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
            table.lsshelper-money-table { width: 100%; border-collapse: collapse; font-size: 12px; color: var(--m-text); background: transparent; }
            table.lsshelper-money-table th { text-align: left; font-weight: 600; color: var(--m-muted); padding: 4px 6px; border-bottom: 1px solid var(--m-line); white-space: nowrap; }
            table.lsshelper-money-table td { padding: 4px 6px; border-bottom: 1px solid var(--m-line); vertical-align: middle; }
            table.lsshelper-money-table td.n, table.lsshelper-money-table th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
            table.lsshelper-money-table tr.lsshelper-money-click { cursor: pointer; }
            table.lsshelper-money-table tr.lsshelper-money-active td { background: rgba(128, 128, 128, 0.15); }
            .lsshelper-money-bar { display: flex; flex-direction: column; gap: 2px; min-width: 80px; }
            .lsshelper-money-bar span { display: block; height: 6px; border-radius: 0 4px 4px 0; }
            .lsshelper-money-chart { position: relative; }
            .lsshelper-money-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
            .lsshelper-money-chart text { fill: var(--m-muted); font-size: 11px; }
            .lsshelper-money-tip { position: absolute; z-index: 5; pointer-events: none; padding: 6px 8px; border-radius: 6px; background: var(--m-text); color: var(--m-surface); font-size: 12px; white-space: nowrap; transform: translate(-50%, -100%); }
            .lsshelper-money-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        `;
        document.head.append(style);
    }

    const moneyEl = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    function moneyKpis(parent, items) {
        const row = moneyEl('div', 'lsshelper-money-kpis');
        items.forEach(([label, value]) => {
            const kpi = moneyEl('div', 'lsshelper-money-kpi');
            kpi.append(moneyEl('small', '', label), moneyEl('b', '', value));
            row.append(kpi);
        });
        parent.append(row);
    }

    function moneyLegend(parent) {
        const legend = moneyEl('div', 'lsshelper-money-legend');
        [['Einnahmen', 'var(--m-in)'], ['Ausgaben', 'var(--m-out)']].forEach(([label, color]) => {
            const item = moneyEl('span', '', label);
            const swatch = moneyEl('i');
            swatch.style.background = color;
            item.prepend(swatch);
            legend.append(item);
        });
        parent.append(legend);
    }

    // Tabelle je Kategorie; Balkenlänge relativ zum größten Betrag. onPick(key|null) filtert, wenn gesetzt.
    function moneyCategoryTable(parent, summary, { average, days, onPick } = {}) {
        const rows = Object.entries(summary.categories).sort((a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense));
        const max = Math.max(1, ...rows.map(([, c]) => Math.max(c.income, c.expense)));
        const table = moneyEl('table', 'lsshelper-money-table');
        const head = table.createTHead().insertRow();
        const headers = [['Kategorie'], [''], ['Einnahmen', 'n'], ['Ausgaben', 'n'], ['Anzahl', 'n']];
        if (average) headers.push(['Ø je Buchung', 'n']);
        if (days > 1) headers.push(['Ø je Tag', 'n']);
        headers.forEach(([text, cls]) => head.append(moneyEl('th', cls || '', text)));
        const body = table.createTBody();
        let active = null;
        rows.forEach(([key, cat]) => {
            const row = body.insertRow();
            const bar = moneyEl('div', 'lsshelper-money-bar');
            [['income', 'var(--m-in)'], ['expense', 'var(--m-out)']].forEach(([field, color]) => {
                if (!cat[field]) return;
                const span = moneyEl('span');
                span.style.width = `${Math.max(2, (cat[field] / max) * 100)}%`;
                span.style.background = color;
                bar.append(span);
            });
            const net = cat.income - cat.expense;
            const cells = [
                [MONEY_TITLES[key] || key],
                [bar],
                [cat.income ? formatNumber(cat.income) : '–', 'n'],
                [cat.expense ? `−${formatNumber(cat.expense)}` : '–', 'n'],
                [formatNumber(cat.amount), 'n'],
            ];
            if (average) cells.push([cat.amount ? formatSigned(net / cat.amount) : '–', 'n']);
            if (days > 1) cells.push([formatSigned(net / days), 'n']);
            cells.forEach(([content, cls]) => {
                const cell = row.insertCell();
                if (cls) cell.className = cls;
                if (content instanceof Node) cell.append(content);
                else cell.textContent = content;
            });
            if (onPick) {
                row.className = 'lsshelper-money-click';
                row.title = 'Antippen: nur diese Kategorie zeigen';
                row.addEventListener('click', () => {
                    active = active === key ? null : key;
                    body.querySelectorAll('tr').forEach(r => r.classList.toggle('lsshelper-money-active', r === row && active === key));
                    onPick(active);
                });
            }
        });
        parent.append(table);
        return table;
    }

    // Säulen um eine Nulllinie: Einnahmen nach oben, Ausgaben nach unten; Antippen/Hover zeigt die Werte
    function moneyDayChart(parent, days) {
        const width = 640;
        const height = 220;
        const pad = { top: 12, bottom: 24, left: 44, right: 8 };
        const max = Math.max(1, ...days.map(d => Math.max(d.income, d.expense)));
        const plotH = height - pad.top - pad.bottom;
        const zero = pad.top + plotH / 2;
        const scale = v => (v / max) * (plotH / 2);
        const band = (width - pad.left - pad.right) / days.length;
        const bar = Math.min(24, band * 0.6);
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Einnahmen und Ausgaben pro Tag');
        const add = (tag, attrs, text) => {
            const node = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
            if (text !== undefined) node.textContent = text;
            svg.append(node);
            return node;
        };
        const compact = v => (v >= 1e6 ? `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));
        // Hilfslinien: Null, halbe und volle Höhe
        [max, max / 2, 0, -max / 2, -max].forEach(v => {
            const y = zero - (v >= 0 ? scale(v) : -scale(-v));
            add('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, stroke: 'var(--m-line)', 'stroke-width': v === 0 ? 1.5 : 1 });
            add('text', { x: pad.left - 6, y: y + 4, 'text-anchor': 'end' }, `${v < 0 ? '−' : ''}${compact(Math.abs(v))}`);
        });
        // Säule mit 4px-Rundung am freien Ende, eckig an der Nulllinie
        const column = (x, h, up, color) => {
            if (h < 0.5) return null;
            const r = Math.min(4, h, bar / 2);
            const y0 = zero;
            const y1 = up ? zero - h : zero + h;
            const d = up
                ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bar - r} Q${x + bar},${y1} ${x + bar},${y1 + r} V${y0} Z`
                : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bar - r} Q${x + bar},${y1} ${x + bar},${y1 - r} V${y0} Z`;
            return add('path', { d, fill: color });
        };
        const wrap = moneyEl('div', 'lsshelper-money-chart');
        const tip = moneyEl('div', 'lsshelper-money-tip');
        tip.hidden = true;
        days.forEach((day, i) => {
            const x = pad.left + i * band + (band - bar) / 2;
            column(x, scale(day.income), true, 'var(--m-in)');
            column(x, scale(day.expense), false, 'var(--m-out)');
            add('text', { x: x + bar / 2, y: height - 6, 'text-anchor': 'middle' }, day.label);
            // Trefferfläche: die ganze Spalte, größer als die Säule
            const hit = add('rect', { x: pad.left + i * band, y: pad.top, width: band, height: plotH, fill: 'transparent' });
            const show = () => {
                tip.hidden = false;
                tip.textContent = `${day.title}: +${formatNumber(day.income)} / −${formatNumber(day.expense)} = ${formatSigned(day.income - day.expense)}`;
                tip.style.left = `${((x + bar / 2) / width) * 100}%`;
                tip.style.top = `${(pad.top / height) * 100}%`;
            };
            hit.addEventListener('pointerenter', show);
            hit.addEventListener('click', show);
            hit.addEventListener('pointerleave', () => (tip.hidden = true));
        });
        wrap.append(svg, tip);
        parent.append(wrap);
    }

    function downloadCsv(name, rows) {
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
        link.download = name;
        document.body.append(link);
        link.click();
        setTimeout(() => (URL.revokeObjectURL(link.href), link.remove()), 1000);
    }

    /* ---------------- Geld: Tageszusammenfassung (/credits/daily) ---------------- */

    async function dailySummary() {
        if (!managerOn('dcSummary')) return;
        const table = document.getElementById('daily_table');
        if (!table) return;
        addMoneyStyles();
        const entries = await parseDaily(document);
        const summary = summarizeMoney(entries);
        const root = moneyEl('div', 'lsshelper-money');
        const box = moneyEl('div', 'lsshelper-money-box');
        root.append(box);
        moneyKpis(box, [
            ['Einnahmen', formatNumber(summary.income)],
            ['Ausgaben', `−${formatNumber(summary.expense)}`],
            ['Saldo', formatSigned(summary.income - summary.expense)],
        ]);
        moneyLegend(box);
        // Antippen einer Kategorie blendet die übrigen Zeilen der Spieltabelle aus
        moneyCategoryTable(box, summary, {
            average: settings.dcAverage,
            onPick: key => entries.forEach(entry => (entry.row.style.display = !key || entry.category === key ? '' : 'none')),
        });
        const tools = moneyEl('div', 'lsshelper-money-tools');
        const exportBtn = moneyEl('a', 'btn btn-default btn-xs', 'Als CSV exportieren');
        exportBtn.href = '#';
        exportBtn.addEventListener('click', e => {
            e.preventDefault();
            const page = new URLSearchParams(location.search).get('page') || '0';
            downloadCsv(`credits-tag-${page}.csv`, [['Kategorie', 'Beschreibung', 'Summe', 'Durchschnitt', 'Anzahl'], ...entries.map(e => [MONEY_TITLES[e.category], e.desc, e.total, e.average, e.amount])]);
        });
        tools.append(exportBtn);
        box.append(tools);
        const anchor = document.querySelector('.page-header') || table;
        if (anchor === table) table.before(root);
        else anchor.after(root);
    }

    /* ---------------- Geld: Verlauf der letzten Tage (Dashboard) ---------------- */

    const MONEY_CACHE_KEY = 'lsshelper_money_days_v1';
    const dayKey = offset => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    async function renderMoneyTool(ctx) {
        addMoneyStyles();
        const count = Math.min(30, Math.max(1, settings.cxHistoryDays || 7));
        const cache = readJson(MONEY_CACHE_KEY, {});
        const days = [];
        // Abgeschlossene Tage ändern sich nicht mehr und kommen aus dem Speicher; heute wird immer neu gelesen
        for (let offset = count - 1; offset >= 0; offset--) {
            const key = dayKey(offset);
            let entry = offset > 0 ? cache[key] : null;
            if (!entry) {
                ctx.status(`Lese Tageszusammenfassung … ${count - offset}/${count}`);
                const doc = await fetchDoc(`/credits/daily?page=${offset}`);
                const parsed = await parseDaily(doc);
                entry = summarizeMoney(parsed.map(({ row, ...rest }) => rest));
                if (offset > 0) cache[key] = entry;
                await sleep(150);
            }
            const date = new Date(`${key}T12:00:00`);
            days.push(Object.assign({ key, label: offset === 0 ? 'heute' : date.toLocaleDateString('de-DE', { weekday: 'short' }), title: date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }) }, entry));
        }
        // Nur die letzten 60 Tage aufheben
        Object.keys(cache)
            .sort()
            .slice(0, -60)
            .forEach(key => delete cache[key]);
        writeJson(MONEY_CACHE_KEY, cache);

        const total = { income: 0, expense: 0, categories: {} };
        days.forEach(day => {
            total.income += day.income;
            total.expense += day.expense;
            Object.entries(day.categories).forEach(([key, cat]) => {
                const t = (total.categories[key] = total.categories[key] || { income: 0, expense: 0, amount: 0 });
                t.income += cat.income;
                t.expense += cat.expense;
                t.amount += cat.amount;
            });
        });
        ctx.status(`Einnahmen und Ausgaben der letzten ${count} Tage (heute zählt bis jetzt).`);
        const root = moneyEl('div', 'lsshelper-money');
        ctx.body.append(root);
        const card = dashCard(root, `Verlauf · ${count} Tage`);
        moneyKpis(card, [
            ['Einnahmen', formatNumber(total.income)],
            ['Ausgaben', `−${formatNumber(total.expense)}`],
            ['Saldo', formatSigned(total.income - total.expense)],
            ['Ø Saldo je Tag', formatSigned((total.income - total.expense) / count)],
        ]);
        moneyLegend(card);
        moneyDayChart(card, days);
        // Tabellenansicht der Tage (für Werte ohne Antippen und als Alternative zum Diagramm)
        const dayTable = moneyEl('table', 'lsshelper-money-table');
        const head = dayTable.createTHead().insertRow();
        [['Tag'], ['Einnahmen', 'n'], ['Ausgaben', 'n'], ['Saldo', 'n']].forEach(([text, cls]) => head.append(moneyEl('th', cls || '', text)));
        const body = dayTable.createTBody();
        days
            .slice()
            .reverse()
            .forEach(day => {
                const row = body.insertRow();
                [[day.title], [formatNumber(day.income), 'n'], [`−${formatNumber(day.expense)}`, 'n'], [formatSigned(day.income - day.expense), 'n']].forEach(([text, cls]) => {
                    const cell = row.insertCell();
                    cell.textContent = text;
                    if (cls) cell.className = cls;
                });
            });
        card.append(dayTable);
        const breakdown = dashCard(root, 'Aufschlüsselung nach Kategorie');
        moneyLegend(breakdown);
        moneyCategoryTable(breakdown, total, { average: settings.dcAverage, days: count });
        breakdown.head.append(
            dashButton('Als CSV exportieren', '', () =>
                downloadCsv('credits-verlauf.csv', [
                    ['Tag', 'Kategorie', 'Einnahmen', 'Ausgaben', 'Anzahl'],
                    ...days.flatMap(day => Object.entries(day.categories).map(([key, cat]) => [day.key, MONEY_TITLES[key] || key, cat.income, cat.expense, cat.amount])),
                ])
            ),
            dashButton('Neu laden', 'lsshelper-btn-quiet', () => {
                localStorage.removeItem(MONEY_CACHE_KEY);
                ctx.open('money');
            })
        );
    }

    /* ---------------- Geld: Credits-Menü in der Kopfleiste ---------------- */

    const RANKS = {
        fire: [[0, 'Anwärter(in)'], [200, 'Feuerwehrmann/-frau'], [1e4, 'Oberfeuerwehrmann/-frau'], [1e5, 'Hauptfeuerwehrmann/-frau'], [1e6, 'Stv. Gruppenführer(in)'], [5e6, 'Gruppenführer(in)'], [1e7, 'Stv. Zugführer(in)'], [2e7, 'Zugführer(in)'], [5e7, 'Stv. Wehrführer(in)'], [1e8, 'Wehrführer(in)'], [2e8, 'Stv. Kreisbrandmeister(in)'], [5e8, 'Kreisbrandmeister(in)'], [1e9, 'Stv. Landesbrandmeister(in)'], [2e9, 'Landesbrandmeister(in)'], [5e9, 'Ehrenmitglied'], [1e10, 'Stv. Bundesbranddirektor(in)'], [2e10, 'Bundesbranddirektor(in)'], [5e10, 'Stv. Internationale(r) Branddirektor(in)'], [1e11, 'Internationaler Branddirektor(in)']],
        police: [[0, 'Polizeimeisteranwärter(in)'], [200, 'Polizeimeister(in)'], [1e4, 'Polizeiobermeister(in)'], [1e5, 'Polizeihauptmeister(in)'], [1e6, 'Polizeikommissar(in)'], [5e6, 'Polizeioberkommissar(in)'], [1e7, 'Polizeihauptkommissar(in)'], [2e7, 'Erste(r) Polizeihauptkommissar(in)'], [5e7, 'Polizeirat / Polizeirätin'], [1e8, 'Polizeioberrat / Polizeioberrätin'], [2e8, 'Polizeidirektor(in)'], [5e8, 'Leitende(r) Polizeidirektor(in)'], [1e9, 'Direktor(in) der Bundespolizei'], [2e9, 'Präsident(in) der Bundespolizeidirektion'], [5e9, 'Vizepräsident(in) der Bundespolizei'], [1e10, 'Präsident(in) der Bundespolizei'], [2e10, 'Generalinspekteur(in) der Polizei'], [5e10, 'Oberste(r) Polizeidirektor(in)'], [1e11, 'Generaloberkommissar(in)']],
    };
    const GOAL_KEY = 'lsshelper_cx_goal_ack';

    function creditsMenu() {
        if (!managerOn('cxMenu') || inFrame) return;
        const creditsValue = document.querySelector('.credits-value');
        const creditsItem = creditsValue && creditsValue.closest('li');
        if (!creditsItem) return;
        addManagerStyles();
        const coinsValue = document.querySelector('.coins-value');
        const coinsItem = coinsValue && coinsValue.closest('li');
        const state = { credits: parseCredits(creditsValue.textContent), coins: coinsValue ? parseCredits(coinsValue.textContent) : 0, info: null };
        const goals = String(settings.cxGoals || '')
            .split(/[,;\s]+/)
            .map(text => parseInt(text.replace(/\D/g, '')))
            .filter(n => n > 0)
            .sort((a, b) => a - b);

        const item = moneyEl('li', 'dropdown lsshelper-cx');
        const toggle = moneyEl('a', 'dropdown-toggle');
        toggle.href = '#';
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('data-toggle', 'dropdown');
        const menu = moneyEl('ul', 'dropdown-menu lsshelper-cx-menu');
        menu.setAttribute('role', 'menu');
        item.append(toggle, menu);
        creditsItem.before(item);
        // Die Originale bleiben im DOM (das Spiel aktualisiert sie weiter), werden aber ausgeblendet
        creditsItem.style.display = 'none';
        if (coinsItem && coinsItem !== creditsItem) coinsItem.style.display = 'none';

        const link = (text, href, extra) => {
            const li = moneyEl('li');
            const a = moneyEl('a', 'lightbox-open', text);
            a.href = href;
            li.append(a);
            if (extra) extra.forEach(([label, url]) => {
                const btn = moneyEl('a', 'lightbox-open btn btn-xs btn-default lsshelper-cx-sub', label);
                btn.href = url;
                li.append(btn);
            });
            menu.append(li);
        };
        const textItem = text => menu.append(moneyEl('li', 'lsshelper-cx-text', text));
        const divider = () => menu.append(moneyEl('li', 'divider'));

        const ranks = /polizei\./.test(location.hostname) ? RANKS.police : RANKS.fire;
        const render = () => {
            const reached = goals.filter(goal => state.credits >= goal).pop() || 0;
            let ack = parseInt(localStorage.getItem(GOAL_KEY) || '0');
            // Nach Ausgaben unter ein Ziel gefallen: beim nächsten Erreichen wieder melden
            if (reached < ack) localStorage.setItem(GOAL_KEY, String((ack = reached)));
            item.classList.toggle('lsshelper-cx-goal', reached > ack);
            toggle.textContent = settings.cxCreditsInNav ? `💰 ${formatNumber(state.credits)} ` : '💰 ';
            toggle.append(moneyEl('b', 'caret'));
            const next = goals.find(goal => goal > state.credits);
            if (settings.cxGoalBar && next) {
                const prev = goals.filter(goal => goal <= state.credits).pop() || 0;
                const pct = Math.max(0, Math.min(100, ((state.credits - prev) / (next - prev)) * 100));
                item.style.backgroundImage = `linear-gradient(90deg, rgba(76, 175, 80, 0.45) ${pct}%, transparent ${pct}%)`;
            } else item.style.backgroundImage = '';

            menu.textContent = '';
            link(`Credits: ${formatNumber(state.credits)}`, '/credits', [['Tag', '/credits/daily'], ['Übersicht', '/credits/overview']]);
            link(`Coins: ${formatNumber(state.coins)}`, '/coins', [['Liste', '/coins/list']]);
            const info = state.info;
            if (info) {
                divider();
                textItem(`Insgesamt verdient: ${formatNumber(info.credits_user_total)}`);
                const nextRank = ranks.find(([credits]) => credits > info.credits_user_total);
                if (nextRank) link(`Nächster Rang: ${nextRank[1]} – noch ${formatNumber(nextRank[0] - info.credits_user_total)} Credits`, '/level');
                if (settings.cxToplist && info.user_toplist_position) link(`Platz in der Topliste: ${formatNumber(info.user_toplist_position)}`, `/toplist?page=${Math.ceil(info.user_toplist_position / 20)}`);
                if (settings.cxAllianceFunds && info.credits_alliance_active) {
                    divider();
                    link(`Verbandskasse: ${formatNumber(info.credits_alliance_current || 0)} (gesamt ${formatNumber(info.credits_alliance_total || 0)})`, '/verband/kasse');
                }
            }
            if (next) {
                divider();
                textItem(`Nächstes Ziel: ${formatNumber(next)} – noch ${formatNumber(next - state.credits)}`);
            }
        };
        // Antippen bestätigt ein erreichtes Ziel
        toggle.addEventListener('click', () => {
            const reached = goals.filter(goal => state.credits >= goal).pop() || 0;
            localStorage.setItem(GOAL_KEY, String(reached));
            item.classList.remove('lsshelper-cx-goal');
        });

        const loadInfo = () =>
            fetchJson('/api/userinfo')
                .then(info => {
                    state.info = info;
                    if (typeof info.coins_user_current === 'number') state.coins = info.coins_user_current;
                    render();
                })
                .catch(log);
        hookGame('creditsUpdate', credits => {
            const value = Number(credits);
            if (isNaN(value) || value === state.credits) return;
            if (state.info && value > state.credits) state.info.credits_user_total += value - state.credits;
            state.credits = value;
            render();
        });
        hookGame('coinsUpdate', coins => {
            if (isNaN(Number(coins))) return;
            state.coins = Number(coins);
            render();
        });
        render();
        // Zusatzinfos mit Abstand zum Seitenaufbau, danach alle 5 Minuten (Topliste)
        setTimeout(loadInfo, 5000);
        setInterval(loadInfo, 5 * 60 * 1000);
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
        // Manager-Funktionen: prüfen selbst, ob Hauptschalter und eigener Schalter an sind
        { name: 'managerStyles', match: /^\/(vehicles|buildings)\/\d+/, run: () => settings.manager && addManagerStyles() },
        { name: 'touchButtons', match: /^\/missions\/\d+/, run: touchButtons },
        { name: 'missionList', match: /^\/$/, run: missionList },
        { name: 'missionWindow', match: /^\/missions\/\d+/, run: missionWindow },
        { name: 'stagingCounter', match: /^\/buildings\/\d+/, run: stagingCounter },
        { name: 'creditsMenu', match: /^\/$/, run: creditsMenu },
        { name: 'dailySummary', match: /^\/credits\/daily\/?$/, run: dailySummary },
        { name: 'missionWindowOrder', match: /^\/missions\/\d+/, run: missionWindowOrder },
    ];

    window.LSSHelper = { features: Object.fromEntries(FEATURES.map(f => [f.name, f.run])), getMissions, nameVariants, nameScore, planFleet, openDashboard, hotkey: triggerHotkey, applyChange: change => APPLY[change.kind](change), rerun: () => (clearMarks(), aaoHighlight()) };

    FEATURES.filter(f => f.match.test(location.pathname)).forEach(f => {
        try {
            Promise.resolve(f.run()).catch(e => console.error(`[LSS Helper] ${f.name}`, e));
        } catch (e) {
            console.error(`[LSS Helper] ${f.name}`, e);
        }
    });
})();
