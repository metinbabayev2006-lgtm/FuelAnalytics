# Persönlicher Tankerkönig-Archivzugang

Am 30.10.2026 wurde der von Tankerkönig eingerichtete persönliche Zugang
an einer Preisdatei vom 29.10.2026 erfolgreich geprüft (HTTP 200).
Die Zugangsdaten sind ausschließlich in der ignorierten lokalen `.env`
als `TANKERKOENIG_ARCHIVE_USERNAME` und `TANKERKOENIG_ARCHIVE_PASSWORD`
gespeichert. Nicht ins Frontend, in Links, Logs oder Git übernehmen.

Öffentliche Basisadresse ohne Zugangsdaten:
`https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data`

Direkte Dateipfade:

- `raw/branch/master/prices/YYYY/MM/YYYY-MM-DD-prices.csv`
- `raw/branch/master/stations/YYYY/MM/YYYY-MM-DD-stations.csv`

Die geprüfte Preisdatei enthält die Spalten
`date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change`.
Zeitstempel enthalten einen UTC-Offset. Ein bundesweiter Tagesbestand
umfasste rund 19,8 MB; Stadtauswahl beim lokalen Filtern spart Speicher in
PostgreSQL, reduziert jedoch nicht automatisch die herunterzuladende Tagesdatei.
Das vollständige Git-Repository wurde nicht geklont.

## Jahresimport und Bedienung

Erfolgreicher lokaler Erstimport am 30.10.2026: **673 Tankstellen** und
**734.607 tägliche Kraftstoffintegrale**, 366 vollständig verarbeitete
Quelldateitage einschließlich Initialisierungstag. Eigene Preisbeobachtungen
und ältere Kaggle-Monatswerte sind unverändert geblieben.

Unter **Preisverlauf → Historische Monatswerte → Tankerkönig · zwölf Monate**
eine der fünf Archivstädte und Diesel, E5 oder E10 wählen, Tankstellen laden,
bis zu drei auswählen und **Zwölfmonatsverlauf anzeigen** anklicken.
Der vorbereitete Zeitraum ist **01.10.2025 bis 01.10.2026 (Ende ausgeschlossen)**,
also Oktober 2025 bis September 2026. Es sind die letzten zwölf abgeschlossenen
Kalendermonate zum Projektstand 30.10.2026, keine automatisch wandernde Auswahl.
Die Kaggle-Jahre bleiben als eigene Archivquelle erhalten.

Die festen Städte sind Berlin, München, Frankfurt am Main, Köln und Detmold.
Jeder Tag wird gegen seine eigene Tankstellenliste gefiltert. Die Auswahl folgt
den historischen Ortsnamen (einschließlich Berliner/Kölner Stadtteil-Zusätzen),
nicht amtlichen Gemeindegrenzen oder einem Radius. Umliegende Orte werden nicht
pauschal aufgenommen. Mehrdeutiges Frankfurt wird zusätzlich räumlich geprüft,
damit Frankfurt/Oder ausgeschlossen bleibt. Angezeigte Namen/Adressen entsprechen
dem zuletzt verfügbaren Metadatenstand innerhalb des Importzeitraums.

## Import ausführen oder fortsetzen

Python 3 mit verfügbarer `Europe/Berlin`-Zeitzonendatenbank und Docker Desktop
werden benötigt. Unter Windows bei fehlender Zeitzonendatenbank `py -3 -m pip
install tzdata` ausführen. PostgreSQL starten und das Backend einmal starten,
damit Flyway V5 die getrennten Archivtabellen anlegt. Im Projektordner:

```powershell
py -3 scripts/import_tankerkoenig_archive.py
```

Standard: drei parallele Downloads, der oben genannte Zeitraum und die fünf
festen Städte. Derselbe Befehl setzt einen unterbrochenen Download fort.
Ein abgeschlossener Tag wird atomar als komprimierter Zwischenstand unter
`data/tankerkoenig-archive/2025-10-01_2026-10-01/` gespeichert. Er enthält nur
die ausgewählten Tankstellen und deren Preisänderungen; vollständige bundesweite
CSV-Dateien werden nach erfolgreicher Verarbeitung des Tages entfernt.
Ein Manifest speichert die SHA-256-Prüfsummen beider Quelldateien je Tag.
Ein zusätzlicher Tag vor Periodenbeginn liefert Startpreise, soweit bekannt.

