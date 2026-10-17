# Preisverlauf

In der Ergebnisliste öffnet „Preisverlauf ansehen“ die gespeicherten Preise
der gewählten Tankstelle. Kraftstoffauswahl aus der Suche und ein Zeitraum
von 24 Stunden, 7 oder 30 Tagen bestimmen die Anzeige. „Verlauf neu laden“
liest erneut aus der eigenen Datenbank; es erfolgt keine Tankerkönig-Abfrage.

Die gewählte Tankstelle bleibt als Ausgangspunkt erhalten. Über Checkboxen
lassen sich bis zu zwei weitere Tankstellen aus demselben Suchergebnis ergänzen.
Bei drei ausgewählten Tankstellen sind weitere Checkboxen deaktiviert, bis
eine Auswahl entfernt wird. Ein Zurücksetzen entfernt nur die zusätzlichen
Tankstellen. Namen und Adressen unterscheiden gleichnamige Stationen.

Die Oberfläche nutzt GET `/api/stations/{id}/prices` mit `fuelType`, `from`
und `to`. Der Zeitraum umfasst die letzten N × 24 Stunden bis zum Ladezeitpunkt.
Die Zeitgrenzen werden als UTC-Instants gesendet; `from` ist inklusive,
`to` exklusive. Angezeigte Uhrzeiten verwenden Europe/Berlin.

Recharts wird erst bei Auswahl eines Verlaufs geladen. Punkte stehen für
Abrufzeitpunkte. Die gerade Verbindung dient der Orientierung und behauptet
keine bekannten Zwischenpreise. Die Preisachse wird automatisch skaliert.
Eine einzelne Beobachtung erscheint als Punkt mit entsprechendem Hinweis.
Alle Kurven verwenden denselben Zeitraum und gemeinsame Achsen. Farben und
Linienmuster sowie eine Legende unterscheiden die Tankstellen. Unterschiedliche
Messzeitpunkte werden zusammengeführt, ohne fehlende Preise aufzufüllen oder
Nullwerte einzusetzen. Daraus wird keine Rangfolge für denselben Zeitpunkt
abgeleitet. Exakte Werte stehen zusätzlich in einer aufklappbaren Tabelle.

Leere Ergebnisse, Ladefehler und Zeitüberschreitung haben eigene Meldungen.
Beim Wechsel von Tankstelle, Kraftstoff oder Zeitraum wird die alte Anfrage
abgebrochen, sodass verspätete Antworten nicht den neuen Verlauf ersetzen.
Eine neue erfolgreiche Umkreissuche setzt die Verlaufsauswahl zurück.

Jede Tankstelle wird separat geladen und validiert. Ein Fehler oder leerer
Verlauf entfernt die erfolgreich geladenen Kurven der anderen Stationen nicht.
Die gemeinsame Zeitbegrenzung beträgt zehn Sekunden. Stabile Auswahlreferenzen
verhindern neue Verlaufanfragen durch den laufenden Such-Countdown.

Die isolierte Testseite `/tests/history-comparison.html` im Vite-Entwicklungsserver
verwendet die echte Verlaufskomponente mit ausdrücklich synthetischen Daten.
Sie bietet zeitversetzte Messungen, einen Einzelpunkt, leere Ergebnisse und
einen simulierten Ladefehler, ohne Anbieter- oder Datenbankanfragen auszuführen.

Technische Referenz: https://recharts.github.io/en-US/api/LineChart/
