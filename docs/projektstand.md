# Projektstand

## Elektro/Gas-Standortsuche (22.10.2026)

- Kraftstoffauswahl ergänzt: Benzin (E5/E10 ausdrücklich benannt), Diesel,
  Elektro und Gas (LPG/CNG). Neue Standortansicht mit Karte, Liste, Entfernung,
  Sortierung und Routenlinks; bekannte Anschlüsse und Öffnungszeiten als OSM-Angaben.
- Keine erfundenen Preise oder Belegungsdaten. Bestehende Preisverläufe und
  Datenbank unverändert; separate Standort-API mit begrenztem Cache und Abruflimit.
- 57 Standard-Backend-Tests und 27 Frontend-Tests bestanden, Produktionsbuild
  und ESLint erfolgreich. Browser-Komponentenprüfung mit markierten Testdaten.
- Live-Abruf der Standorte noch nicht erfolgreich: externe Server lieferten
  HTTP 406 bzw. Zeitlimits. Diese Einschränkung bleibt ausdrücklich offen.
  Details: docs/elektro-gas.md.

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

## Preisverlaufsdiagramm (17.10.2026)

- Ergebnisliste um Tankstellenauswahl für den Preisverlauf erweitert.
- Recharts-Diagramm mit zeitproportionaler Achse, Tooltip und ergänzender
  Messwerttabelle; Minimum, Maximum und Anzahl der gespeicherten Beobachtungen.
- Kraftstoff aus der Suche sowie Zeiträume 24 Stunden, 7 und 30 Tage.
  Datenbankabruf über bestehende REST-API; kein zusätzlicher Tankerkönig-Aufruf
  beim Laden des Verlaufs oder Wechseln der Auswahl.
- Lade-, Fehler- und Leerzustände sowie Hinweis bei nur einer Beobachtung.
  Alte Anfragen werden beim Auswahlwechsel abgebrochen. Diagrammbibliothek
  wird erst bei Bedarf geladen. Grenzen der Messdaten sichtbar erläutert.
- Build, TypeScript und ESLint bestanden. Browserprüfung mit PostgreSQL:
  sieben Beobachtungen je ausgewählter Tankstelle, Tankstellenwechsel,
  E10/Diesel-Wechsel, Zeitraumwechsel und aufklappbare Messwerttabelle geprüft.
  Ein Live-Abruf für Detmold mit 13 Tankstellen am 17.10.2026 um 12:05:06 Uhr.
- Technische Hinweise in docs/price-history.md; lokale Vorschau unter
  tmp/price-history.png. Docker, Backend (8080) und Frontend (5173) gestartet.

## Preisübersicht der Suchergebnisse (17.10.2026)

- Günstigster Preis, arithmetischer Durchschnitt, höchster Preis und Preisspanne
  für den ausgewählten Kraftstoff oberhalb der Karte ergänzt.
- Grundlage sichtbar erläutert: nur beim Abruf geöffnete Tankstellen mit
  verfügbarem Preis; Zahl berücksichtigter Ergebnisse und Preisgleichstände.
- Lokale Berechnung ohne zusätzliche Anbieteranfrage beim Kraftstoffwechsel.
- Fünf automatisierte Tests mit synthetischen Daten prüfen Filterung, leere
  Ergebnisse, Einzelpreise, Preisgleichstände, Genauigkeit und Kraftstoffwechsel.
  Ausführen mit npm test im frontend-Ordner (Node.js 24).
- Tests, Build und ESLint bestanden. Im Browser E10/Diesel anhand von 13
  Detmolder Tankstellen geprüft, Datenstand 17.10.2026 12:09:56 Uhr Berlin.
- Berechnungsdefinitionen in docs/price-comparison.md, lokale Vorschau unter
  tmp/price-comparison.png.

## Gesamttest und Dokumentationsstand (17.10.2026)

