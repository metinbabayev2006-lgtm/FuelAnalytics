# Tankkostenrechner

Nach einer erfolgreichen Tankstellensuche kann die Tankmenge eingestellt
werden. Vorgabe sind 40 Liter; Schaltflächen bieten 20, 40 und 60 Liter.
Zulässig sind 0,1 bis 200 Liter mit höchstens einer Nachkommastelle.
Dezimalkomma und Dezimalpunkt werden akzeptiert. Leere, unvollständige oder
ungültige Eingaben zeigen keine alten Berechnungswerte an.

Die Übersicht zeigt günstigste und teuerste Füllung sowie deren Preisunterschied.
In jeder Tabellenzeile stehen die Kosten für die gewählte Menge und die
Differenz zum günstigsten Füllbetrag. Grundlage sind ausschließlich Preise
des gewählten Kraftstoffs von beim Abruf geöffneten Tankstellen im Ergebnis.
Fehlende Preise werden nicht geschätzt; geschlossene Tankstellen erhalten
keinen verfügbaren Füllbetrag. Kraftstoffwechsel und Mengenänderungen werden
lokal berechnet und lösen keinen Anbieterabruf aus.

Die Berechnung verwendet ganzzahlige Tausendstel Euro für den Literpreis und
Deziliter für die Menge. Das Produkt geteilt durch 100 ergibt den Betrag in
Cent; erst der komplette Füllbetrag wird kaufmännisch auf Cent gerundet.
Beispiel mit synthetischen Werten: 1,799 €/Liter × 35,5 Liter = 63,8645 €,
angezeigt werden 63,86 €. Differenzen entstehen aus den bereits auf Cent
gerundeten Füllbeträgen, damit sie zu den angezeigten Kosten passen.

Dies ist ein Preisvergleich zum angegebenen Abrufzeitpunkt. Zwischenzeitliche
Preisänderungen, Fahrtkosten und Umwege sind nicht enthalten. Es wird keine
tatsächliche Ersparnis gegenüber einem individuellen Tankvorgang garantiert.

Automatisierte Prüfungen: `npm test` im frontend-Ordner. Die Tankkosten-Tests
decken deutsche Dezimaleingaben, Grenzen, ungültige Mengen, Rundungsfälle,
Differenzen und fehlende Preise mit synthetischen Werten ab.

Für eine manuelle UI-Prüfung ohne Live-Anbieter steht im laufenden Vite-Server
`/tests/tank-calculator.html` bereit. Sie verwendet die echten Komponenten,
enthält ausdrücklich synthetische Daten und lädt keine externen Preise.
Die Testseite wird vom normalen Produktionsbuild nicht als Einstieg ausgeliefert.
