# FuelAnalytics

Intelligent Fuel Price Analytics Platform – Hochschulprojekt im Modul
Datenmanagement und Visualisierung, TH OWL, Wintersemester 2026/2027.

## Ziel

Tankstellen nach Ort und Kraftstoffsorte finden, Preise und Entfernungen
vergleichen sowie gespeicherte Preisbeobachtungen analysieren und visualisieren.

## Projektstruktur

- `backend/`: Java 21, Spring Boot, JDBC und Maven Wrapper.
- `frontend/`: React, TypeScript, Vite, Leaflet und Recharts.
- `docs/`: Anforderungen, Architekturentscheidungen und Projektnotizen.
- `compose.yaml`: lokale PostgreSQL-Datenbank; Flyway verwaltet ihr Schema.

## Aktueller Stand

Implementiert sind Ortssuche, auswählbarer Radius, Abruf und Speicherung von
Tankerkönig-Preisen, Kraftstoffauswahl, Sortierung, Tankstellenkarte,
Preisvergleich sowie gespeicherte Preisverläufe als Diagramm und Tabelle.
Die Anwendung ist für den lokalen Entwicklungsbetrieb eingerichtet.

## Lokal starten (Windows / PowerShell)

Voraussetzungen: JDK 21, Node.js 24 mit npm und laufendes Docker Desktop mit
Linux-Containern. PostgreSQL läuft auf Port 5433, Backend auf 8080 und
Frontend auf 5173. Ein global installiertes Maven ist nicht erforderlich.

### 1. Einmalige Einrichtung

Im Projektordner eine `.env` aus `.env.example` anlegen, falls noch keine besteht:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

In `.env` ein eigenes lokales `POSTGRES_PASSWORD` und den persönlichen
`TANKERKOENIG_API_KEY` eintragen. Bestehende Zugangsdaten beibehalten. Die Datei
wird von Git ignoriert. Ohne API-Schlüssel sind gespeicherte Daten lesbar;
ein neuer Live-Abruf ist dann nicht möglich.

```powershell
Set-Location frontend
npm ci
Set-Location ..
```

### 2. Datenbank starten

Im Projektordner:

```powershell
docker compose up -d --wait
docker compose ps
```

Der Dienst `postgres` muss `healthy` melden. Beim ersten Backend-Start legt
Flyway die Tabellen an. Die Daten bleiben im Docker-Volume erhalten.

### 3. Backend starten

In einem Terminal, ausgehend vom Projektordner:

```powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
```

Das Terminal geöffnet lassen. `JAVA_HOME` muss auf ein JDK 21 zeigen.
Das Arbeitsverzeichnis `backend` ist erforderlich, damit die Konfiguration
die `.env` im übergeordneten Projektordner findet.

### 4. Frontend starten

In einem zweiten Terminal, ausgehend vom Projektordner:

```powershell
Set-Location frontend
npm run dev
```