```powershell
# Nur Download/Validierung/SQL-Vorbereitung; PostgreSQL bleibt unverändert:
py -3 scripts/import_tankerkoenig_archive.py --prepare-only
# Weniger parallele Verbindungen:
py -3 scripts/import_tankerkoenig_archive.py --workers 1
py -3 scripts/test_tankerkoenig_archive.py
```

Fehlt eine erforderliche Datei oder schlägt ihre Prüfung fehl, wird nicht
importiert. Erst nach erfolgreicher Verarbeitung aller Tage wird das Archiv
innerhalb einer PostgreSQL-Transaktion ersetzt. Erneutes Importieren dupliziert
keine Tageswerte. Fehler beim SQL-Import rollen zurück. Die Live-Tabellen und
die Kaggle-Tabellen bleiben unberührt. Git synchronisiert weder die lokalen
Zwischenstände noch das PostgreSQL-Volume; auf einem anderen Rechner ist ein
eigener Import mit persönlicher Zugangsberechtigung nötig.

## Berechnung und Lücken

Preisänderungsdaten sind keine regelmäßigen Stichproben. Der Import verwendet
die im Archiv-README dokumentierten Änderungsflags: 0 unverändert, 1 geändert,
2 entfernt, 3 neu. Ein bekannter positiver Preis gilt bis zur nächsten Änderung
oder Entfernung. Ungültige/Nullpreise führen zu einem unbekannten Intervall.
Unbekannte Anfangspreise bleiben unbekannt, bis ein gültiger Änderungswert
vorliegt. Verlässt eine Station den täglichen Ortsbestand, wird ihr alter
Preis nicht unbemerkt weitergetragen. Ein bekannter Preis am Tagesende wird
bei weiterhin vorhandener Station in den nächsten Tag übernommen.

PostgreSQL speichert pro Station, Kraftstoff und Tag die Summe
`Preis × Gültigkeitssekunden`, die bekannten Sekunden und die tatsächliche
Tageslänge. UTC-Offsets und die Berliner Kalendergrenzen berücksichtigen
23-/25-Stunden-Tage. Der Monatswert ist die Summe der Preisintegrale geteilt
durch die Summe der bekannten Sekunden. Wiederholte Preisänderungen erzeugen
dadurch keine künstliche Gewichtung.

Das Diagramm und die zusammenfassenden Kennzahlen berücksichtigen nur Monate
mit vollständig bekannter Preisgültigkeit. Die Tabelle zeigt zusätzlich
Teilwerte mit zeitlicher Abdeckung. Eine Abdeckung unter 100 % kann auch aus
einem entfernten Kraftstoffangebot entstehen; sie ist nicht automatisch ein
technischer Downloadfehler. Fehlende Werte werden weder nullgesetzt noch
interpoliert. Minimum/Maximum beziehen sich auf Monatsmittel, nicht auf
einzelne Tages- oder Transaktionspreise. Monatsmittel werden mit sechs
Nachkommastellen ausgeliefert.

## Architektur und Rechte

`archive_import`, `archive_station` und `archive_daily_price` sind getrennte
V5-Tabellen. `ArchiveHistoryController` und `ArchiveHistoryRepository` lesen
ausschließlich lokal gespeicherte Daten. Der Status meldet einen fehlenden
Import ausdrücklich; das Frontend startet keinen Download und benötigt keine
Archiv-Zugangsdaten. Die Rohänderungen bleiben in den lokalen Tages-Checkpoints
für eine nachvollziehbare Neuberechnung erhalten.

Keine kommerzielle Nutzung:
laut erhaltener Nachricht CC BY-NC-SA 4.0; Quelle und Lizenz müssen erhalten bleiben.
