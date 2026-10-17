# Preisverlauf

In der Ergebnisliste öffnet „Preisverlauf ansehen“ die gespeicherten Preise
der gewählten Tankstelle. Kraftstoffauswahl aus der Suche und ein Zeitraum
von 24 Stunden, 7 oder 30 Tagen bestimmen die Anzeige. „Verlauf neu laden“
liest erneut aus der eigenen Datenbank; es erfolgt keine Tankerkönig-Abfrage.

Die Oberfläche nutzt GET `/api/stations/{id}/prices` mit `fuelType`, `from`
und `to`. Der Zeitraum umfasst die letzten N × 24 Stunden bis zum Ladezeitpunkt.
Die Zeitgrenzen werden als UTC-Instants gesendet; `from` ist inklusive,
`to` exklusive. Angezeigte Uhrzeiten verwenden Europe/Berlin.

Recharts wird erst bei Auswahl eines Verlaufs geladen. Punkte stehen für
Abrufzeitpunkte. Die gerade Verbindung dient der Orientierung und behauptet
keine bekannten Zwischenpreise. Die Preisachse wird automatisch skaliert.
Eine einzelne Beobachtung erscheint als Punkt mit entsprechendem Hinweis.
Minimum und Maximum beziehen sich ausschließlich auf die gespeicherten
Beobachtungen im gewählten Zeitraum. Exakte Werte stehen zusätzlich in
einer aufklappbaren Tabelle.

Leere Ergebnisse, Ladefehler und Zeitüberschreitung haben eigene Meldungen.
Beim Wechsel von Tankstelle, Kraftstoff oder Zeitraum wird die alte Anfrage
abgebrochen, sodass verspätete Antworten nicht den neuen Verlauf ersetzen.
Eine neue erfolgreiche Umkreissuche setzt die Verlaufsauswahl zurück.

Technische Referenz: https://recharts.github.io/en-US/api/LineChart/
