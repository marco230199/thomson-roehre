// ------------------------------------------------------------------
// Konstanten, Gerätedaten und Reglerbereiche
// Quelle der Gerätedaten: Leybold-Handblatt P3.8.5.1 (docs/)
// ------------------------------------------------------------------

// Naturkonstanten (SI)
export const E_CHARGE = 1.602176634e-19;    // Elementarladung in C
export const E_MASS = 9.1093837015e-31;     // Elektronenmasse in kg
export const MU0 = 1.25663706212e-6;        // magnetische Feldkonstante in Vs/(Am)
export const E_OVER_M = E_CHARGE / E_MASS;  // spezifische Ladung ≈ 1,7588 · 10¹¹ C/kg

// Röhre (alle Längen in m)
export const TUBE = {
  plateDistance: 0.055,   // Plattenabstand d (Handblatt: 5,5 cm)
  screenLength: 0.10,     // Leuchtschirm in Strahlrichtung: x = 0 … 10 cm
  // Der Schirm steht schräg zwischen den Platten; sichtbar ist y = −d/2 … +d/2.
};

// Helmholtz-Spulenpaar 555 604
export const COILS = {
  turns: 320,             // Windungszahl N je Spule
  radius: 0.067,          // mittlerer Spulenradius R
};

// Effekte des realen Geräts (Schalter „realistische Werte“), beide aus dem Handblatt
export const REALISTIC = {
  fieldFactorE: 0.75,     // Gl. (2): E_exp = 0,75 · U_P / d
  magnetLeadIn: 0.0045,   // Magnetfeld wirkt schon vor dem Schirm; 0,45 cm passt am besten zu den Messwerten
};

// Reglerbereiche (Spannungen in V, Strom in A)
export const RANGES = {
  anode: { min: 0, max: 5000, step: 100, start: 4000 },
  plate: { min: 0, max: 5000, step: 100, start: 0 },
  coil: { min: 0, max: 1.0, step: 0.005, start: 0 },   // Spulen halten bis 2 A aus
};

export const HEATER_VOLTAGE = 6.3;          // Heizspannung U_F in V (fest)
export const BEAM_MIN_ANODE = 1000;         // darunter ist der Strahl zu schwach zum Sehen

// ------------------------------------------------------------------
// Maße der 3D-Darstellung in cm (1 Einheit = 1 cm)
// Ursprung: Beginn des Leuchtschirms auf der Strahlachse, Strahl in +x-Richtung,
// y nach oben, z zum Betrachter. Die Tischplatte liegt bei y = −BEAM_HEIGHT.
// ------------------------------------------------------------------
export const GEO = {
  beamHeight: 28,         // Strahlachse über dem Tisch
  bulbRadius: 6.5,        // Glaskolben, Mitte über der Schirmmitte
  neckRadius: 1.9,        // Röhrenhals mit Elektronenkanone
  neckStart: -15,         // Übergang Hals → Sockel
  capLength: 7,           // Sockel (Kathodenkappe)
  capRadius: 2.6,
  screenTilt: 15,         // Neigung des Leuchtschirms gegen die Senkrechte in Grad
  plateWidth: 4,          // Breite der Kondensatorplatten (in z)
  coilWire: 0.75,         // halbe Dicke der Spulenwicklung
};