- Vollständiger bestehender Testlauf: 42 Backend- und 5 Frontend-Tests bestanden;
  TypeScript/Vite-Build und ESLint bestanden.
- PostgreSQL healthy; lokale HTTP-Prüfungen für Health, 400, 404 und leeren
  Verlauf erfolgreich. Browserprüfung von Entfernungssortierung, Verlauf aus
  sortierter Liste und Auswahlzurücksetzung nach Eingabeänderung.
- Vorhandenes Suchergebnis weiterverwendet; kein neuer Anbieter-Preisabruf
  für diesen Gesamttest. Keine Änderungen an Datenbankvolume oder Zugangsdaten.
- README um tatsächlichen Funktionsstand, Einrichtung, Start über PowerShell
  und IntelliJ, Tests sowie Fehlerbehebung ergänzt. Veraltete REST-Hinweise korrigiert.
- Architektur und relationales Datenmodell in docs/architektur.md beschrieben.
  Ausgeführte Prüfungen und ausdrücklich offene Abgabepunkte stehen in
  docs/testprotokoll.md. Keine vollständige Abnahme oder Produktionsfreigabe.

## Dashboard-Gestaltung (17.10.2026)

- Neue helle Oberfläche mit dunkelgrüner Navigation, Markenzeichen und
  Einstieg „Besser tanken. Klarer entscheiden.“; eigenes Favicon und deutscher Seitentitel.
- Suche in Ort und Suchoptionen gegliedert; Preiskennzahlen als vier Karten.
  Günstigste Tankstellen zeigen nun auch Adressen zur Unterscheidung gleicher Namen.
- Karte und scrollbare Tankstellenliste stehen auf großen Bildschirmen nebeneinander,
  auf kleineren darunter. Verlaufdiagramm und Lade-/Leerzustände visuell angepasst.
- Navigation zu Suche, Ergebnissen und Verlauf; Skip-Link, sichtbare Fokusmarkierungen,
  Hinweis zu reduzierter Bewegung und eingeklappte System-/Demobereiche.
- Browserprüfung bei 1440, 900, 390 und 320 Pixeln: kein horizontaler Seitenüberlauf
  in den geprüften Zuständen. Bei 1440/390 Pixeln Suche, Preisübersicht, Karten-Popup,
  Rückkehr zum Suchgebiet, Tankstellenauswahl und Verlauf geprüft. Kraftstoffwechsel
  und Entfernungssortierung funktionieren weiterhin lokal.
- Ein Preisabruf für Detmold (13 Tankstellen, 17.10.2026 12:33:55 Uhr Berlin).
  Vorhandene Preisverläufe verwendet; keine Änderung an Backend oder Datenbankschema.
- Fünf Frontend-Tests, Build und ESLint bestanden. Vorschauen lokal unter
  tmp/dashboard-desktop.png und tmp/dashboard-mobile.png.

## Tankkostenrechner (17.10.2026)

- Einstellbare Tankmenge von 0,1 bis 200 Litern mit einer Nachkommastelle;
  Vorgabe 40 Liter, Schnellauswahl 20/40/60 Liter, Komma und Punkt akzeptiert.
- Übersicht für günstigste/teuerste Füllung und Preisunterschied. Kosten und
  Differenz zum günstigsten Füllbetrag zusätzlich je Tankstelle in der Liste.
- Berechnung aus dem bestehenden Suchergebnis; nur geöffnete Tankstellen mit
  verfügbarem Preis. Keine zusätzliche Anbieteranfrage bei Mengen-/Kraftstoffwechsel.
- Centgenaue Rundung vollständiger Füllbeträge; ungültige Eingaben zeigen keine
  alten Kosten. Fahrtkosten und Umwege sind ausdrücklich nicht berücksichtigt.
- Zehn Frontend-Tests bestanden, Build und ESLint bestanden. Synthetische
  UI-Prüfung ergänzt unter /tests/tank-calculator.html im Vite-Entwicklungsserver.
