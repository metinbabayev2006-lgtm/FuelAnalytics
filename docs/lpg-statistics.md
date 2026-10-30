# LPG-Statistik Deutschland

## Quellen und Bedeutung

Die Hauptreihe sind offizielle deutsche LPG-Motorfuel-Wochenpreise einschließlich Steuern aus dem Weekly Oil Bulletin der Europäischen Kommission. Kein Preis einer bestimmten Tankstelle. Aktueller Import: 1.090 vorhandene Wochen vom 03.01.2005 bis 26.10.2026. Fehlende Wochen werden nicht aufgefüllt. €/1.000 Liter werden durch 1.000 geteilt; höchstens sechs Nachkommastellen entfernen lediglich numerisches Excel-Rauschen. Die Anzeige bewahrt bis zu fünf Nachkommastellen.

Quelle und Originaldatei, Importzeit sowie SHA-256 stehen in backend/src/main/resources/data/lpg-de-weekly.json. Quelle: https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en . Die Quelldatei wird nicht verändert. Eine Aktualisierung ist ein expliziter Import und anschließender Backend-Neustart/Neubau, kein Download bei jeder Suche. Die Datumswerte bezeichnen die offiziellen Bezugsdaten, nicht den Downloadzeitpunkt.

OpenVan ist ein getrennter Vergleich unter CC BY 4.0: https://openvan.camp/de/developers . Es wird ausschließlich LPG für Deutschland mit bestätigter Währung EUR und Einheit liter verwendet. Sortenspezifische Einheiten/Währungen haben Vorrang vor Landesdefaults. CNG-null bleibt unbekannt. Der Zeitstempel fetched_at bedeutet Abruf durch OpenVan und wird nicht als bestätigter Preisstichtag ausgegeben. EU-Reihe und OpenVan werden nicht vermischt: Beim Test meldete die EU zum 26.10.2026 1,13025 €/Liter, OpenVan mit Quellabruf 26.10.2026 hingegen 1,095 €/Liter. Unterschiedliche Quelle/Methodik/Aktualität können abweichen.

## Bedienung und Statistik

Links LPG Deutschland öffnen und LPG-Statistik laden. Zeitraum 1 Jahr, 5 Jahre oder gesamter Verlauf (jeweils bezogen auf den letzten vorhandenen EU-Wert). Diagramm, Tabelle, Minimum/Maximum und arithmetischer Durchschnitt der vorhandenen Wochenwerte; jede Woche zählt gleich. Kein zeit- oder absatzgewichteter Gesamtmarktpreis. Diagrammlinien verbinden Messpunkte, Zwischenwerte bleiben unbekannt.

Gasstandorte bleiben aus OSM/Overpass. Kein nationaler LPG-Wert wird einem Kartenmarker oder einem Stationspreis zugeschrieben. Für CNG und Elektro wird kein Preis erfunden.

## Schnittstellen und Speicherung

- GET /api/lpg/national: lokaler importierter EU-Datenbestand; kein externer Abruf.
- POST /api/lpg/openvan: expliziter Anbieterabruf, sechs Stunden Cache, Fehler-Cooldown zehn Minuten; kein API-Key und kein automatisches Polling.
- GET /api/lpg/openvan/saved: bisher gespeicherte Quellstände, neueste zuerst, maximal 1.000, ohne externen Abruf.
- Flyway V3 legt ausschließlich national_lpg_snapshot an. Tankstellen/Preisbeobachtungen bleiben unverändert. Ein identischer OpenVan-Quellzeitpunkt wird atomar nur einmal gespeichert. Nationale Vergleichsdaten bleiben von Tankstellenhistorien getrennt.

## EU-Import wiederholen

Python 3 mit Standardbibliothek, keine pip-Pakete notwendig:

    python scripts/import_lpg_history.py

Vorhandene offizielle Datei alternativ mit --input DATEI.xlsx verwenden. Der Import prüft Spaltenbezeichnung DE_price_with_tax_LPG, Motorfuel-Definition, Einheit, Datum, positive Preise, Duplikate und Mindestumfang. Fehler bewahren den bisherigen JSON-Datensatz. Ein neues Quelldateiformat muss bewusst geprüft werden. Die Original-Download-URL steht im Importskript.
