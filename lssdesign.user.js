// ==UserScript==
// @name         LSS Design
// @namespace    lsshelper
// @version      0.2.1
// @description  Neues Aussehen fürs Leitstellenspiel: Nacht- und Tagansicht, große Karte, Einsatzliste rechts, Funk, Wachen und Chat als Reiter, Schnellsuche. Ändert nur das Aussehen, nicht die Seite.
// @match        https://www.leitstellenspiel.de/*
// @match        https://polizei.leitstellenspiel.de/*
// @updateURL    https://raw.githubusercontent.com/Kiritosky/lsshelper/main/lssdesign.user.js
// @downloadURL  https://raw.githubusercontent.com/Kiritosky/lsshelper/main/lssdesign.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     * Grundsätze
     * - Nur Aussehen: Spielelemente werden nicht verschoben oder ersetzt. Der LSS-Manager sortiert die
     *   Einsatzliste über die CSS-Reihenfolge und hängt sich an feste IDs; beides bleibt unberührt.
     * - Alle Regeln hängen an html.lssd. Ohne diese Klasse (Design aus) gilt das Original.
     * - Einstellungen liegen im localStorage und gelten sofort in allen Fenstern (auch Einsatzfenstern).
     * ------------------------------------------------------------------ */

    const KEY = 'lssd_settings';
    const DEFAULTS = { on: true, theme: 'night', dock: true, tab: 'radio', dockOpen: true, split: 0.62 };
    const SPLIT_MIN = 0.25;
    const SPLIT_MAX = 0.85;
    const OUTERS = ['map_outer', 'missions_outer', 'buildings_outer', 'chat_outer', 'radio_outer', 'lssd-tabs'];
    const TABS = [
        { id: 'radio', label: 'Funk', outer: 'radio_outer' },
        { id: 'buildings', label: 'Wachen', outer: 'buildings_outer' },
        { id: 'chat', label: 'Chat', outer: 'chat_outer' },
    ];
    const root = document.documentElement;
    const isMain = location.pathname === '/' || location.pathname === '';

    function load() {
        try {
            return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }
    let settings = load();
    function save(changes) {
        settings = Object.assign({}, settings, changes);
        try {
            localStorage.setItem(KEY, JSON.stringify(settings));
        } catch (e) {
            /* ohne Speicher gilt die Einstellung nur bis zum Neuladen */
        }
        apply();
    }

    /* ------------------------------------------------------------------ *
     * Aussehen
     * ------------------------------------------------------------------ */

    // :root.lssd body … ist spezifischer als die Regeln des Spiels (auch die seines Dunkelmodus body.dark …)
    const CSS = String.raw`
:root.lssd {
  --lssd-font: "Barlow", "Segoe UI", system-ui, -apple-system, sans-serif;
  --lssd-display: "Barlow Condensed", "Arial Narrow", "Segoe UI", sans-serif;
  --lssd-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --lssd-red: #d93a3f;
  --lssd-yellow: #e39b12;
  --lssd-green: #2f9e6b;
  --lssd-radius: 8px;
  --lssd-side: clamp(330px, 30vw, 480px);
}
:root.lssd-day {
  --lssd-bg: #e9eef4;
  --lssd-panel: #ffffff;
  --lssd-panel-2: #f4f7fa;
  --lssd-line: #d4dce6;
  --lssd-text: #1a2532;
  --lssd-muted: #65758a;
  --lssd-accent: #2459c9;
  --lssd-accent-soft: #e3ebfb;
  --lssd-bar: #15202c;
  --lssd-bar-text: #dbe4ee;
  --lssd-red-soft: #fbe7e7;
  --lssd-yellow-soft: #fdf1d8;
  --lssd-green-soft: #e1f3ea;
  --lssd-hover: rgba(36, 89, 201, 0.07);
  color-scheme: light;
}
:root.lssd-night {
  --lssd-bg: #0e141c;
  --lssd-panel: #151e29;
  --lssd-panel-2: #1a2532;
  --lssd-line: #263445;
  --lssd-text: #dbe4ee;
  --lssd-muted: #8899ad;
  --lssd-accent: #6f98f2;
  --lssd-accent-soft: #1c2a44;
  --lssd-bar: #0a0f15;
  --lssd-bar-text: #cdd7e2;
  --lssd-red-soft: #3a1d20;
  --lssd-yellow-soft: #3a2c10;
  --lssd-green-soft: #12301f;
  --lssd-hover: rgba(111, 152, 242, 0.09);
  color-scheme: dark;
}

/* ---------- Grundlage, alle Seiten ---------- */
:root.lssd body {
  background: var(--lssd-bg);
  color: var(--lssd-text);
  font-family: var(--lssd-font);
}
:root.lssd body h1, :root.lssd body h2, :root.lssd body h3, :root.lssd body h4 {
  font-family: var(--lssd-display);
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--lssd-text);
}
:root.lssd body a { color: var(--lssd-accent); }
:root.lssd body hr { border-color: var(--lssd-line); }
:root.lssd body small, :root.lssd body .text-muted { color: var(--lssd-muted); }

:root.lssd body .panel {
  background: var(--lssd-panel);
  border: 1px solid var(--lssd-line);
  border-radius: var(--lssd-radius);
  box-shadow: none;
  color: var(--lssd-text);
}
:root.lssd body .panel > .panel-heading,
:root.lssd body .panel-default > .panel-heading {
  background: var(--lssd-panel);
  color: var(--lssd-text);
  border-color: var(--lssd-line);
  border-radius: var(--lssd-radius) var(--lssd-radius) 0 0;
}
:root.lssd body .panel-body, :root.lssd body .panel-footer { background: transparent; color: var(--lssd-text); border-color: var(--lssd-line); }
/* :where() hält die allgemeine Linkfarbe schwach, damit gezielte Regeln (z. B. Einsatznamen) sie überstimmen */
:root.lssd body :where(.panel-body, .panel-heading) a:where(:not(.btn):not(.label)) { color: var(--lssd-accent); }

/* Knöpfe: Spielbedeutung bleibt (grün = los, rot = Gefahr), Formen werden ruhiger.
   AAO-Knöpfe tragen ihre Farbe im style-Attribut und behalten sie. */
:root.lssd body .btn { border-radius: 6px; font-weight: 500; }
:root.lssd body .btn-default {
  background: var(--lssd-panel-2);
  border-color: var(--lssd-line);
  color: var(--lssd-text);
}
:root.lssd body .btn-default:hover, :root.lssd body .btn-default:focus { background: var(--lssd-accent-soft); border-color: var(--lssd-line); color: var(--lssd-text); }
:root.lssd body .btn-success { background-color: var(--lssd-green); border-color: var(--lssd-green); color: #fff; }
:root.lssd body .btn-danger { background-color: var(--lssd-red); border-color: var(--lssd-red); color: #fff; }
:root.lssd body .btn-warning { background-color: var(--lssd-yellow); border-color: var(--lssd-yellow); color: #1a1a1a; }
:root.lssd body .btn-primary, :root.lssd body .btn-info { background-color: var(--lssd-accent); border-color: var(--lssd-accent); color: #fff; }
:root.lssd body .btn-success:hover, :root.lssd body .btn-danger:hover, :root.lssd body .btn-warning:hover,
:root.lssd body .btn-primary:hover, :root.lssd body .btn-info:hover { filter: brightness(1.08); }
:root.lssd body .btn:focus-visible, :root.lssd body a:focus-visible { outline: 2px solid var(--lssd-accent); outline-offset: 2px; }

:root.lssd body .form-control,
:root.lssd body input[type="text"], :root.lssd body input[type="search"], :root.lssd body input[type="number"],
:root.lssd body input[type="email"], :root.lssd body input[type="password"],
:root.lssd body select, :root.lssd body textarea {
  background-color: var(--lssd-panel-2);
  border: 1px solid var(--lssd-line);
  color: var(--lssd-text);
  border-radius: 6px;
}
:root.lssd body input::placeholder, :root.lssd body textarea::placeholder { color: var(--lssd-muted); }
:root.lssd body input[type="checkbox"], :root.lssd body input[type="radio"] { accent-color: var(--lssd-accent); }

:root.lssd body .table { color: var(--lssd-text); background: transparent; }
:root.lssd body .table > thead > tr > th, :root.lssd body .table > tbody > tr > td,
:root.lssd body .table > tbody > tr > th, :root.lssd body .table > tfoot > tr > td { border-color: var(--lssd-line); }
:root.lssd body .table > thead > tr > th { color: var(--lssd-muted); font-weight: 600; }
:root.lssd body .table-striped > tbody > tr:nth-of-type(odd) { background-color: var(--lssd-panel-2); }
:root.lssd body .table-hover > tbody > tr:hover, :root.lssd body .table > tbody > tr:hover { background-color: var(--lssd-hover); }

:root.lssd body .nav-tabs { border-bottom-color: var(--lssd-line); }
:root.lssd body .nav-tabs > li > a { color: var(--lssd-muted); background: transparent; border-radius: 6px 6px 0 0; }
:root.lssd body .nav-tabs > li > a:hover { background: var(--lssd-hover); border-color: transparent; color: var(--lssd-text); }
:root.lssd body .nav-tabs > li.active > a, :root.lssd body .nav-tabs > li.active > a:hover, :root.lssd body .nav-tabs > li.active > a:focus {
  background: var(--lssd-panel);
  color: var(--lssd-text);
  border-color: var(--lssd-line) var(--lssd-line) transparent;
  font-weight: 600;
}
:root.lssd body .tab-content { color: var(--lssd-text); }

:root.lssd body .alert { border: 0; border-left: 3px solid; border-radius: 6px; color: var(--lssd-text); }
:root.lssd body .alert a:not(.btn) { color: var(--lssd-accent); }
:root.lssd body .alert-info { background: var(--lssd-accent-soft); border-left-color: var(--lssd-accent); }
:root.lssd body .alert-success { background: var(--lssd-green-soft); border-left-color: var(--lssd-green); }
:root.lssd body .alert-warning { background: var(--lssd-yellow-soft); border-left-color: var(--lssd-yellow); }
:root.lssd body .alert-danger { background: var(--lssd-red-soft); border-left-color: var(--lssd-red); }

:root.lssd body .dropdown-menu { background: var(--lssd-panel); border-color: var(--lssd-line); border-radius: var(--lssd-radius); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
:root.lssd body .dropdown-menu > li > a { color: var(--lssd-text); }
:root.lssd body .dropdown-menu > li > a:hover, :root.lssd body .dropdown-menu > li > a:focus { background: var(--lssd-hover); color: var(--lssd-text); }
:root.lssd body .dropdown-menu .divider { background-color: var(--lssd-line); }
:root.lssd body .dropdown-header { color: var(--lssd-muted); }
:root.lssd body .modal-content { background: var(--lssd-panel); color: var(--lssd-text); border-color: var(--lssd-line); border-radius: 10px; }
:root.lssd body .modal-header, :root.lssd body .modal-footer { border-color: var(--lssd-line); }
:root.lssd body .well { background: var(--lssd-panel-2); border-color: var(--lssd-line); box-shadow: none; }
:root.lssd body .list-group-item { background: var(--lssd-panel); border-color: var(--lssd-line); color: var(--lssd-text); }
:root.lssd body .progress { background: var(--lssd-panel-2); border-radius: 4px; box-shadow: none; }
:root.lssd body .progress-bar-danger { background-color: var(--lssd-red); }
:root.lssd body .progress-bar-warning { background-color: var(--lssd-yellow); }
:root.lssd body .progress-bar-success { background-color: var(--lssd-green); }
:root.lssd body .label-default { background: var(--lssd-panel-2); color: var(--lssd-text); border: 1px solid var(--lssd-line); }
:root.lssd body .close { color: var(--lssd-text); text-shadow: none; opacity: 0.6; }
:root.lssd body .close:hover { opacity: 1; }

/* Fahrzeugstatus: Farben des Spiels, nur als ordentliche Plakette */
:root.lssd body .building_list_fms {
  border-radius: 4px;
  font-family: var(--lssd-mono);
  font-weight: 500;
  min-width: 1.6em;
  text-align: center;
  display: inline-block;
}

/* ---------- Obere Leiste ---------- */
:root.lssd body .navbar-default:not(#container_navbar_alarm) {
  background: var(--lssd-bar);
  border-color: transparent;
}
:root.lssd body #main_navbar .navbar-nav > li > a,
:root.lssd body #main_navbar .navbar-brand,
:root.lssd body #main_navbar .navbar-text { color: var(--lssd-bar-text); }
:root.lssd body #main_navbar .navbar-nav > li > a:hover,
:root.lssd body #main_navbar .navbar-nav > li > a:focus,
:root.lssd body #main_navbar .navbar-nav > .open > a,
:root.lssd body #main_navbar .navbar-nav > .open > a:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
:root.lssd body #main_navbar .navbar-nav > li > a { border-radius: 6px; }
:root.lssd body #main_navbar input[type="text"], :root.lssd body #main_navbar input[type="search"] {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: var(--lssd-bar-text);
}
:root.lssd body #main_navbar input::placeholder { color: #8fa1b5; }
:root.lssd body #navbar-main-collapse > ul { flex-wrap: wrap; }

/* ---------- Karte ---------- */
:root.lssd body #map { border-radius: var(--lssd-radius); border: 1px solid var(--lssd-line); background: var(--lssd-panel-2); }
:root.lssd-night body .leaflet-tile { opacity: 1; filter: brightness(0.74) contrast(1.06) saturate(0.82); }
:root.lssd body .leaflet-bar a { background: var(--lssd-panel); color: var(--lssd-text); border-color: var(--lssd-line); }
:root.lssd body .leaflet-popup-content-wrapper, :root.lssd body .leaflet-popup-tip { background: var(--lssd-panel); color: var(--lssd-text); }

/* ---------- Einsatzliste ---------- */
:root.lssd body .missions-panel-head, :root.lssd body #missions-panel-head { background: var(--lssd-panel); border-bottom: 1px solid var(--lssd-line); }
:root.lssd body .mission_selection { border-radius: 12px; font-weight: 600; }
:root.lssd body .missionSideBarEntry .panel {
  border-radius: 7px;
  margin-bottom: 6px;
  background: var(--lssd-panel);
}
:root.lssd body .missionSideBarEntry .mission_panel_red { border-left: 4px solid var(--lssd-red) !important; }
:root.lssd body .missionSideBarEntry .mission_panel_yellow { border-left: 4px solid var(--lssd-yellow) !important; }
:root.lssd body .missionSideBarEntry .mission_panel_green { border-left: 4px solid var(--lssd-green) !important; }
:root.lssd body .missionSideBarEntry .panel-heading {
  background: transparent;
  border-bottom: 0;
  font-weight: 600;
  line-height: 1.35;
}
:root.lssd body .missionSideBarEntry .panel-heading .map_position_mover { color: var(--lssd-text); }
:root.lssd body .missionSideBarEntry .panel-heading .map_position_mover small { display: block; font-weight: 400; color: var(--lssd-muted); }
:root.lssd body .missionSideBarEntry .mission-alarm-button { float: right; margin-left: 6px; }
:root.lssd body .missionSideBarEntry .mission_progress { height: 8px; border-radius: 4px; }
:root.lssd body .missionSideBarEntry .mission_progress .progress-bar { border-radius: 4px; }
:root.lssd body .missionSideBarEntry .mission_overview_countdown { font-family: var(--lssd-mono); font-size: 12px; color: var(--lssd-muted); font-variant-numeric: tabular-nums; }
:root.lssd body .missionSideBarEntryScrollInvisible { background-color: transparent; }
/* Freigegebene und Verbandseinsätze: im Spiel ein greller Grünverlauf (Regel mit ID, daher hier auch mit ID),
   hier nur ein leichter Farbton, damit sie sich von eigenen Einsätzen abheben */
:root.lssd body #missions .missionSideBarEntry .panel-heading { background: transparent; }
:root.lssd body #missions .missionSideBarEntry .panel-success { background: color-mix(in srgb, var(--lssd-accent) 9%, var(--lssd-panel)); }
:root.lssd body .panel-heading { background-image: none; }

/* Graue Flächen des Spiel-Dunkelmodus hinter den Fenstern und um das Einsatzfenster */
:root.lssd body #missions_outer, :root.lssd body #buildings_outer,
:root.lssd body #chat_outer, :root.lssd body #radio_outer { background-color: transparent; }
:root.lssd body #lightbox_box { background-color: var(--lssd-panel); border-color: var(--lssd-line); }

/* Filter der Wachenliste: kleine Schalter statt großer grüner Knöpfe (grün = sichtbar, durchgestrichen = ausgeblendet) */
:root.lssd body #btn-group-building-select { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; float: none; }
:root.lssd body #btn-group-building-select > .btn {
  float: none;
  margin: 0;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 18px;
  border-radius: 10px !important;
}
:root.lssd body #btn-group-building-select > .btn-success { background: var(--lssd-green-soft); color: var(--lssd-green); border-color: transparent; }
:root.lssd body #btn-group-building-select > .btn-danger { background: transparent; color: var(--lssd-muted); border-color: var(--lssd-line); text-decoration: line-through; }
:root.lssd body #btn-group-building-select > .btn:hover { filter: none; border-color: var(--lssd-muted); }

/* ---------- Wachen, Funk, Chat ---------- */
:root.lssd body .building_list_caption { font-weight: 600; background: var(--lssd-panel-2); border-radius: 6px; padding: 4px 6px; }
:root.lssd body .building_list_caption .map_position_mover { color: var(--lssd-text); }
:root.lssd body .building_list_li { border-bottom: 1px solid var(--lssd-line); padding: 6px 0; }
:root.lssd body .vehicle_building_list_button.label-default { font-weight: 500; font-size: 12px; }
:root.lssd body #radio_messages_important > li {
  background: var(--lssd-red-soft);
  border-radius: 6px;
  padding: 4px 6px;
  margin-bottom: 4px;
  list-style: none;
}
:root.lssd body #radio_messages > li { border-bottom: 1px solid var(--lssd-line); padding: 3px 0; list-style: none; }
:root.lssd body #mission_chat_messages > li { border-bottom: 1px solid var(--lssd-line); padding: 4px 0; }

/* ---------- Hauptseite: Karte links, Einsätze rechts, Reiter darunter ---------- */
/* Die Seite selbst scrollt nicht mehr: das Raster füllt genau das Fenster unter der oberen Leiste,
   gescrollt wird nur in den Listen, und zwar ohne die Seite mitzuziehen. */
@media (min-width: 992px) {
  :root.lssd-dock:not(.lssd-extra), :root.lssd-dock:not(.lssd-extra) body { overflow: hidden; }
  :root.lssd-dock body > footer, :root.lssd-dock body > #footer_hr { display: none; }
  :root.lssd-dock body #main_container { padding-left: 0; padding-right: 0; }
  :root.lssd-dock body #row-main-template {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--lssd-side);
    grid-template-rows: minmax(0, var(--lssd-m, 62fr)) auto minmax(0, var(--lssd-d, 38fr));
    grid-template-areas: "map missions" "map tabs" "map dock";
    gap: 8px 10px;
    margin: 0;
    padding: 8px 10px 10px;
    height: calc(100vh - var(--lssd-top, 52px));
  }
  :root.lssd-dock.lssd-dock-closed body #row-main-template { grid-template-rows: minmax(0, 1fr) auto 0; row-gap: 8px; }
  :root.lssd-dock body #row-main-template::before,
  :root.lssd-dock body #row-main-template::after { content: none; display: none; }
  :root.lssd-dock body #row-main-template > * { float: none; width: auto; padding: 0; min-width: 0; min-height: 0; }
  /* Was andere Skripte in die Zeile hängen, kommt in voller Breite darunter (dann darf die Seite wieder scrollen) */
  :root.lssd-dock body #row-main-template > :not(#map_outer):not(#missions_outer):not(#buildings_outer):not(#chat_outer):not(#radio_outer):not(#lssd-tabs) { grid-column: 1 / -1; }

  :root.lssd-dock body #map_outer { grid-area: map; display: flex; flex-direction: column; gap: 6px; }
  :root.lssd-dock body #map_outer > #map { flex: 1 1 auto; height: auto !important; min-height: 0; }

  :root.lssd-dock body #missions_outer { grid-area: missions; display: flex; flex-direction: column; }
  :root.lssd-dock body #missions {
    flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
    background: var(--lssd-panel); border: 1px solid var(--lssd-line); border-radius: var(--lssd-radius); overflow: hidden;
  }
  :root.lssd-dock body #missions-panel-body { flex: 1 1 auto; height: auto !important; max-height: none !important; min-height: 0; margin: 0; padding: 6px 6px 6px 8px; }

  :root.lssd-dock body #lssd-tabs { grid-area: tabs; display: flex; }
  :root.lssd-dock body #buildings_outer,
  :root.lssd-dock body #chat_outer,
  :root.lssd-dock body #radio_outer { grid-area: dock; display: none; flex-direction: column; }
  :root.lssd-dock:not(.lssd-dock-closed)[data-lssd-tab="radio"] body #radio_outer,
  :root.lssd-dock:not(.lssd-dock-closed)[data-lssd-tab="buildings"] body #buildings_outer,
  :root.lssd-dock:not(.lssd-dock-closed)[data-lssd-tab="chat"] body #chat_outer { display: flex; }
  :root.lssd-dock body #buildings, :root.lssd-dock body #radio, :root.lssd-dock body #chat_panel,
  :root.lssd-dock body #buildings > .panel, :root.lssd-dock body #radio > .panel {
    flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; margin: 0;
  }
  :root.lssd-dock body #building_panel_body, :root.lssd-dock body #radio_panel_body, :root.lssd-dock body #chat_panel_body {
    flex: 1 1 auto; height: auto !important; max-height: none !important; min-height: 0; overflow-y: auto;
  }
  /* Der Reiter nennt schon, was offen ist: die gleichlautende Überschrift im Fenster entfällt */
  :root.lssd-dock body #building-list-header-title { display: none; }
  :root.lssd-dock body #radio_panel_heading .flex-grow-1 { font-size: 0; }
  /* Fensterköpfe flach: Knöpfe und Suche in einer Zeile */
  :root.lssd-dock body #radio_panel_heading, :root.lssd-dock body #building_panel_heading,
  :root.lssd-dock body #chat_panel_heading { padding: 6px 8px; }
  :root.lssd-dock body #chat_panel_heading > .clearfix { display: none; }
  :root.lssd-dock body #chat_panel_heading { display: flex; justify-content: flex-end; }
  :root.lssd-dock body #chat_panel_heading > .pull-right { float: none; }
  :root.lssd-dock body #building_panel_heading { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  :root.lssd-dock body #building_panel_heading > * { float: none; margin: 0; width: auto; }
  :root.lssd-dock body #building-list-header-buttons { order: 1; display: flex; gap: 4px; }
  :root.lssd-dock body #building-list-header-buttons > .btn { float: none; margin: 0; border-radius: 6px; }
  :root.lssd-dock body #building-list-header-search { order: 2; flex: 1 1 100px; }
  :root.lssd-dock body #building-list-header-search input { float: none; width: 100%; }
  :root.lssd-dock body #building_panel_body, :root.lssd-dock body #radio_panel_body { padding: 6px 8px; }
  :root.lssd-dock body #chat_panel_body { padding: 8px 10px; }
  /* Die Kennung des Browserfensters am Seitenende würde die Seite um eine Zeile verlängern */
  :root.lssd-dock body > .client-id { display: none; }
}

/* Kopf der Einsatzliste kompakter */
:root.lssd body #missions-panel-head { padding: 6px 8px; display: grid; gap: 4px; }
:root.lssd body #missions-panel-head .missions-panel-main { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
:root.lssd body #missions-panel-head .mission-filters-block { display: grid; gap: 4px; margin: 0; }
:root.lssd body #missions-panel-head .mission-filters-block > * { margin: 0; }
/* Das Suchfeld trägt die Lupe als Hintergrundbild: Platz links lassen, damit der Text nicht darüber läuft */
:root.lssd body #search_input_field_missions {
  width: 100%;
  height: auto;
  padding: 3px 8px 3px 26px;
  background-repeat: no-repeat;
  background-position: 8px center;
  background-size: 13px 13px;
}
/* Einsatzgeschwindigkeit: im Spiel ein flaches Etikett, hier ein Knopf in Höhe der Filter daneben */
:root.lssd body #missions-panel-head .missions-panel-main > .dropdown { display: flex; align-items: center; height: auto; }
:root.lssd body #missions-panel-head .label-speedbutton {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
}
:root.lssd body #missions-panel-head .label-speedbutton.label-success { background-color: var(--lssd-green); }
:root.lssd body #missions-panel-head .label-speedbutton.label-warning { background-color: var(--lssd-yellow); color: #1a1a1a; }
:root.lssd body #missions-panel-head .label-speedbutton .glyphicon { top: 0; font-size: 10px; }

/* Listen scrollen für sich, ohne die Seite mitzuziehen; schmale Scrollleisten im Design */
:root.lssd body #missions-panel-body, :root.lssd body #building_panel_body, :root.lssd body #radio_panel_body,
:root.lssd body #chat_panel_body, :root.lssd body .dropdown-menu { overscroll-behavior: contain; }
:root.lssd, :root.lssd body * { scrollbar-width: thin; scrollbar-color: var(--lssd-line) transparent; }
:root.lssd body *:hover { scrollbar-color: var(--lssd-muted) transparent; }

#lssd-tabs { display: none; }
#lssd-tabs {
  gap: 4px;
  align-items: stretch;
  font-family: var(--lssd-font);
}
#lssd-tabs button {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--lssd-line);
  border-radius: 7px;
  background: var(--lssd-panel);
  color: var(--lssd-muted);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
#lssd-tabs button:hover { color: var(--lssd-text); }
#lssd-tabs button[aria-selected="true"] { background: var(--lssd-accent-soft); color: var(--lssd-accent); border-color: transparent; font-weight: 600; }
:root.lssd-dock-closed #lssd-tabs button[aria-selected="true"] { background: var(--lssd-panel); color: var(--lssd-text); border-color: var(--lssd-line); }
#lssd-tabs button:focus-visible { outline: 2px solid var(--lssd-accent); outline-offset: 2px; }
#lssd-tabs .lssd-grip {
  flex: 0 0 26px;
  padding: 0;
  cursor: row-resize;
  touch-action: none;
  color: var(--lssd-muted);
  font-size: 14px;
  line-height: 1;
}
:root.lssd-dock-closed #lssd-tabs .lssd-grip { visibility: hidden; }
:root.lssd-resizing, :root.lssd-resizing * { cursor: row-resize !important; user-select: none !important; }
.lssd-badge {
  font-family: var(--lssd-mono);
  font-size: 11px;
  line-height: 16px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--lssd-red);
  color: #fff;
  text-align: center;
}
.lssd-badge:empty { display: none; }

/* ---------- Einsatzfenster ---------- */
:root.lssd body #iframe-inside-container { background: var(--lssd-bg); padding-bottom: 70px; }
:root.lssd body #missionH1 { font-family: var(--lssd-display); font-size: 26px; font-weight: 600; margin: 6px 0 2px; }
:root.lssd body #mission_general_info > small { color: var(--lssd-muted); font-size: 13px; }
:root.lssd body #missing_text.alert-missing-vehicles {
  background: var(--lssd-yellow-soft);
  border-left: 3px solid var(--lssd-yellow);
  color: var(--lssd-text);
  font-weight: 500;
}
:root.lssd body .mission_header_info {
  background: var(--lssd-panel);
  border-bottom: 1px solid var(--lssd-line);
  margin-bottom: 10px;
}
:root.lssd body #lightbox_close_inside { background: transparent; color: var(--lssd-text); }
:root.lssd body #mission-aao-group a.aao { border-radius: 6px; margin: 0 3px 4px 0; }
:root.lssd body .mission_patient {
  background: var(--lssd-panel-2);
  border: 1px solid var(--lssd-line);
  border-radius: 7px;
  color: var(--lssd-text);
}
:root.lssd body tr.vehicle_select_table_tr,
:root.lssd body .tablesorter-headerRow,
:root.lssd body .table > tbody > tr { background-color: transparent; }
:root.lssd body .tablesorter-header, :root.lssd body .table > thead > tr > th { background-color: var(--lssd-panel-2); }
:root.lssd body tr.vehicle_select_table_tr:hover { background-color: var(--lssd-hover); }
:root.lssd body #container_navbar_alarm {
  background: var(--lssd-panel-2);
  border-top: 1px solid var(--lssd-line);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.18);
}
:root.lssd body #container_navbar_alarm .btn { font-weight: 600; }
:root.lssd body #h2_free_vehicles, :root.lssd body #group_max_distance > h4 {
  font-family: var(--lssd-display);
  font-size: 14px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lssd-muted);
}

/* ---------- Eigene Bedienelemente (auch bei ausgeschaltetem Design sichtbar) ---------- */
#lssd-menu-li { position: relative; }
#lssd-menu-btn {
  margin: 8px 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.45);
  background: transparent;
  color: inherit;
  font: 600 13px/1.2 "Barlow", "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
}
:root.lssd body #lssd-menu-btn { color: var(--lssd-bar-text); border-color: rgba(255, 255, 255, 0.22); }
#lssd-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 3000;
  width: 250px;
  padding: 10px;
  display: grid;
  gap: 10px;
  border-radius: 10px;
  border: 1px solid #c9d2dd;
  background: #fff;
  color: #1a2532;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  font: 13px/1.4 "Barlow", "Segoe UI", system-ui, sans-serif;
}
:root.lssd #lssd-menu { border-color: var(--lssd-line); background: var(--lssd-panel); color: var(--lssd-text); }
#lssd-menu[hidden] { display: none; }
#lssd-menu .lssd-row { display: grid; gap: 4px; }
#lssd-menu .lssd-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; }
#lssd-menu .lssd-seg { display: flex; border: 1px solid rgba(127, 127, 127, 0.4); border-radius: 7px; overflow: hidden; }
#lssd-menu .lssd-seg button { flex: 1; padding: 5px 6px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
#lssd-menu .lssd-seg button[aria-pressed="true"] { background: #2459c9; color: #fff; font-weight: 600; }
:root.lssd #lssd-menu .lssd-seg button[aria-pressed="true"] { background: var(--lssd-accent); color: #fff; }
#lssd-menu .lssd-off { padding: 6px; border-radius: 7px; border: 1px solid rgba(127, 127, 127, 0.4); background: transparent; color: inherit; font: inherit; cursor: pointer; }
#lssd-menu button:focus-visible { outline: 2px solid #2459c9; outline-offset: 1px; }
:root:not(.lssd) #lssd-menu .lssd-needs-on { opacity: 0.45; pointer-events: none; }

/* Schnellsuche */
#lssd-search-li { position: relative; }
:root:not(.lssd) #lssd-search-li { display: none; }
#lssd-search {
  margin: 8px 6px;
  width: 240px;
  padding: 5px 30px 5px 10px;
  border-radius: 7px;
  border: 1px solid rgba(127, 127, 127, 0.45);
  font: 13px/1.3 "Barlow", "Segoe UI", system-ui, sans-serif;
}
#lssd-search-key {
  position: absolute; right: 14px; top: 13px;
  font: 11px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(127, 127, 127, 0.5); opacity: 0.75; pointer-events: none;
}
#lssd-results {
  position: absolute; left: 6px; top: calc(100% - 2px); z-index: 3000;
  width: 380px; max-height: 60vh; overflow-y: auto;
  border-radius: 10px; border: 1px solid #c9d2dd; background: #fff; color: #1a2532;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  font: 13px/1.35 "Barlow", "Segoe UI", system-ui, sans-serif;
  padding: 6px;
}
:root.lssd #lssd-results { border-color: var(--lssd-line); background: var(--lssd-panel); color: var(--lssd-text); }
#lssd-results[hidden] { display: none; }
#lssd-results .lssd-group { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.65; padding: 6px 8px 2px; }
#lssd-results .lssd-hit { display: block; width: 100%; text-align: left; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
#lssd-results .lssd-hit small { display: block; opacity: 0.7; }
#lssd-results .lssd-hit[aria-selected="true"], #lssd-results .lssd-hit:hover { background: rgba(36, 89, 201, 0.12); }
#lssd-results .lssd-empty { padding: 8px; opacity: 0.75; }
`;

    const FONT_URL = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';

    function injectStyle() {
        if (document.getElementById('lssd-style')) return;
        const font = document.createElement('link');
        font.id = 'lssd-font';
        font.rel = 'stylesheet';
        font.href = FONT_URL;
        const style = document.createElement('style');
        style.id = 'lssd-style';
        style.textContent = CSS;
        const parent = document.head || document.documentElement;
        parent.append(font, style);
    }
    // Ans Ende des <head>, damit gleich spezifische Spielregeln nicht nachträglich gewinnen
    function moveStyleLast() {
        const style = document.getElementById('lssd-style');
        if (style && document.head && style !== document.head.lastElementChild) document.head.append(document.getElementById('lssd-font'), style);
    }

    /* ------------------------------------------------------------------ *
     * Anwenden
     * ------------------------------------------------------------------ */

    // Nachtansicht nutzt den eingebauten Dunkelmodus des Spiels (body.dark) als Grundlage für alles,
    // was das Skript nicht eigens gestaltet. Das Spiel schaltet body.dark selbst (z. B. „wie das System“);
    // was es zuletzt wollte, merkt sich gameDark – das gilt wieder, sobald das Design aus ist.
    let gameDark = null;
    const wantDark = () => (settings.on ? settings.theme === 'night' : gameDark);
    function syncBodyDark() {
        const body = document.body;
        if (!body) return;
        if (gameDark === null) {
            gameDark = body.classList.contains('dark');
            new MutationObserver(() => {
                const has = body.classList.contains('dark');
                if (has === wantDark()) return;
                gameDark = has;
                syncBodyDark();
            }).observe(body, { attributes: true, attributeFilter: ['class'] });
        }
        if (body.classList.contains('dark') !== wantDark()) body.classList.toggle('dark', wantDark());
    }

    function invalidateMap() {
        if (!isMain || !window.map || typeof window.map.invalidateSize !== 'function') return;
        requestAnimationFrame(() => {
            try {
                window.map.invalidateSize();
            } catch (e) {
                /* Karte noch nicht bereit */
            }
        });
    }

    function apply() {
        root.classList.toggle('lssd', settings.on);
        root.classList.toggle('lssd-night', settings.on && settings.theme === 'night');
        root.classList.toggle('lssd-day', settings.on && settings.theme !== 'night');
        root.classList.toggle('lssd-dock', settings.on && settings.dock && isMain);
        root.classList.toggle('lssd-dock-closed', !settings.dockOpen);
        root.dataset.lssdTab = settings.tab;
        setSplit(settings.split);
        syncBodyDark();
        updateMenu();
        updateTabs();
        invalidateMap();
    }

    /* ------------------------------------------------------------------ *
     * Hauptseite: Reiter für Funk, Wachen, Chat
     * ------------------------------------------------------------------ */

    const unread = { chat: 0 };
    const chatVisible = () => settings.tab === 'chat' && settings.dockOpen && root.classList.contains('lssd-dock');

    // Aufteilung zwischen Einsatzliste und Reiterfenster (Anteil der Einsatzliste an der Höhe)
    function clampSplit(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return DEFAULTS.split;
        return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
    }
    function setSplit(value) {
        const split = clampSplit(value);
        root.style.setProperty('--lssd-m', `${Math.round(split * 1000) / 10}fr`);
        root.style.setProperty('--lssd-d', `${Math.round((1 - split) * 1000) / 10}fr`);
    }

    function updateTabs() {
        const bar = document.getElementById('lssd-tabs');
        if (!bar) return;
        bar.querySelectorAll('button[data-tab]').forEach(btn => {
            const selected = btn.dataset.tab === settings.tab;
            btn.setAttribute('aria-selected', String(selected));
            btn.setAttribute('aria-expanded', String(selected && settings.dockOpen));
            btn.title = selected
                ? (settings.dockOpen ? 'Einklappen' : 'Ausklappen')
                : '';
        });
        if (chatVisible()) unread.chat = 0;
        const radio = document.querySelectorAll('#radio_messages_important > li').length;
        const set = (id, n) => {
            const badge = bar.querySelector(`[data-tab="${id}"] .lssd-badge`);
            if (badge) badge.textContent = n > 0 ? String(n > 99 ? '99+' : n) : '';
        };
        set('radio', radio);
        set('chat', unread.chat);
    }

    function buildTabs() {
        const row = document.getElementById('row-main-template');
        if (!row || document.getElementById('lssd-tabs')) return;
        const bar = document.createElement('div');
        bar.id = 'lssd-tabs';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Funk, Wachen und Chat');
        bar.append(buildGrip(row));
        TABS.forEach(tab => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.tab = tab.id;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-controls', tab.outer);
            btn.append(tab.label);
            const badge = document.createElement('span');
            badge.className = 'lssd-badge';
            btn.append(badge);
            // Offener Reiter: ein Klick klappt ihn ein (mehr Platz für die Einsatzliste), noch einer wieder aus
            btn.addEventListener('click', () => {
                if (settings.tab === tab.id) save({ dockOpen: !settings.dockOpen });
                else save({ tab: tab.id, dockOpen: true });
            });
            bar.append(btn);
        });
        row.append(bar);
        watchExtras(row);

        // Zähler: Sprechwünsche im Funk, neue Chatnachrichten, solange der Chat-Reiter nicht offen ist
        const important = document.getElementById('radio_messages_important');
        if (important) new MutationObserver(updateTabs).observe(important, { childList: true });
        const chat = document.getElementById('mission_chat_messages');
        if (chat) {
            new MutationObserver(records => {
                if (chatVisible()) return;
                unread.chat += records.reduce((sum, r) => sum + Array.from(r.addedNodes).filter(n => n.nodeType === 1).length, 0);
                updateTabs();
            }).observe(chat, { childList: true });
        }
        updateTabs();
    }

    // Griff links neben den Reitern: zieht die Grenze zwischen Einsatzliste und Reiterfenster
    function buildGrip(row) {
        const grip = document.createElement('button');
        grip.type = 'button';
        grip.className = 'lssd-grip';
        grip.title = 'Höhe ändern (ziehen, Doppelklick: zurücksetzen)';
        grip.setAttribute('aria-label', 'Höhe von Einsatzliste und Reitern ändern');
        grip.textContent = '⇕';
        let drag = null;
        const ratioAt = y => {
            const rect = row.getBoundingClientRect();
            const style = getComputedStyle(row);
            const top = rect.top + parseFloat(style.paddingTop);
            const bottom = rect.bottom - parseFloat(style.paddingBottom);
            const tabs = grip.parentElement ? grip.parentElement.getBoundingClientRect().height : 0;
            const free = bottom - top - tabs;
            if (free <= 0) return settings.split;
            return clampSplit((y - top - tabs / 2) / free);
        };
        // Bewegung und Loslassen am Fenster abhören: der Zeiger verlässt den schmalen Griff beim Ziehen sofort
        const move = e => {
            if (!drag || e.pointerId !== drag.id) return;
            drag.split = ratioAt(e.clientY);
            setSplit(drag.split);
        };
        const end = e => {
            if (!drag || e.pointerId !== drag.id) return;
            const split = drag.split;
            drag = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            root.classList.remove('lssd-resizing');
            save({ split });
        };
        grip.addEventListener('pointerdown', e => {
            if (e.button !== 0 || !settings.dockOpen) return;
            e.preventDefault();
            drag = { id: e.pointerId, split: settings.split };
            root.classList.add('lssd-resizing');
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
            window.addEventListener('pointercancel', end);
        });
        grip.addEventListener('dblclick', () => save({ split: DEFAULTS.split, dockOpen: true }));
        // Tastatur: Pfeil hoch/runter verschiebt die Grenze in kleinen Schritten
        grip.addEventListener('keydown', e => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            save({ split: clampSplit(settings.split + (e.key === 'ArrowDown' ? 0.05 : -0.05)), dockOpen: true });
        });
        return grip;
    }

    // Hängen andere Skripte eigene Blöcke in die Hauptzeile, darf die Seite wieder scrollen,
    // damit diese Blöcke erreichbar bleiben.
    function watchExtras(row) {
        const check = () => {
            const extra = Array.from(row.children).some(el => !OUTERS.includes(el.id)
                && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
            root.classList.toggle('lssd-extra', extra);
        };
        check();
        new MutationObserver(check).observe(row, { childList: true });
    }

    // Höhe der oberen Leiste und Abstand der Hauptzeile vom Seitenanfang für die Seitenaufteilung
    function trackNavbar() {
        const nav = document.getElementById('col_navbar_holder');
        const row = document.getElementById('row-main-template');
        let last = '';
        const set = () => {
            if (nav) root.style.setProperty('--lssd-nav-h', `${Math.ceil(nav.getBoundingClientRect().height)}px`);
            if (row) {
                const top = `${Math.max(0, Math.round(row.getBoundingClientRect().top + window.scrollY))}px`;
                if (top !== last) {
                    last = top;
                    root.style.setProperty('--lssd-top', top);
                    invalidateMap();
                }
            }
        };
        set();
        window.addEventListener('resize', set);
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(set);
            if (nav) ro.observe(nav);
            // Alles über der Hauptzeile (Hinweise, Leisten anderer Skripte) verschiebt sie nach unten
            if (row && row.parentElement) {
                Array.from(row.parentElement.children).forEach(el => {
                    if (el !== row) ro.observe(el);
                });
            }
        }
    }

    /* ------------------------------------------------------------------ *
     * Menü in der oberen Leiste
     * ------------------------------------------------------------------ */

    function el(tag, props, ...children) {
        const node = document.createElement(tag);
        Object.entries(props || {}).forEach(([key, value]) => {
            if (key === 'class') node.className = value;
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
            else node.setAttribute(key, value);
        });
        children.forEach(child => node.append(child));
        return node;
    }

    function segment(label, key, options, needsOn) {
        const seg = el('div', { class: 'lssd-seg', role: 'group', 'aria-label': label });
        options.forEach(([value, text]) => seg.append(el('button', { type: 'button', 'data-key': key, 'data-value': String(value), onclick: () => save({ [key]: value }) }, text)));
        return el('div', { class: `lssd-row${needsOn ? ' lssd-needs-on' : ''}` }, el('span', { class: 'lssd-label' }, label), seg);
    }

    function buildMenu() {
        const list = document.querySelector('#navbar-main-collapse > ul.navbar-right') || document.querySelector('#navbar-main-collapse > ul');
        if (!list || document.getElementById('lssd-menu-li')) return;
        const menu = el(
            'div',
            { id: 'lssd-menu', hidden: '' },
            segment('Ansicht', 'theme', [['night', 'Nacht'], ['day', 'Tag']], true),
            segment('Aufteilung', 'dock', [[true, 'Reiter'], [false, 'wie im Spiel']], true),
            el('button', { type: 'button', class: 'lssd-off', onclick: () => save({ on: !settings.on }) }, '')
        );
        const btn = el('button', { type: 'button', id: 'lssd-menu-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false', title: 'LSS Design' }, 'Design');
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const open = menu.hidden;
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', e => {
            if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) {
                menu.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        list.append(el('li', { id: 'lssd-menu-li' }, btn, menu));
        updateMenu();
    }

    function updateMenu() {
        const menu = document.getElementById('lssd-menu');
        if (!menu) return;
        menu.querySelectorAll('.lssd-seg button').forEach(b => b.setAttribute('aria-pressed', String(String(settings[b.dataset.key]) === b.dataset.value)));
        menu.querySelector('.lssd-off').textContent = settings.on ? 'Design ausschalten (Original)' : 'Design einschalten';
    }

    /* ------------------------------------------------------------------ *
     * Schnellsuche: Einsatz, Wache oder Fahrzeug (Taste /)
     * ------------------------------------------------------------------ */

    const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

    function searchSources(term) {
        const words = norm(term).split(' ').filter(Boolean);
        const fits = text => {
            const t = norm(text);
            return words.every(w => t.includes(w));
        };
        const groups = [];
        const missions = Array.from(document.querySelectorAll('.missionSideBarEntry'))
            .filter(m => fits(m.getAttribute('search_attribute')))
            .slice(0, 8)
            .map(m => {
                const id = m.getAttribute('mission_id');
                const caption = document.getElementById(`mission_caption_${id}`);
                const address = document.getElementById(`mission_address_${id}`);
                const name = caption ? (caption.firstChild ? caption.firstChild.textContent : caption.textContent).replace(/,\s*$/, '').trim() : m.getAttribute('search_attribute');
                return { title: name, sub: address ? address.textContent.trim() : '', open: () => (document.getElementById(`alarm_button_${id}`) || {}).click?.() };
            });
        if (missions.length) groups.push(['Einsätze', missions]);
        const buildings = Array.from(document.querySelectorAll('#building_list > li.building_list_li'))
            .filter(b => fits(b.getAttribute('search_attribute')))
            .slice(0, 6)
            .map(b => {
                const id = b.id.replace('building_list_', '');
                return { title: b.getAttribute('search_attribute'), sub: 'Wache öffnen', open: () => (document.getElementById(`building_button_${id}`) || {}).click?.() };
            });
        if (buildings.length) groups.push(['Wachen', buildings]);
        const vehicles = Array.from(document.querySelectorAll('#building_list .vehicle_building_list_button'))
            .filter(v => fits(v.textContent))
            .slice(0, 8)
            .map(v => {
                const fms = v.parentElement && v.parentElement.querySelector('.building_list_fms');
                return { title: v.textContent.trim(), sub: fms ? `Status ${fms.textContent.trim()}${fms.title ? ` · ${fms.title}` : ''}` : '', open: () => v.click() };
            });
        if (vehicles.length) groups.push(['Fahrzeuge', vehicles]);
        return groups;
    }

    function buildSearch() {
        const list = document.querySelector('#navbar-main-collapse > ul.navbar-right') || document.querySelector('#navbar-main-collapse > ul');
        if (!list || document.getElementById('lssd-search-li')) return;
        const input = el('input', { id: 'lssd-search', type: 'search', placeholder: 'Einsatz, Wache, Fahrzeug …', autocomplete: 'off', 'aria-label': 'Schnellsuche', 'aria-controls': 'lssd-results' });
        const results = el('div', { id: 'lssd-results', role: 'listbox', hidden: '' });
        const li = el('li', { id: 'lssd-search-li', class: 'lssd-needs-on' }, input, el('span', { id: 'lssd-search-key', 'aria-hidden': 'true' }, '/'), results);
        list.insertBefore(li, list.firstChild);

        let hits = [];
        let active = -1;
        const close = () => {
            results.hidden = true;
            active = -1;
        };
        const mark = () => results.querySelectorAll('.lssd-hit').forEach((b, i) => b.setAttribute('aria-selected', String(i === active)));
        const render = () => {
            const term = input.value;
            results.textContent = '';
            hits = [];
            active = -1;
            if (norm(term).length < 2) return close();
            const groups = searchSources(term);
            groups.forEach(([label, items]) => {
                results.append(el('div', { class: 'lssd-group' }, label));
                items.forEach(item => {
                    const index = hits.length;
                    hits.push(item);
                    results.append(
                        el('button', { type: 'button', class: 'lssd-hit', role: 'option', onclick: () => choose(index), onmouseenter: () => ((active = index), mark()) }, item.title, item.sub ? el('small', {}, item.sub) : '')
                    );
                });
            });
            if (!hits.length) results.append(el('div', { class: 'lssd-empty' }, 'Nichts gefunden. Fahrzeuge findet die Suche nur aus Wachen, deren Fahrzeugliste das Spiel schon geladen hat.'));
            results.hidden = false;
        };
        const choose = index => {
            const item = hits[index];
            close();
            input.value = '';
            input.blur();
            if (item) item.open();
        };
        input.addEventListener('input', render);
        input.addEventListener('focus', render);
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!hits.length) return;
                active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
                mark();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(active >= 0 ? active : 0);
            } else if (e.key === 'Escape') {
                close();
                input.blur();
            }
        });
        document.addEventListener('click', e => {
            if (!li.contains(e.target)) close();
        });
        // "/" springt in die Suche, außer man tippt gerade irgendwo
        document.addEventListener('keydown', e => {
            if (!settings.on || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
            e.preventDefault();
            input.focus();
        });
    }

    /* ------------------------------------------------------------------ *
     * Start
     * ------------------------------------------------------------------ */

    injectStyle();
    apply();

    function onReady() {
        moveStyleLast();
        syncBodyDark();
        if (isMain && document.getElementById('row-main-template')) {
            buildTabs();
            buildMenu();
            buildSearch();
            trackNavbar();
        }
        apply();
        // Die Karte wird teils erst nach DOMContentLoaded angelegt
        window.addEventListener('load', invalidateMap);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();

    // Umschalten in einem Fenster gilt sofort auch in allen anderen (Hauptseite, Einsatzfenster)
    window.addEventListener('storage', e => {
        if (e.key !== KEY) return;
        settings = load();
        apply();
    });
})();