- Browserprüfung: 35,5 Liter, leere Eingabe, Schnellauswahl, Kraftstoffwechsel,
  fehlende Preise und geschlossene Tankstellen mit gekennzeichneten Testdaten.
  Isolierte Komponente auf 390 Pixeln ohne horizontalen Überlauf geprüft.
- Erster Live-Versuch lieferte HTTP 502. Nach Mindestabstand erneuter Abruf
  erfolgreich: 13 Tankstellen Detmold, 17.10.2026 13:04:58 Uhr Berlin.
  Beträge für 40/35,5 Liter sowie Tabellenunterschiede und E10/Diesel geprüft.
- Details in docs/tank-costs.md, lokale Vorschau unter tmp/tank-costs.png.

## Vergleich mehrerer Preisverläufe (17.10.2026)

- Bis zu drei Tankstellen aus demselben Suchergebnis mit gemeinsamen Zeitachsen,
  unterschiedlichen Farben und Linienmustern sowie einer Messwerttabelle.
- Ausgangstankstelle plus zwei optionale Checkboxen; Auswahlbegrenzung und Reset.
  Kraftstoffwechsel, Zeitraum und Neuladen verwenden gespeicherte Daten.
- Keine Auffüllung fehlender Werte und keine Rangfolge aus zeitversetzten Preisen.
  Ladefehler, leere Verläufe und Einzelpunkte werden je Tankstelle angezeigt.
- 17 Frontend-Tests, Build und ESLint bestanden. Isolierte Browserprüfung mit
  synthetischen Daten: drei Stationen, Begrenzung, Reset, Teilfehler, leere Daten,
  Kraftstoff-/Zeitraumwechsel, Neuladen und Messwerttabelle.
- Bei 390 Pixeln kein horizontaler Seitenüberlauf, auch mit geöffneter Tabelle.
  Vorschauen: tmp/history-comparison.png und tmp/history-comparison-mobile.png.
  Für diese Funktion keine neuen Live-Preise abgerufen; Backend unverändert.

## Kennzahlen gespeicherter Preisverläufe (17.10.2026)

- Auswertung je ausgewählter Tankstelle mit Minimum, Maximum, arithmetischem
  Mittel, Messanzahl und Zeitpunkt der ersten/letzten Messung im gewählten Fenster.
- Durchschnitt ausdrücklich als gleich gewichteter Abrufdurchschnitt erklärt;
  keine Prognose oder zeitgewichtete Aussage. Einzelmessung mit eigenem Hinweis,
  leere und fehlerhafte Verläufe ohne scheinbare Nullpreise.
- Berechnung aus bereits geladenen Daten, ohne zusätzliche Anbieter-/API-Anfragen.
- 19 Frontend-Tests sowie Build und ESLint bestanden. Synthetische Browserprüfung
  für drei Stationen, Einzelmessung, Teilfehler und leeren Kraftstoffzustand.
  Bei 390 Pixeln kein horizontaler Seitenüberlauf. Vorschau: tmp/history-statistics.png.

## Routen und ergänzende Projektfunktionen (17.10.2026)

- Google-Maps-Routenlinks in Liste, Karten-Popup und Favoriten. Nur das Ziel
  wird im Link übergeben; Luftlinie bleibt von externer Fahrstrecke getrennt.
- Bis zu 50 lokale Favoriten ohne Preise; Filter für aktuelle Liste/Karte und
  Suche um einen gemerkten Standort. Fehler im Browserspeicher mit Meldung.
- Standortsuche mit ausdrücklichem Klick und Browserfreigabe; kein Tracking,
  separater Preisabruf nach Auswahl. Simulierte Erfolgs-/Fehlerfälle geprüft.
- CSV für geladene Verläufe, UTC-Zeiten, Quellenangabe, Excel-freundliches Format,
  Formelschutz, Leer-/Teilfehlermeldungen und Kennzeichnung synthetischer Daten.
