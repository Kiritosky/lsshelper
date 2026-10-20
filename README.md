# LSS Helper

Userscript für das [Leitstellenspiel](https://www.leitstellenspiel.de):
markiert passende AAOs im Einsatzfenster, legt fehlende AAOs an, prüft vorhandene,
passt die Fahrzeugbesatzung an das Personal an und bietet zuschaltbare
**Manager-Funktionen** (Nachbau einiger LSS-Manager-Module, z. B. fürs iPad).

## Download

**[lsshelper.user.js herunterladen (neueste Version)](https://github.com/Kiritosky/lsshelper/releases/latest/download/lsshelper.user.js)**

Alle Versionen mit Änderungen: [Releases](https://github.com/Kiritosky/lsshelper/releases)

## Installation am PC

Tampermonkey (oder Violentmonkey) installieren und den Download-Link oben öffnen –
der Manager bietet die Installation automatisch an. Updates kommen von selbst.

## Installation auf dem iPad (App „Userscripts“)

1. Die kostenlose App **Userscripts** aus dem App Store laden und einmal öffnen
   (sie fragt nach einem Ordner für die Skripte – einfach den vorgeschlagenen nehmen).
2. **Einstellungen → Apps → Safari → Erweiterungen → Userscripts** einschalten und
   bei den Berechtigungen `leitstellenspiel.de` erlauben.
3. Den Download-Link oben **in Safari** öffnen. Es erscheint der Skripttext.
4. In der Adressleiste auf das Erweiterungs-Symbol tippen → **Userscripts** →
   **Installieren**.
5. Leitstellenspiel neu laden. Im Profilmenü erscheint der Eintrag **LSS Helper**.

**Updates:** Im Userscripts-Menü in Safari auf „Nach Updates suchen“ tippen –
das Skript holt sich dann die neueste Release-Version.

### Manager-Funktionen einschalten

Profilmenü → **LSS Helper** → Reiter **Einstellungen** → Abschnitt
**Manager-Funktionen** → Hauptschalter an, gewünschte Unterpunkte wählen,
**Speichern**. Am PC mit LSS-Manager den Hauptschalter ausgeschaltet lassen,
damit nichts doppelt angezeigt wird.

### Was die Manager-Funktionen können

Jeder Punkt hat in den Einstellungen einen eigenen Schalter.

- **Touch / iPad:** Knöpfe „AAO wählen“ und „Alarm & weiter“ im Einsatzfenster,
  größere Bedienelemente.
- **Einsatzliste:** Ø Credits, Restdauer, Patienten/Gefangene, Behandlungs- und
  Abpumpzeiten, Stern (bleibt oben), einklappen, sortieren (auch für Vor/Zurück im
  Einsatzfenster), teilen, Saison-Symbole.
- **Einsatzfenster:** Ø Credits, Generierungszeit (gelb/rot bei alten bzw.
  verfallenden Einsätzen), Patienten-Zusammenfassung und Einklappen,
  Fahrzeug-/Spielerzähler, feste Kopfleiste, Karte zentrieren, Fahrzeugtyp,
  längste Anfahrtszeit, Auswahl zurücksetzen, Zähler im Bereitstellungsraum.
- **Geld:** Credits-Menü (Coins, Rang, Topliste, Verbandskasse, Ziele),
  Tageszusammenfassung nach Kategorien mit Filter und CSV-Export, Dashboard-Reiter
  „Geld“ mit dem Verlauf der letzten Tage.
- **Redesign & Sprechwünsche:** modernere Optik der Spielseiten, automatisch zum
  nächsten Sprechwunsch, Knopf „bestes Krankenhaus“ / „beste Zelle“ mit Filtern,
  Einsätze auf der Fahrzeugseite nach Credits, Suche/Sortierung/alle Seiten laden
  in Listen, Aufgaben-Seite, Gebäudeliste im Profil.
- **Gebäude & Personal:** Fahrzeugtyp und Besatzung in der Wache, Status 2 ↔ 6
  per Antippen, Personalbedarf, Ausbauten oben, Leitstelle direkt wählen,
  Sicherheitsabfrage beim Kleinwachen-Ausbau, Ausbildungsübersicht,
  „nur passendes Personal“ bei der Zuweisung.
- **Dashboard-Reiter „Übersicht“:** Fahrzeuge nach Status, Gebäude nach Typ mit
  Ausbauten, Streifen starten.

## Neue Version veröffentlichen

`@version` im Skriptkopf erhöhen und auf `main` pushen (oder einen Tag `vX.Y.Z`
pushen). Der Workflow `.github/workflows/release.yml` legt dann automatisch ein
Release mit der Skriptdatei an.
