# Eni's Finances

Eine ruhige, persönliche Finanz-App im Atelier-Stil — auf Deutsch, mit
Schweizer Konventionen (CHF, Apostroph-Tausender, Säule 3a, BVG).

Kein Build, keine Abhängigkeiten. Nur HTML, CSS und eine kleine
JavaScript-Schicht. Deine Daten bleiben im Browser (`localStorage`).

## Loslegen

1. **`onboarding.html`** im Browser öffnen.
2. Sechs kurze Schritte — Profil → Hauptanstellung → Nebenverdienst →
   Steuern & Vorsorge → Fixkosten → variable Budgets und optional
   Startvermögen.
3. Eigene Zahlen eintragen, oder unten auf **„Demo mit Lenas Daten
   laden"** klicken.
4. Nach dem Onboarding landest du auf der Übersicht. Die Seitenleiste
   führt dich zu Einkommen, Rechnungen, Belegen und Abschluss. Unten
   findest du „Mobile Vorschau" und „Alle Daten zurücksetzen".

Wenn du `index.html` ohne abgeschlossenes Onboarding öffnest, wirst du
automatisch zur Onboarding-Seite umgeleitet.

## Bildschirme

| Datei | Inhalt |
| --- | --- |
| `onboarding.html` | 6-Schritt-Assistent, speichert lokal |
| `index.html` | **Übersicht** — Reinvermögen, Portfolio, Cashflow, anstehende Rechnungen, Ausgaben-Donut, letzte Aktivität. **+ Transaktion** öffnet ein In-App-Modal |
| `income.html` | Live Brutto → Netto-Karte. Jede Eingabe aktualisiert das Dashboard sofort |
| `bills.html` | Rechnungen bearbeiten: hinzufügen, bezahlt/anstehend togglen, bearbeiten, löschen. Filter nach Kategorie |
| `upload.html` | **Beleg-Upload**. PDF wählen → die App liest Anbieter, Betrag und Datum heraus und schlägt Ablage als Rechnung oder Transaktion vor |
| `summary.html` | Monatsabschluss — Gespart/Ein/Aus/Rate, Kategorien aus deinen Daten, anpassbare Insights |
| `summary-print.html` | Druckbare A4-Version (`@page A4`) |
| `mobile.html` | iOS-Begleiter (390 × 844) — Reinvermögen, Ein/Aus, Demnächst, Top-3-Töpfe |

## PDF-Erkennung

Auf der **Belege**-Seite kannst du ein PDF (Rechnung, Quittung) ablegen
oder über „Datei wählen" auswählen. Die App liest das PDF im Browser
mit **pdf.js** (kein Server) und extrahiert per Mustererkennung:

- **Anbieter** — Schweizer Klassiker werden direkt erkannt: Helsana /
  Krankenkasse, Migros, Coop, SBB, EWZ, Salt / Swisscom / Sunrise,
  Spotify, iCloud, Holmes Place, McFit u.v.m.
- **Betrag** — sucht nach „Total CHF", „Betrag", „CHF X.XX"-Mustern
- **Datum** — DD.MM.YYYY oder ähnliche Formate
- **Kategorie** — automatisch passend zum Anbieter (Versicherung,
  Lebensmittel, Transport …)
- **Topf** — wiederkehrende Rechnungen landen in Fixkosten, Einzelbelege
  als Variable Transaktionen

Mit „Bestätigen & ablegen" öffnet sich ein vorgefülltes Modal, in dem du
die erkannten Felder prüfen und speichern kannst.

## Dateien

- **`assets/atelier.css`** — Design-Tokens, Komponenten, Modal, Toast,
  Hover-Animationen
- **`assets/state.js`** — State-Store mit `localStorage`, abgeleitete
  Werte, Schweizer Zahlenformat, deutsche Kategorienbezeichnungen
- **`assets/app.js`** — Page-Bootstrap, Bindings, Modals, PDF-Parsing,
  Onboarding-Wizard

Alles zurücksetzen: in der Seitenleiste auf **„Alle Daten zurücksetzen"**.