- Voller Vorführmodus ohne Preis-API/Datenbank/Kartenkacheln mit fiktiven Stationen,
  Preisvergleichen, Tankkosten, Verläufen und CSV; echte/Demo-Favoriten getrennt.
- Vier echte PostgreSQL-Integrationstests in einem separaten temporären Container
  bestanden. Zusätzlich 42 Standard-Backend-Tests und 25 Frontend-Tests bestanden;
  Build und ESLint erfolgreich. Details und Grenzen im Testprotokoll.
- Ein Live-Abruf Detmold (13 Stationen, 18:07:09 Uhr Berlin), Route in Google Maps
  und im Popup geprüft, vorhandener Verlauf mit 18 Messungen angezeigt.
- Bedienung und Architekturdetails in docs/extensions.md. Browserfreigabe am
  echten Gerät und tatsächlicher Excel-Import bleiben manuelle Abnahmepunkte.

## Gesamttest und PLZ-Korrektur (17.10.2026)

- Gesamtablauf mit Ortsname und nach Korrektur PLZ 32756 geprüft. Live-Abrufe
  lieferten jeweils 13 Tankstellen; Preisbeobachtungen wurden in PostgreSQL bestätigt.
- Echter Befund: Open-Meteo fand 32756 nicht. Fünfstellige deutsche PLZ werden
  nun getrennt über Zippopotam.us/GeoNames aufgelöst, einschließlich führender
  Null, validiertem Antwortland und PLZ, eigenem ID-Namensraum und Quellenangabe.
  Der gemeinsame 24-Stunden-Cache und Ein-Sekunden-Abstand bleiben erhalten.
- Zeitüberschreitungen bei Tankerkönig sind jetzt HTTP 504 mit eigener Meldung.
  Sichere Diagnosekategorien ohne Schlüssel/URLs/Rohantworten ergänzt.
- 46 Standard-Backend-Tests und 25 Frontend-Tests bestanden. Vier weitere
  PostgreSQL-Tests separat bestanden. Build und ESLint erfolgreich.
- Detaillierte Bedienungsprüfung, CSV-Formatprüfung und Grenzen stehen im
  neuen Bericht docs/abnahme-2026-10-17.md. Keine Behauptung vollständiger Abnahme.

## Backend-Paketstruktur (18.10.2026)

- Klassen nach Aufgabe in `controller`, `service`, `repository`, `model` und
  `client` zusammengefasst; Tests entsprechend verschoben und Imports angepasst.
- Bestehende Einzelklassen und Verantwortlichkeiten erhalten. Keine zusätzlichen
  Frameworks, keine JPA-Umstellung und keine Änderung an REST-API oder Tabellen.
- Vollständiger Neubau mit `mvnw.cmd clean test`: 46 Tests bestanden; die vier
  PostgreSQL-Tests im Standardlauf planmäßig übersprungen und anschließend
  separat mit `Test-Postgres.ps1` erfolgreich ausgeführt.
- Struktur und Zuständigkeiten in docs/architektur.md dokumentiert.

## Störung der Ortsnamensuche (18.10.2026)

- Backend-Status antwortet mit HTTP 200. Die Suche nach Berlin liefert HTTP 502;
  direkte HTTPS-Verbindungen zu Open-Meteo laufen sowohl über IPv4 als auch IPv6
  in ein Verbindungszeitlimit. Die Ursache beim Anbieter oder auf dem Netzwerkweg
  ist damit nicht abschließend geklärt; kein Hinweis auf einen Paketfehler.
- Die unabhängige PLZ-Suche liefert für 10115 gültige Berlin-Koordinaten über
  `/api/locations`. Die Oberfläche empfiehlt bei Ausfall der Ortsnamensuche
  eine PLZ oder die ausdrücklich freizugebende Standortfunktion.
- Nur Hinweistexte im Frontend geändert; Produktionsbuild und ESLint bestanden.
