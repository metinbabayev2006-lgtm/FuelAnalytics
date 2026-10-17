# Preisvergleich im Suchergebnis

Die Übersicht berechnet für den ausgewählten Kraftstoff Minimum, arithmetischen
Mittelwert, Maximum und Preisspanne. Grundlage ist ausschließlich das sichtbare
Suchergebnis zum angegebenen Abrufzeitpunkt. Jede berücksichtigte Tankstelle
hat dasselbe Gewicht. Es handelt sich nicht um einen regionalen Marktindex.

Berücksichtigt werden nur beim Abruf geöffnete Tankstellen mit einem gültigen,
positiven Preis für den ausgewählten Kraftstoff. Die Oberfläche zeigt die Zahl
der berücksichtigten und insgesamt gefundenen Tankstellen. Bei Preisgleichstand
werden alle günstigsten Tankstellen genannt. Ohne geeignete Preise erscheint
eine Leermeldung; es werden keine Nullpreise oder leeren Durchschnittswerte gezeigt.

Preise werden für die Berechnung in Tausendstel Euro umgerechnet, entsprechend
der Genauigkeit der gespeicherten Preise. Die Anzeige rundet den Mittelwert
erst am Ende auf drei Nachkommastellen. Preisspanne = Maximum minus Minimum.
Die Berechnung erfolgt lokal ohne weitere Anbieteranfrage.

Prüfung: `npm test` im frontend-Ordner (Node.js 24). Synthetische Tests prüfen
fehlende/ungültige Preise, geschlossene Tankstellen, Gleichstände, leere Mengen,
eine einzelne Tankstelle, Kraftstoffwechsel und Genauigkeit der Berechnung.
