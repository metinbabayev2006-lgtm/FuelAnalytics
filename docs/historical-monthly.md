# Historische Monatsdurchschnitte

Für die neueren zwölf Monate gibt es inzwischen die getrennte Quelle
**Tankerkönig · zwölf Monate** im selben historischen Archivbereich.
Diese Seite beschreibt weiterhin ausschließlich die älteren Kaggle-Monatsmittel.
Berechnung, Bedienung und Import der neuen Quelle:
[Tankerkönig-Archiv](tankerkoenig-archive.md).

## Inhalt und Bedienung

Unter **Preisverlauf → Historische Monatswerte** ein importiertes Jahr,
Kraftstoff und einen Stadtnamen wählen. **Historische Tankstellen laden**
zeigt bis zu 100 Treffer pro Seite. Bis zu drei Tankstellen markieren und
**Monatsverlauf anzeigen** anklicken. Der Stadtname muss dem historischen
Archiv entsprechen (Groß-/Kleinschreibung ist egal); beispielsweise Detmold,
Berlin, Hamburg, Bielefeld oder Dortmund.

Der erste lokale Import umfasst **2022**, Diesel, E5 und E10:
15.323 Tankstellen und 526.373 gültige Tankstellen-Kraftstoff-Monatswerte.
Nicht jede Tankstelle hat für jeden Kraftstoff zwölf Werte. Die Oberfläche
zeigt die vorhandenen Monate und lässt Lücken leer. Es werden keine Preise
geschätzt oder aus heutigen Preisen rückwärts ergänzt.

Dies sind Monatsdurchschnitte, keine einzelnen Preisänderungen und keine
aktuellen zwölf Monate. Das Minimum/Maximum betrifft die vorhandenen
Monatsmittel. Ihr arithmetisches Mittel gewichtet jeden vorhandenen Monat
gleich; es ist kein bestätigter zeitgewichteter Jahresdurchschnitt.
**Eigene Messungen** bleiben eine getrennte Ansicht.

## Quelle und Herkunft

- [Petrol/Gas Stations Germany, Ole und Mitwirkende auf Kaggle](https://www.kaggle.com/datasets/oles04/petrol-station-germany), Version 2.
- Dateien: `aggregated_years/aggregated2022.csv` und `stations.csv`.
- Ursprüngliche Preisquelle laut Datensatz: Tankerkönig.
- Lizenz laut Datensatz: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- Der Datensatz beschreibt 2014–2023. Verfügbarkeit eines Dateinamens bedeutet
  keine vollständige Jahresabdeckung. Nur erfolgreich importierte Jahre erscheinen.
- Monatsaggregation wird aus der Quelle übernommen; ihre genaue Gewichtung
  ist nicht als zeitgewichtet bestätigt. Keine Aussage über Transaktionspreise.

Beim Import am 30.10.2026 wurden 15.805 ungültige Preisfelder (etwa 0/NaN),
77 Zeilen ohne passende Tankstellen-Metadaten und 5.140 Zeilen außerhalb von
2022 ausgeschlossen. Die angebliche 2022-Datei enthält auch Dezember 2021;
diese Zeilen wurden ausdrücklich nicht umdatiert. Quelltexte können historische
oder fehlerhaft kodierte Namen enthalten. Stationen können inzwischen geschlossen sein.

Importzeitpunkt, Dateiprüfsummen (SHA-256), Version, Quelle, Lizenz und
Ausschlusszahlen werden in PostgreSQL gespeichert. Preisgenauigkeit wird
auf höchstens sechs Nachkommastellen begrenzt.

## Einrichtung auf einem weiteren Rechner

Python 3, Docker Desktop und das Projekt werden benötigt. Im Projektordner:

```powershell
docker compose up -d --wait
```

Das Backend einmal starten, damit Flyway die Migration V4 anlegt. Danach:

```powershell
py -3 scripts/download_monthly_history.py --year 2022
py -3 scripts/import_monthly_history.py --year 2022
```

Es werden nur die ausgewählte Jahresdatei und die Tankstellenliste geladen,
nicht das gesamte große Datenpaket. Die Anzeige benötigt danach weder Kaggle
noch einen Tankerkönig-Schlüssel. Backend und PostgreSQL müssen zum Lesen laufen.
Die Dateien unter `data/kaggle/` sowie der Docker-Datenbestand werden nicht
über Git synchronisiert. Auf einem anderen Rechner den Import wiederholen.

Nur validieren und SQL vorbereiten, ohne Datenbankänderung:

```powershell
py -3 scripts/import_monthly_history.py --year 2022 --prepare-only
py -3 scripts/test_monthly_import.py
```

Der Import ersetzt innerhalb einer Transaktion ausschließlich historische
Monatswerte des ausgewählten Jahres; erneutes Importieren erzeugt keine
doppelten Monatsschlüssel. Ungültige Struktur oder doppelte Quellmonate brechen
die Vorbereitung ab. Datenbankfehler führen zum Rollback. Die Tabellen
`station` und `price_observation` bleiben unberührt.

## Aufbau und spätere Tankerkönig-Daten

V4 legt `historical_station`, `historical_monthly_import` und
`historical_monthly_price` an. Controller und JDBC-Repository liefern ausschließlich
gespeicherte Daten. Keine Hintergrundabfragen, kein Scraping, kein automatischer
Massendatenabruf über die Live-API.

Der Tankerkönig-Importer verarbeitet Preisänderungen über separate Tagesintegrale
und bildet daraus zeitgewichtete Monatsmittel mit Abdeckungszahlen. Die
unbekannte Aggregationsmethode der älteren Kaggle-Quelle wird dadurch nicht
nachträglich als zeitgewichtet bezeichnet. Beide Quellen bleiben unterscheidbar.
