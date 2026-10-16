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
- V2__create_price_observation.sql ergänzt Preisbeobachtungen mit Tankstellenbezug,
  Kraftstoffsorte, positivem Dezimalpreis (drei Nachkommastellen) und Abrufzeitpunkt.
  Gleiche Tankstelle/Sorte/Zeitpunkt sind eindeutig; dieser Index unterstützt Verläufe.
  Fehlende Preise werden nicht als Nullpreis gespeichert. Gleiche Preise zu
  unterschiedlichen Abrufzeiten bleiben eigenständige Beobachtungen.
- V2 erfolgreich auf PostgreSQL angewendet: Nutzer-Startprotokoll vom 15.10.2026
  um 21:25 bestätigt Schema-Version 2 und Backend-Start auf Port 8080.
- Nächster Schritt: V2-Stand in Git sichern, danach Datenzugriff für Tankstellen
  und Preisbeobachtungen implementieren. API-Key-Freigabe noch nicht bestätigt.

## Java-Datenzugriff (16.10.2026)

- Station als Java-Record mit UUID, Adressfeldern, Koordinaten und UTC-Zeitpunkt ergänzt.
- StationRepository verwendet JdbcTemplate und parametrisierte SQL-Anweisungen.
  save legt neue Stationen an; update ändert vorhandene; findById liefert Optional.
- Sechs Repository-Tests auf isoliertem H2 bestanden: vollständiger Datensatz,
  optionale Felder, unbekannte ID, Aktualisierung, Update einer unbekannten ID
  und Zurückweisung doppelter IDs. Alle bestehenden Maven-Tests ebenfalls bestanden.
- Die Repository-Tests schreiben keine Beispieldaten in die lokale PostgreSQL-Datenbank.
  Ein eigener PostgreSQL-Repository-Integrationstest steht noch aus.
- IntelliJ: BackendApplication mit Java 21 und Arbeitsverzeichnis backend eingerichtet;
  Frontend als npm-Konfiguration mit Skript dev eingerichtet und Verbindung geprüft.
- Preisbeobachtungen: PriceObservation, FuelType und PriceObservationRepository ergänzt.
  Speichern und chronologisches Auslesen nach Tankstelle, Sorte und Zeitintervall
  [von, bis) sind implementiert; Preise verwenden BigDecimal, Zeitpunkte Instant.
- Sieben neue H2-Repository-Tests bestanden (Sortierung, Filter, Intervallgrenzen,
  leere Historie, Duplikate, fehlende Tankstelle und ungültiges Intervall).
  Gesamter Maven-Testlauf erfolgreich. PostgreSQL-Repository-Test weiterhin offen.
- REST-Schnittstelle ergänzt: GET /api/stations/{id} und
  GET /api/stations/{id}/prices mit Kraftstoffsorte und Zeitintervall.
  Details und Fehlercodes stehen in docs/rest-api.md.
- Lokaler REST-Test nach IntelliJ-Neustart erfolgreich (ungültige UUID: HTTP 400).
- Synthetische Demo-Tankstelle (UUID 11111111-1111-4111-8111-111111111111)
  und drei fiktive E10-Preise über docs/demo-data.sql in PostgreSQL eingespielt.
  Keine echten Marktpreise; Metadaten sind ausdrücklich als Demo gekennzeichnet.
- React-Komponente DemoStation lädt die synthetische Tankstelle und E10-Beobachtungen
  über den Vite-Proxy. Anzeige mit drei Preisnachkommastellen, Berliner Uhrzeiten,
  Demo-Kennzeichnung sowie Lade-, Fehler- und Leerzustand. Zeitraum ist für diese
  Demo fest auf 16.10.2026 (UTC-Tagesgrenzen) eingestellt.
- Frontend-Build und ESLint bestanden; beide API-Abfragen über Port 5173 geprüft.

## Tankerkönig-Client (16.10.2026)

- Nutzer hat den persönlichen Schlüssel erhalten und in der ignorierten .env hinterlegt.
  Vorhandensein ohne Ausgabe des Werts geprüft.
- Interner TankerkoenigClient ruft list.php mit type=all und sort=dist ab.
  Radius und Koordinaten werden vor HTTP geprüft. Verbindungs-/Anfrage-Timeouts,
  Prüfung von ok und stations sowie bereinigte Fehler ohne Schlüssel ergänzt.
- Mindestabstand 61 Sekunden zwischen Abrufversuchen innerhalb einer Backend-Instanz;
  keine automatischen Wiederholungen und keine Hintergrundabfragen.
  Bei Neustarts oder mehreren Instanzen muss die Abfragefrequenz zusätzlich beachtet werden.
- Fünf Tests gegen lokalen Fake-HTTP-Server und gesamter Maven-Testlauf bestanden.
  Noch kein echter Tankerkönig-Abruf durchgeführt.
- Nächster Schritt: einzelne Stations-/Preisfelder validieren, transaktional speichern
  und einen nutzerinitiierten Suchendpunkt bereitstellen. Client allein persistiert nichts.

## Umkreissuche und Speicherung (16.10.2026)

