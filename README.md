# LSS Helper

Userscript für das [Leitstellenspiel](https://www.leitstellenspiel.de):
markiert passende AAOs im Einsatzfenster, legt fehlende AAOs an, prüft vorhandene,
passt die Fahrzeugbesatzung an das Personal an und leitet nach der
Krankenhaus-/Zellenwahl automatisch zum nächsten Sprechwunsch weiter.

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

## Neue Version veröffentlichen

`@version` im Skriptkopf erhöhen und auf `main` pushen (oder einen Tag `vX.Y.Z`
pushen). Der Workflow `.github/workflows/release.yml` legt dann automatisch ein
Release mit der Skriptdatei an.
