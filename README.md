# Thomson-Röhre

Interaktive 3D-Simulation für den Physikunterricht (Schülerarbeit am Tablet): Ablenkung von
Elektronen im elektrischen Feld eines Plattenkondensators und im Magnetfeld eines
Helmholtz-Spulenpaars. Aufbau nach dem Leybold-Handblatt P3.8.5.1 (siehe [docs/](docs/)).

## Stand

- [x] Schritt 0: Physikmodell festgelegt → [docs/physikmodell.md](docs/physikmodell.md)
- [x] Schritt 1: Physik-Kern mit Tests (`js/physik.js`)
- [x] Schritt 2: 3D-Aufbau (Röhre, Ständer, Helmholtz-Spulen, Netzgeräte)
- [x] Schritt 3: Schieberegler, Heizung, Polung, Strahl auf dem Leuchtschirm
- [x] Schritt 4: Messen: Großansicht des Schirms, Wertetabelle, e/m
- [x] Schritt 5: Klick auf das Magnetfeld → 2D-Ansicht der Ablenkung
- [ ] Schritt 6: Feinschliff, Tablet-Bedienung, Weitergabe

## Starten

Die Simulation läuft im Browser und lädt die 3D-Bibliothek [three.js](https://threejs.org) und die
Formelbibliothek [KaTeX](https://katex.org) aus dem Internet. Weil sie aus mehreren JavaScript-Modulen besteht, muss sie über einen Webserver geöffnet
werden. Ein Doppelklick auf `index.html` reicht nicht.

- **VS Code:** Erweiterung „Live Server“ installieren, dann Rechtsklick auf `index.html` →
  „Open with Live Server“
- **Terminal:** im Projektordner `python3 -m http.server` ausführen und
  <http://localhost:8000> öffnen

## Bedienung

- **Anodenspannung U_A** (0–5 kV) und **Heizung** ein/aus: Ohne Heizung oder unter 1 kV ist kein
  Strahl zu sehen; mit steigender Spannung wird er heller.
- **Plattenspannung U_P** (0–5 kV) mit **Polung umkehren**: Die Kabel am Netzgerät werden dabei
  sichtbar umgesteckt.
- **Spulenstrom I** (0–1 A) mit **Stromrichtung umkehren**
- **Realistische Werte:** schaltet zwischen idealer Theorie und den Effekten des echten Geräts um
  (siehe [docs/physikmodell.md](docs/physikmodell.md))
- Jeder Regler hat −/+ Knöpfe für einzelne Schritte (gedrückt halten: wiederholen), damit sich
  auch auf dem Tablet genaue Werte einstellen lassen.
- Eine Statuszeile meldet, ob der Strahl über den ganzen Schirm läuft oder auf eine Platte trifft.
- **Gesamtansicht / Leuchtschirm:** Kamera auf den ganzen Aufbau oder direkt auf den Schirm

### Messen

„Leuchtschirm groß anzeigen“ öffnet die Messansicht anstelle der 3D-Szene. Das Bedienfeld bleibt
daneben, die Regler wirken sofort.

- **Großer Leuchtschirm** mit cm-, halbem cm- und mm-Raster zum genauen Ablesen
- **Wertetabelle** für x = 1 … 9 cm: Die Schüler tragen ihre abgelesenen y-Werte ein; die Punkte
  erscheinen auf dem Schirm. **Kontrolle** vergleicht mit der Simulation (richtig bei ±0,1 cm,
  Hinweis bei falschem Vorzeichen). Ändern sich die Einstellungen während einer Messreihe,
  erscheint eine Warnung.
- **Auswertung:** Nach dem eigenen Rechnen zeigt „Rechnung anzeigen“ den Rechenweg mit
  eingesetzten Zahlen, mit der eigenen Ablesung des gewählten Messpunkts. Je nach Feld:
  e/m aus dem Magnetfeld, Parabel im elektrischen Feld oder Kompensationsmethode
  (Einzelheiten in [docs/physikmodell.md](docs/physikmodell.md#auswertung-rechnung-anzeigen)).
- `index.html?ansicht=messen` öffnet direkt die Messansicht.

### Magnetfeld in 2D

Bei eingeschaltetem Spulenstrom zeigen blaue Pfeile im 3D-Aufbau das Magnetfeld zwischen den
Spulen (Richtung nach Stromrichtung, Deutlichkeit nach Stärke). **Antippen der Spulen oder der
Feldpfeile** (oder der Knopf „Ablenkung im Magnetfeld (2D)“) öffnet die 2D-Ansicht:

- Blick auf den Leuchtschirm wie im Handblatt, Magnetfeld als ⊙ (heraus) bzw. ⊗ (hinein)
- **Teilchen wählen:** negativ (Elektron), positiv oder neutral. Positives und neutrales Teilchen
  sind ein Gedankenexperiment mit gleicher Masse und Geschwindigkeit wie das Elektron: Das positive
  Teilchen wird spiegelbildlich abgelenkt (Drei-Finger-Regel der rechten Hand), das neutrale fliegt
  geradeaus. Die Auswahl gilt nur für die 2D-Ansicht.
- Ein Elektron läuft stark verlangsamt die Bahn entlang. Über das Häkchen „Pfeile“ (anfangs aus)
  lassen sich v, Lorentzkraft F_L und (bei Plattenspannung) elektrische Kraft F_el einblenden
- **Ganze Kreisbahn:** zoomt heraus und zeigt den vollständigen Kreis mit Mittelpunkt M und Radius r,
  von dem der Strahl in der Röhre nur ein kurzes Stück ist (nur bei reinem Magnetfeld)
- Werte v, B, F_L, r (und E, F_el, v = E/B bei zusätzlichem E-Feld)
- Erklärung: Lorentzkraft als Zentripetalkraft (e·v·B = m·v²/r), Drei-Finger-Regel der linken Hand
  für Elektronen
- `index.html?ansicht=feld&I=0.2` öffnet direkt die 2D-Ansicht.
- Im Hochformat (Tablet, Handy) liegt das Bedienfeld unten, im Querformat rechts.

### Startwerte per Link

Einstellungen lassen sich in der Adresse vorgeben, z. B. für Arbeitsaufträge:

| Parameter | Bedeutung | Beispiel |
|---|---|---|
| `UA` | Anodenspannung in kV | `UA=4` |
| `UP` | Plattenspannung in kV, negativ = obere Platte Minuspol | `UP=-2` |
| `I` | Spulenstrom in A, negativ = umgekehrte Richtung | `I=0.15` |
| `realistisch=1` | realistische Werte einschalten | |
| `heizung=0` | Heizung zu Beginn aus | |

Beispiel: `index.html?UA=4&UP=2&I=-0.226` zeigt die Kompensation (gerader Strahl).

## Aufbau der Szene

Ausrichtung wie in den Schaltskizzen des Handblatts (Abb. 2/3): Kathode links, der Strahl läuft
nach rechts über den Leuchtschirm. So stimmen x und y auf dem Schirm mit dem Handblatt überein.

- Thomson-Röhre im Röhrenständer: Glaskolben, Hals mit Elektronenkanone (Glühkathode,
  Wehneltzylinder, Anode), Schlitzblende, Kondensatorplatten, schräg gestellter Leuchtschirm mit
  cm-Raster, Plattenanschlüsse oben und unten am Kolben
- Helmholtz-Spulenpaar auf den H-Markierungen, in Reihe geschaltet
- Drei Netzgeräte: Anodenspannung (mit Heizung 6,3 V), Spulenstrom, Plattenspannung
- Buchsen am Röhrenständer (Rückseite): F1, F2 (Heizung), C (Kathode), A (Anode)

## Projektstruktur

```text
thomson-roehre/
├── index.html
├── css/style.css
├── docs/
│   ├── leybold_P3.8.5.1_thomson-roehre.pdf   # Handblatt (Referenz)
│   └── physikmodell.md                        # Formeln, Gerätedaten, Vergleich mit Messwerten
├── js/
│   ├── main.js          # Start und Render-Schleife
│   ├── config.js        # Konstanten, Gerätedaten, Reglerbereiche, 3D-Maße
│   ├── state.js         # Zustand (Spannungen, Strom, Polung, Heizung)
│   ├── physik.js        # Elektronenbahn, Felder, Auswertung (ohne 3D, testbar)
│   ├── szene.js         # Renderer, Kamera, Licht, Tisch
│   ├── roehre.js        # Röhre, Leuchtschirm, Strahl
│   ├── staender.js      # Röhrenständer, Helmholtz-Spulen, Feldpfeile
│   ├── netzgeraete.js   # Netzgeräte und Kabel
│   ├── bedienfeld.js    # Regler, Knöpfe, Statusanzeigen
│   ├── ansichten.js     # Umschalten 3D-Aufbau / Messansicht / 2D-Magnetfeld
│   ├── messen.js        # Messansicht: großer Schirm, Wertetabelle, Auswertung
│   ├── feldansicht.js   # 2D-Ansicht: Elektron im Magnetfeld, Kreisbahn, Kräfte
│   ├── auswertung.js    # Rechenwege für „Rechnung anzeigen“ (ohne DOM, testbar)
│   ├── hilfen.js        # Hilfsfunktionen
│   └── materialien.js   # gemeinsame Materialien
├── tests/
│   ├── physik.test.mjs
│   └── auswertung.test.mjs
└── package.json
```

## Tests

Die Physik wird mit Node.js (ab Version 22) ohne Browser getestet:

```bash
npm test
```
