# Physikmodell der Thomson-Röhre

Grundlage: Leybold-Handblatt P3.8.5.1 „Ablenkung von Elektronen in elektrischen und magnetischen
Feldern“ ([leybold_P3.8.5.1_thomson-roehre.pdf](leybold_P3.8.5.1_thomson-roehre.pdf)).
Umgesetzt in [`js/physik.js`](../js/physik.js), Zahlenwerte in [`js/config.js`](../js/config.js).

## Koordinaten und Vorzeichen

- Wie im Handblatt: x in Strahlrichtung ab Beginn des Leuchtschirms, y senkrecht nach oben.
- Obere Platte positiv → Ablenkung nach oben.
- Spulenstrom positiv → Magnetfeld zeigt zum Betrachter → Ablenkung nach oben.

## Gerätedaten

| Größe | Wert | Quelle |
|---|---|---|
| Plattenabstand d | 5,5 cm | Handblatt, Messbeispiel |
| Leuchtschirm | x = 0 … 10 cm, y = −d/2 … +d/2 | Annahme nach Abb. 4/5 (x bis 10 cm) |
| Helmholtz-Spulen | N = 320, R = 6,7 cm | Handblatt S. 3 |
| Heizspannung U_F | 6,3 V, fest | übliche Heizspannung, Annahme |

**Bitte prüfen:** Die Maße des Leuchtschirms habe ich aus den Diagrammen abgeleitet. Wenn du die
Röhre zur Hand hast, wären die tatsächlichen Maße des Rasters hilfreich.

## Reglerbereiche

| Regler | Bereich | Schrittweite |
|---|---|---|
| Anodenspannung U_A | 0 … 5 kV | 0,1 kV |
| Plattenspannung U_P | 0 … 5 kV, Polung umschaltbar | 0,1 kV |
| Spulenstrom I | 0 … 1 A, Richtung umschaltbar | 5 mA |
| Heizung | ein / aus | – |

Die Helmholtz-Spulen halten laut einer anderen Versuchsanleitung bis 2 A aus; 1 A reicht für alle Versuche
(Handblatt bis 0,26 A, Kompensation bei etwa 0,23 A). Bei starkem Feld krümmt sich der Strahl so
stark, dass er auf eine Platte trifft (z. B. U_A = 4 kV, I = 0,5 A: bei x ≈ 6,9 cm).

Der Strahl ist nur sichtbar, wenn die Heizung an ist und U_A mindestens 1 kV beträgt. Mit steigender
Anodenspannung wird er heller (wie im Handblatt beschrieben).

## Formeln (ideale Theorie)

- Geschwindigkeit: $e\,U_A = \tfrac12 m v^2 \;\Rightarrow\; v = \sqrt{2\,\tfrac{e}{m}\,U_A}$
- Elektrisches Feld: $E = U_P / d$, Parabelbahn $y = \dfrac{E}{4\,U_A}\,x^2$ (Gl. 1)
- Magnetfeld: $B = \mu_0 \left(\tfrac45\right)^{3/2} \dfrac{N\,I}{R}$ (Gl. 4),
  Kreisbahn $y = r - \sqrt{r^2 - x^2}$ mit $r = \dfrac1B\sqrt{\dfrac{2\,m\,U_A}{e}}$ (Gl. 3)
- Gekreuzte Felder: Der Strahl bleibt gerade, wenn $v = E/B$ (Kompensation, „Wien-Filter“)
- Auswertung: $e/m = \dfrac{2\,U_A}{(B\,r)^2}$ (Gl. 5), Radius aus einem Bahnpunkt
  $r = \dfrac{x^2 + y^2}{2y}$

Die Bahn wird numerisch berechnet (Boris-Verfahren, Schritte von 0,2 mm). So funktionieren
E-Feld, B-Feld und beide zusammen mit demselben Code. Die Tests prüfen, dass die numerische Bahn
mit den Formeln oben auf 0,02 mm übereinstimmt.

Relativistische Effekte werden vernachlässigt. Bei 5 kV ist die Geschwindigkeit dadurch um etwa
0,5 % zu groß, das ist auf dem Schirm nicht sichtbar.

## Schalter „realistische Werte“

Zwei Effekte des echten Geräts, beide im Handblatt beschrieben:

1. **Elektrisches Feld nur 75 %** der Theorie: $E = 0{,}75 \cdot U_P / d$ (Gl. 2).
2. **Magnetfeld wirkt schon 0,45 cm vor dem Schirm**, weil das Spulenfeld über den Bereich der
   Platten hinausreicht. Das Handblatt nennt dafür einen Fitparameter A ≈ 0,8 cm, beschreibt
   aber nicht genau, wie er in die Bahn eingeht. Der Wert 0,45 cm ist an die 27 Messwerte der
   Tabelle auf S. 3 angepasst (mittlere Abweichung 0,05 cm; mit 0,8 cm wären es 0,10 cm).

Vergleich bei U_A = 4 kV (Ablenkung y in cm):

| Einstellung | x | ideale Theorie | realistisch | Messwert Handblatt |
|---|---|---|---|---|
| U_P = 2 kV | 9 cm | 1,84 | 1,38 | 1,4 |
| U_P = 3 kV | 9 cm | Strahl trifft Platte | 2,07 | 2,0 |
| U_P = 5 kV | 8 cm | Strahl trifft Platte | 2,73 | 2,3 |
| I = 0,10 A | 9 cm | 0,82 | 0,91 | 0,9 |
| I = 0,15 A | 9 cm | 1,25 | 1,38 | 1,4 |
| I = 0,26 A | 9 cm | 2,25 | 2,50 | 2,4 |

Der realistische Modus trifft die Messwerte bei beiden Feldern gut. Für den Unterricht heißt das:
Die ideale Theorie liefert e/m = 1,76 · 10¹¹ C/kg, der realistische Modus führt wie im echten
Versuch zu einem zu großen Wert (bei I = 0,15 A und x = 9 cm: +21 %, Handblatt: +19 %).

Kompensationsstrom bei U_A = 4 kV, U_P = 2 kV: ideal 0,226 A, realistisch 0,169 A.

## Auffälligkeit im Handblatt

Die e/m-Tabelle auf Seite 3 ist in sich nicht stimmig: Die Radien passen nicht zu den
danebenstehenden y-Werten (r = 18,1 cm gehört zu y = 2,4 cm, nicht zu y = 1,4 cm). Die Tests
verwenden deshalb nur die Messtabellen (x; y) und die y_theo-Tabelle.

## Auswertung „Rechnung anzeigen“

Umgesetzt in [`js/auswertung.js`](../js/auswertung.js). Die Rechnung richtet sich danach, welches
Feld eingeschaltet ist:

| Eingeschaltet | Rechenweg |
|---|---|
| nur Magnetfeld | B (Gl. 4) → r = (x² + y²)/(2y) aus dem Messpunkt → e/m = 2U_A/(B·r)² (Gl. 5) → Vergleich mit dem Literaturwert |
| nur elektrisches Feld | E = U_P/d → y nach Gl. 1 (im realistischen Modus zusätzlich mit Faktor 0,75), Hinweis: Die Parabel hängt nicht von e/m ab |
| beide Felder, Strahl gerade | E und B → v = E/B → e/m = v²/(2U_A) (Kompensationsmethode) |

Gerechnet wird mit dem y-Wert, den die Schüler für das gewählte x eingetragen haben. Ist dort
nichts eingetragen, wird der Wert aus der Simulation verwendet (mit Hinweis).

Die Kontrolle der Wertetabelle gilt als richtig, wenn die Ablesung höchstens 0,1 cm von der
Simulation abweicht.