- POST /api/search ergänzt; Koordinaten und Radius werden vor HTTP geprüft.
- TankerkoenigMapper validiert UUID, Pflichtfelder, Feldlängen, Koordinaten,
  Entfernung, Öffnungsstatus und Dezimalpreise; ungültige Stationen werden gezählt.
- Geschlossene Stationen bleiben im Ergebnis; verfügbare Preise fehlen dort bewusst.
- SearchResultStore speichert validierte Metadaten und Beobachtungen transaktional.
  HTTP-Abruf erfolgt vor Beginn der Datenbanktransaktion.
- Vier Mapper-Tests und zwei H2-Speichertests (einschließlich Rollback) bestanden.
- Echte API-Abfrage und PostgreSQL-Ende-zu-Ende-Prüfung noch offen.
- Nächster Schritt: Backend neu starten und eine nutzergewählte Region einmal abrufen.

## Erster Live-Abruf (16.10.2026)

- Nutzer wählte Detmold. Einmaliger Abruf um 17:08:45 Uhr Europe/Berlin,
  Mittelpunkt 51.93855 / 8.87318, Radius 5 km.
- HTTP 200, 13 gültige Tankstellen, keine verworfenen Datensätze,
  39 Preisbeobachtungen (Diesel, E5, E10) gespeichert.
- Kein weiterer API-Abruf zur Nachprüfung: Speicherung direkt per SQL kontrolliert.
- Frontend zeigt weiterhin nur synthetische Demodaten; Live-Anzeige folgt separat.

## Live-Oberfläche Detmold (16.10.2026)

- LiveSearch zeigt eine feste Detmold-Umkreissuche (5 km), ausgelöst per Button.
- Kraftstoffauswahl und Sortierung nach Preis/Entfernung erfolgen lokal ohne HTTP.
- Abrufzeit, Öffnungsstatus, fehlende Preise, Datenquelle und Lizenz sichtbar.
- 61-Sekunden-Sperre im Frontend, separate Behandlung von HTTP 429/502/503,
  Timeout, Lade- und Leerzustand. Vorherige Ergebnisse bleiben bei Fehlern datiert.
- Synthetische Demo bleibt separat eingeklappt. Ortseingabe und Karte noch offen.
- Frontend-Build und ESLint bestanden; HTTP-429-Anzeige im Browser geprüft.
- Browserprüfung erfolgreich: 13 Live-Ergebnisse angezeigt (Abruf 17:12:41 Uhr),
  Wechsel E10 zu Diesel sowie Sortierung nach Entfernung geprüft; Datenstand
  blieb dabei unverändert. Darstellung visuell geprüft.

## Freie Ortssuche: Backend (16.10.2026)

- Open-Meteo Geocoding / GeoNames gewählt, ohne weiteren API-Schlüssel.
- GET /api/locations?query=Ort liefert bis zu fünf deutsche Orte mit Koordinaten.
- 24-Stunden-Cache (max. 200 Begriffe), ein externer Abruf pro Sekunde je Instanz,
  Validierung, Timeouts und Fehlerbehandlung ergänzt.
- Nutzungsbedingungen und technische Grenzen in docs/geocoding.md dokumentiert.
- Frontend bleibt bis zum nächsten Schritt auf Detmold festgelegt.

## Freie Ortssuche: Oberfläche (16.10.2026)

- LocationPicker ergänzt: Ort/PLZ eingeben, Suche explizit auslösen und Treffer wählen.
- LiveSearch verwendet gewählte Koordinaten und Radius (1, 2, 5, 10, 15 oder 25 km).
- Bearbeitung des Ortsfelds verwirft die bisherige Auswahl; Preisabruf bleibt bis
  zur erneuten Trefferwahl deaktiviert. Preisabruf sperrt Orts- und Radiusänderungen.
- Bestehende Ergebnisse behalten Ortsbezeichnung, Radius und Datenstand ihrer Abfrage.
- Quellenangaben Open-Meteo/GeoNames sichtbar; gleichnamige Treffer zeigen Mittelpunkte.
- Frontend-Build und ESLint bestanden. Backend aus IntelliJ neu gestartet.
- Echte Geocoding-Abfragen für Detmold und Lemgo sowie Trefferwahl, Radiusänderung
  und Zurücksetzen der Auswahl im Browser geprüft. Dabei kein Tankerkönig-Aufruf.

## Interaktive Tankstellenkarte (16.10.2026)

- Leaflet mit OpenStreetMap ergänzt: Preismarkierungen, Tankstellendetails,
  Suchmittelpunkt, Radiuskreis, Zoom und Rückkehr zum Suchgebiet.
- Karte und Tabelle verwenden dasselbe Suchergebnis. Kraftstoffwechsel und
  Kartenbedienung benötigen keinen zusätzlichen Tankerkönig-Abruf.
- Quellenangabe sichtbar; Kachelfehler werden angezeigt. Hinweise in docs/maps.md.
- Frontend-Build und ESLint bestanden. Browserprüfung mit 13 Tankstellen in
  Detmold (5 km, Abruf 17:41:25 Uhr): Kacheln, Marker-Popup, Wechsel E10 zu Diesel
  und Zoom erfolgreich geprüft. Screenshot lokal unter tmp/map-search.png.