Öffnen: [FuelAnalytics](http://localhost:5173/).
Status des Java-Servers: [Backend-Status](http://localhost:8080/api/health).
Der Status prüft nur die Backend-Erreichbarkeit, keine externe Datenquelle.

### Start in IntelliJ IDEA

Den gesamten Projektordner öffnen und `backend/pom.xml` als Maven-Projekt laden.
Projekt-SDK und Maven-JDK auf Java 21 setzen. Die getestete lokale Einrichtung
verwendet IntelliJs gebündeltes Maven 3. Bei einem Injector-Fehler beim Maven-Import
die Maven-Einstellung prüfen und das Projekt erneut synchronisieren.

- Backend: `BackendApplication` starten; Arbeitsverzeichnis `backend`.
- Frontend: in `frontend/package.json` das npm-Skript `dev` starten.
- Datenbank: zuvor im Projektterminal `docker compose up -d --wait` ausführen.

Terminalstart und IntelliJ-Start sind Alternativen: denselben Server nicht
gleichzeitig zweimal starten. Für die Datenbankansicht in IntelliJ gelten
Host `127.0.0.1`, Port `5433`, Datenbank/Benutzer `fuelanalytics` und das
lokale Passwort aus `.env`.

## Bedienung

1. Ort oder PLZ suchen und einen Treffer anhand seiner Koordinaten auswählen.
2. Radius und Kraftstoff wählen, dann „Preise abrufen“ anklicken.
3. Preise vergleichen, sortieren und Markierungen auf der Karte öffnen.
4. Bei einer Tankstelle „Preisverlauf ansehen“ wählen; Zeitraum einstellen.

Live-Preise werden ausschließlich auf Klick abgerufen und dabei gespeichert.
Zwischen Anbieterabrufen liegen mindestens 61 Sekunden pro Backend-Instanz.
Kraftstoffwechsel, Sortierung und Verlaufansicht lösen keinen neuen Preisabruf
aus. Preisverläufe entstehen erst durch eigene gespeicherte Abrufe und enthalten
keine automatisch verfügbaren historischen Daten. Der Datenstand ist sichtbar.

## Tests und Build

Im Ordner `backend`:

```powershell
.\mvnw.cmd test
```

Im Ordner `frontend`:

```powershell
npm test
npm run build
npm run lint
```

Die automatischen Backend-Tests verwenden H2 und lokale Anbieterattrappen,
keinen echten Tankerkönig-Aufruf. PostgreSQL und Browserabläufe werden zusätzlich
lokal geprüft. Details und Grenzen: [Testprotokoll](docs/testprotokoll.md).
`npm run build` erzeugt `frontend/dist`; für eine öffentliche Bereitstellung
fehlen noch eine gesonderte Betriebs- und Proxy-Konfiguration.

## Anhalten und Fehlerbehebung

Backend/Frontend mit IntelliJs Stop-Schaltfläche oder `Ctrl+C` im jeweiligen
Terminal anhalten. Im Projektordner beendet `docker compose stop` die Datenbank
unter Erhalt des Volumes.

- Seite nicht erreichbar: Läuft `npm run dev`, und nennt Vite Port 5173?
- Backend nicht erreichbar: Spring-Boot-Start und Port 8080 prüfen.
- Datenbankfehler: Docker Desktop, `docker compose ps`, Port 5433 und `.env` prüfen.
- Passwortfehler nach Änderung der `.env`: Ein vorhandenes PostgreSQL-Volume
  behält das bei seiner Einrichtung gesetzte Passwort. Eine Änderung der Datei
  ändert das Datenbankpasswort nicht automatisch. Nicht das Volume löschen.
- HTTP 429 beim Preisabruf: mindestens 61 Sekunden abwarten; nicht durch
  Neustarts umgehen.
- Änderungen fehlen im Browser: Seite neu laden; Java-Änderungen erfordern
  zusätzlich einen Backend-Neustart.

## Dokumentation

- [Architektur und Datenmodell](docs/architektur.md)
- [REST-API](docs/rest-api.md)
- [Ortssuche](docs/geocoding.md), [Karte](docs/maps.md)
- [Preisvergleich](docs/price-comparison.md), [Preisverlauf](docs/price-history.md)
- [Testprotokoll und offene Abgabepunkte](docs/testprotokoll.md)
- [Projektfortschritt](docs/projektstand.md)

## Zugangsdaten und Datenquellen

API-Schlüssel werden ausschließlich im Backend über die lokale Konfiguration
bereitgestellt. Keine Schlüssel, lokalen `.env`-Dateien oder echten Datensätze
in Git veröffentlichen. Beispieldaten müssen als synthetisch gekennzeichnet sein.

Vor öffentlicher Bereitstellung echter Daten sind die Nutzungsbedingungen
und die zulässige Datenweitergabe zu klären.

Tankerkönig: https://creativecommons.tankerkoenig.de/
