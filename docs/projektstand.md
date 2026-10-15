# Projektstand

## Erledigt

- Java 21, Git, Node.js, npm, Docker Engine, Docker Compose und VS Code geprüft.
- Maven ist nicht global verfügbar; das Backend soll einen Maven Wrapper erhalten.
- Offizielle Projektbeschreibung gelesen: Thema 4, Benzinpreise.
- Tankerkönig-Funktionen und Nutzungsbedingungen geprüft.
- Registrierung eingereicht; Freigabe des API-Schlüssels steht aus.
- Grundstruktur des Repositorys angelegt.

## Geplanter Kernumfang

- Ort und Kraftstoffsorte auswählen.
- Tankstellen mit Preisen anzeigen und nach Preis oder Entfernung sortieren.
- Externe Daten validieren und persistent in PostgreSQL speichern.
- Gespeicherte Preisbeobachtungen auswerten und visualisieren.
- Tests sowie nachvollziehbare Dokumentation und Präsentation erstellen.

Die offizielle Beschreibung nennt die Landkarte als Erweiterung.
Automatische Erfassung und Machine Learning sind keine Voraussetzungen
für die erste funktionsfähige Version.

## Entscheidungen und offene Punkte

- Backend: Java 21, Spring Boot, Maven Wrapper.
- Frontend: React, TypeScript, Vite; später Leaflet und Recharts.
- Datenbank: PostgreSQL mit Flyway-Migrationen.
- API-Schlüssel bleiben im Backend und außerhalb der Versionsverwaltung.
- Abrufzeitpunkte sind Beobachtungszeitpunkte, keine bestätigten Preisänderungszeiten.
- Automatische API-Abfragen vor Umsetzung mit den Anbieterbedingungen abgleichen.
- Datenweitergabe: Hauptseite und Registrierungs-AGB enthalten unterschiedliche Angaben;
  vor Veröffentlichung echter Datensätze oder eines öffentlichen Dienstes klären.
- Geocoding-Anbieter noch nicht endgültig festgelegt. Für öffentliches Nominatim
  gelten unter anderem höchstens eine Anfrage pro Sekunde, Anwendungskennung,
  Quellenangabe und keine Autovervollständigung.
- Abgabefrist, Bewertungsmatrix und Umfang der Ausarbeitung noch offen.

## Nächster Schritt

Spring-Boot-Grundgerüst mit Java 21, Spring Boot 4.1.1 und Maven Wrapper wurde
eingerichtet und erfolgreich auf Port 8080 gestartet.
Der Endpunkt `/api/health` und der Abruf durch das React-Frontend wurden erfolgreich geprüft.
Er prüft nur die Erreichbarkeit der Anwendung, keine Datenbank oder externen Dienste.

## Datenbankanbindung (15.10.2026)

- PostgreSQL-Container wurde erfolgreich auf 127.0.0.1:5433 geprüft.
- JDBC, PostgreSQL-Treiber und Flyway im Backend ergänzt.
- Beim Start aus backend/ wird ../.env als Properties-Datei gelesen;
  POSTGRES_PASSWORD wird lokal übernommen, ohne Passwort im Quellcode.
- V1__create_station.sql legt Tankstellen mit UUID, Adresse und Koordinaten an.
- Maven-Test mit isolierter H2-Datenbank bestanden: Migration und Tabellenzugriff geprüft.
  Dies ersetzt keine PostgreSQL-Integrationsprüfung.
- PostgreSQL-Prüfung erfolgreich: Nutzer-Startprotokoll vom 15.10.2026 bestätigt
  Verbindung zu PostgreSQL 18.6 auf Port 5433, erfolgreiche V1-Migration und
  Backend-Start auf Port 8080. Die Tabelle station ist zunächst leer.
- Bereits ausgeführte Migrationen nicht verändern; Änderungen erhalten neue Versionen.
