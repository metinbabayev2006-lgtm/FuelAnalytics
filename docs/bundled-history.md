# Daten auf Laptop und Gruppenrechnern

Git überträgt keine laufende PostgreSQL-Datenbank. FuelAnalytics enthält deshalb
ein **versioniertes Datenpaket von rund 10,8 MB**, das beim ersten Backend-Start
automatisch in die lokale Datenbank importiert wird. Dafür wird kein zusätzlicher
Online-Server und kein persönlicher Archivzugang benötigt.

## Auf einem neuen Rechner

1. Projekt klonen bzw. die freigegebene neue Version mit `git pull` laden.
2. JDK 21, Node.js/npm und Docker Desktop bereitstellen.
3. `.env.example` nach `.env` kopieren und ein eigenes `POSTGRES_PASSWORD`
   festlegen. Persönliche Zugangsdaten anderer Personen nicht übernehmen.
4. Im Projektordner `docker compose up -d --wait` ausführen.
5. Backend in IntelliJ über `BackendApplication` starten. Flyway legt das Schema
   an; danach beginnt der Datenimport automatisch. Beim ersten Start warten,
   bis die Konsole **Bundled historical data ready** meldet.
6. Frontend wie gewohnt starten. Unter Preisverlauf die historischen Monatswerte
   öffnen. Falls die Seite schon vor Abschluss offen war, **Archivstatus erneut
   prüfen** anklicken.

Die historische Ansicht benötigt keinen `TANKERKOENIG_API_KEY`. Für neue
Live-Preisabfragen bleibt ein eigener Schlüssel erforderlich. Die Anwendung
und die lokale Datenbank müssen zum Anzeigen laufen; PostgreSQL speichert die
importierten Daten dauerhaft im vorhandenen Docker-Volume.

## Inhalt und Schutz bestehender Daten

- Tankerkönig: Oktober 2025 bis September 2026, 673 Stationen,
  734.607 tägliche Kraftstoffintegrale.
- Kaggle: 2022, fünf Städte, 617 Stationen und 21.461 Monatsmittel.
- Städte: Berlin, München, Frankfurt am Main, Köln und Detmold.
- Quellen, Lizenz, Bearbeitung und Prüfsummen:
  [Datenpaket](../backend/src/main/resources/bundled-history/README.md).

Der Import läuft erst nach Flyway und in einer Transaktion. Eine Datenbankzeile
sperrt gleichzeitige Erstimporte; SHA-256 und Zeilenzahlen werden geprüft.
Zugriff auf den persönlichen Archivserver ist dabei nicht nötig. Die Tabellen
mit eigenen Preisbeobachtungen werden nicht beschrieben.

Wenn bereits ein Tankerkönig-Archiv vorhanden ist, bleibt es erhalten. Bereits
importiertes Kaggle-Jahr 2022 bleibt ebenfalls erhalten, auch wenn es mehr Städte
umfasst. Die jeweiligen Pakete werden dann übersprungen; ein zweiter Start
erzeugt keine Duplikate. Das Paket ist kein laufender Synchronisationsdienst:
neue lokale Messungen werden nicht an Mitschüler übertragen. Ein zukünftiges
Paket überschreibt bestehende Archive nicht ungefragt; die Erweiterung eines
vorhandenen Archivs erfolgt weiterhin über den dokumentierten manuellen Import.

Fortgeschrittene können den Erstimport über
`fuelanalytics.bundled-history.enabled=false` deaktivieren. Controller-Tests
verwenden eigene Testdaten und deaktivieren ihn; ein separater Test importiert
das vollständige Paket in eine frische Datenbank und prüft den zweiten Start.

## Neues Paket erstellen

Nur der Projektverantwortliche mit den lokalen validierten Quelldateien führt
`py -3 scripts/build_bundled_history.py` aus. Das Skript liest ausschließlich
die vorbereiteten historischen Importdateien und die historische Stationsliste;
es liest weder `.env` noch die laufende Datenbank. Rohdownloads bleiben unter
`data/` ignoriert. Das komprimierte Präsentationspaket liegt bewusst unter
`backend/src/main/resources/bundled-history/`, damit es mit Git und im Backend-JAR
mitgeliefert werden kann. Der GitHub-Upload ist ein eigener, freizugebender Schritt.
