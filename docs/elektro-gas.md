# Elektro- und Gasstandorte

## Bedienung

1. Ort oder PLZ suchen und einen Treffer auswählen.
2. Unter „Kraftstoff“ Benzin (E5/E10), Diesel, Elektro oder Gas wählen.
3. Bei Elektro/Gas „Standorte suchen“ anklicken. Liste und Karte zeigen
   dieselben Treffer; sortierbar nach Luftlinie oder Name.
4. Kartenmarkierung für Details anklicken. Die Route öffnet Google Maps mit
   Zielkoordinaten; den Startpunkt dort wählen.

## Elektro: offizielles Register statt externer Overpass-Abfrage

Die Elektro-Suche verwendet einen lokal importierten Datenbestand der
[Bundesnetzagentur.de](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenkarte/start.html).
Die Daten stehen laut Anbieter unter CC BY 4.0; Quelle und Lizenz sind in der
Oberfläche verlinkt. Der aktuell importierte CSV-Datenbestand nennt als
Aktualisierungsdatum **01.09.2026**. Dieses Datum wird getrennt vom Zeitpunkt
unserer Suchantwort angezeigt. Es handelt sich ausdrücklich nicht um Live-Daten.

Im Projektordner einmalig importieren:

```powershell
.\Import-ChargingRegister.ps1
```

Das Skript lädt die offizielle CSV (etwa 56 MB), prüft Kopfzeile und Datumszeile
und ersetzt erst dann `data/charging-bnetza.csv`. Der Pfad ist in Git ignoriert.
Zugangsdaten werden nicht benötigt. Für einen neueren Datenbestand muss die
Download-URL im Skript bewusst aktualisiert werden. Kein automatischer Download
beim Serverstart oder bei jeder Suche. Auf einem weiteren Computer ist der
Import einmalig separat auszuführen.

Das Backend liest das Register bei der ersten Elektro-Suche und hält es im
Speicher. Nach einer Dateiänderung wird es erneut eingelesen. Berücksichtigt
werden Einträge mit Registerstatus „In Betrieb“, gültigen Koordinaten und
Ladeeinrichtungs-ID. Dieser Registerstatus ist keine aktuelle Belegungsmeldung.
Keine Übermittlung der Suchkoordinaten an einen externen Standortanbieter.

Angezeigt werden Betreiber/Anzeigename, Adresse, Anschlüsse, eingetragene
Leistung, gegebenenfalls Öffnungszeiten und Register-ID. Identische
Ladeeinrichtungs-IDs werden dedupliziert. Mehrere Ladeeinrichtungen können am
selben Standort liegen; die Trefferzahl zählt Registereinträge, keine einzelnen
Stecker und nicht zwingend unterschiedliche Adressen. Die Entfernung ist eine
berechnete Luftlinie. Bei mehr als 500 Treffern werden die nächsten 500 angezeigt.

## Gas: OpenStreetMap / Overpass

Gas zeigt Standorte mit ausdrücklich eingetragenem LPG- oder CNG-Angebot aus
OpenStreetMap. Quelle: © OpenStreetMap-Mitwirkende, ODbL. Abfrage über die
[Overpass-Instanz von Private.coffee](https://overpass.private.coffee/).
`access=private` und `access=no` werden ausgeschlossen; Kundenbeschränkungen
angezeigt. Andere Einträge garantieren keinen uneingeschränkten Zugang.

Gas-Anfragen nur auf Klick, mindestens fünf Sekunden zwischen ungecachten
Abfragen, maximal 100 Suchen für 30 Minuten im Cache. Kein automatischer Retry.
Höchstens 500 Standorte; die begrenzte Overpass-Antwort garantiert nicht die
nächsten 500. Anbieter-Teilfehler (`remark`) sind Fehler, keine leeren Erfolge.

## Gemeinsame Grenzen und Backend

Keine aktuellen Strom-/Gaspreise, Belegung oder bestätigten Öffnungszustände.
Unbekannte Angaben bleiben unbekannt. Die Datenbestände können unvollständig
oder veraltet sein. Kein Schreiben neuer Preisbeobachtungen in PostgreSQL.
Benzin und Diesel verwenden weiterhin Tankerkönig. Der Vorführmodus bleibt
auf die bisherigen Kraftstoffe begrenzt und löst keine neuen Anbieterabrufe aus.

`POST /api/energy/search`

```json
{"latitude":52.5244,"longitude":13.4105,"radiusKm":15,"kind":"electric"}
```

`kind`: `electric` oder `gas`. Gültige Koordinaten, Radius größer null bis 25 km.
Antwort: `fetchedAt`, `kind`, `stations`, `truncated`, `source`, `sourceDate`.
`source=bnetza` enthält den Registerstand; IDs: `bnetza:…`.
`source=osm` hat keinen bestätigten gemeinsamen Bestandsstichtag (`sourceDate=null`);
IDs: `osm:node:…`, `osm:way:…`, `osm:relation:…`. Keine Tankerkönig-UUIDs.

Konfiguration: `charging.register-file` (Standard `../data/charging-bnetza.csv`,
Start aus `backend/`) und `overpass.search-url`. Fehlendes/ungültiges Register:
HTTP 503 mit Importhinweis. Anbieterfehler: 502, Zeitlimit: 504, Abfragelimit: 429.

## Prüfung am 22.10.2026

- Offizielle CSV erfolgreich heruntergeladen und mit dem echten Backend gelesen.
- Berlin (52.5244, 13.4105), 15 km: 500 angezeigte Registereinträge,
  Begrenzung aktiv; erster Abruf inklusive Einlesen knapp drei Sekunden.
- Detmold (51.9386, 8.8732), 5 km: 75 Registereinträge.
- Echte Browserprüfung Berlin/15 km: Liste, Karte, Datum, Quellenangabe und
  Begrenzung sichtbar; kompakte Kartenpunkte statt überlappender Textmarker.
  Auf schmaler Ansicht stapeln sich Karte und Liste ohne Layoutbruch.
- 62 Standard-Backend-Tests und 28 Frontend-Tests bestanden; Build und ESLint
  erfolgreich. Vier PostgreSQL-Tests werden planmäßig separat ausgeführt und
  wurden für diese Änderung ohne Datenbankanpassung nicht erneut gestartet.
- Neue Tests: CSV mit Anführungszeichen, Semikola und mehrzeiligen Feldern,
  Datumsquelle, Koordinaten, Status, Duplikate, Radius, nächste 500 Treffer,
  fehlende Datei, Neuimport-Erkennung und quellenspezifische Antwortvalidierung.
- Gas weiterhin offen: overpass-api.de meldete Überlastung (HTTP 502),
  Private.coffee antwortete nicht rechtzeitig; eine weitere Community-Instanz
  verweigerte den Zugriff (HTTP 403). Kein erfolgreicher Gas-Live-Test bestätigt.
- Tests auf separatem Backend-Port 8081; die IntelliJ-Instanz auf 8080 bleibt
  unter Nutzerkontrolle. Für die neue Version muss sie einmal neu gestartet werden.
