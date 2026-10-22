# Architektur und Datenmodell

## Ziel und Umfang

FuelAnalytics unterstützt den Vergleich von Tankstellenpreisen im gewählten
Umkreis. Nutzer suchen einen Ort, wählen Kraftstoff und Radius und vergleichen
Preise und Luftlinienentfernungen. Gespeicherte Beobachtungen ermöglichen
eine zeitliche Darstellung einzelner Tankstellen. Der lokale Prototyp richtet
sich an das Hochschulprojekt Datenmanagement und Visualisierung.

## Komponenten

```mermaid
flowchart LR
    Browser[React / TypeScript] -->|REST über Vite-Proxy| Backend[Spring Boot / Java 21]
    Backend -->|Ortssuche| Geo[Open-Meteo / GeoNames]
    Backend -->|expliziter Preisabruf| TK[Tankerkönig]
    Backend -->|JDBC| DB[(PostgreSQL)]
    Flyway[Flyway-Migrationen] --> DB
    Browser -->|Kartenkacheln| OSM[OpenStreetMap]
```

Der Vite-Proxy leitet im Entwicklungsbetrieb `/api` an Port 8080 weiter.
API-Schlüssel bleiben im Backend. Das Frontend verwendet Leaflet für die Karte
und Recharts für den Preisverlauf. Nur Kartenkacheln werden direkt im Browser
vom Kartenanbieter geladen.

## Paketstruktur im Backend

Unter `de.fuelanalytics.backend` sind die Klassen nach ihrer Aufgabe geordnet.
Jede Klasse bleibt in einer eigenen Datei; die Tests spiegeln die Paketstruktur.

| Paket | Verantwortung |
| --- | --- |
| `controller` | REST-Endpunkte für Status, Ortssuche, Tankstellen und Preisabruf |
| `service` | Ablauf des Preisabrufs und transaktionales Speichern der Ergebnisse |
| `repository` | Datenbankzugriff mit JDBC und SQL |
| `model` | Datenmodelle für Orte, Tankstellen, Preise und Suchergebnisse |
| `client` | HTTP-Anbindung externer Anbieter und Validierung ihrer Antworten |

`BackendApplication` bleibt im übergeordneten Paket, damit Spring die
Komponenten in allen Unterpaketen findet. `TankerkoenigMapper` gehört zum
Client-Paket, weil er externe Antworten in unsere Datenmodelle überführt.

Der Preisabruf läuft vom Controller über den Service zum Client und anschließend
über den Speicherservice zu den Repositories. Einfache Lese-Endpunkte verwenden
die Repositories direkt; eine zusätzliche Service-Klasse ohne eigene Logik
wird dafür nicht eingeführt. JDBC und Flyway bleiben für Datenzugriff und
Schemaänderungen zuständig. Die Umordnung ändert keine REST-Endpunkte oder
Datenbanktabellen.

## Ablauf einer Suche

1. Die separate Ortssuche liefert passende Namen und Koordinaten. Nutzer müssen
   einen Treffer explizit auswählen; eine Textänderung verwirft diese Auswahl.
2. Der Preisabruf sendet Koordinaten und Radius an `POST /api/search`.
3. Das Backend prüft Eingaben und Mindestabstand zwischen Anbieterabrufen.
   Es fragt Tankerkönig außerhalb einer Datenbanktransaktion ab.
4. Der Mapper validiert Datensätze. Ungültige Tankstellen werden verworfen;
   fehlende Preise werden nicht als Null gespeichert.
5. Gültige Tankstellen und Preisbeobachtungen werden gemeinsam in einer
   Transaktion gespeichert. Bei einem Speicherfehler wird keine erfolgreiche
   Suchantwort zurückgegeben.
6. Das Frontend zeigt denselben Ergebnisstand in Liste, Übersicht und Karte.
   Sortierung und Kraftstoffwechsel erfolgen lokal. Der Verlauf liest über
   einen GET-Endpunkt die eigenen gespeicherten Beobachtungen.

## Datenmodell

Die ergänzende Elektro/Gas-Suche verwendet `EnergySearchController`,
`EnergyLocationClient` und `EnergySearchResult`. Sie liest OSM-Standorte über
Overpass und verwendet einen begrenzten Speicher-Cache. Elektro verwendet
stattdessen `ChargingRegisterClient` für den lokalen offiziellen CSV-Import
der Bundesnetzagentur; Suchkoordinaten bleiben dabei im Backend. Dafür werden keine
zusätzlichen Datenbanktabellen oder Preisbeobachtungen erzeugt. Details und
Prüfgrenzen: [Elektro und Gas](elektro-gas.md).

```mermaid
erDiagram
    station ||--o{ price_observation : besitzt
    station {
        UUID id PK
        VARCHAR name
        VARCHAR brand
        VARCHAR street
        VARCHAR house_number
        VARCHAR postal_code
        VARCHAR place
        NUMERIC latitude
        NUMERIC longitude
        TIMESTAMPTZ updated_at
    }
    price_observation {
        BIGINT id PK
        UUID station_id FK
        VARCHAR fuel_type
        NUMERIC price
        TIMESTAMPTZ observed_at
    }
```

`station` speichert die zuletzt abgerufenen Metadaten. Koordinaten haben sechs
Nachkommastellen und Bereichsprüfungen. Postleitzahlen sind Zeichenfolgen,
damit führende Nullen erhalten bleiben. Ein Index unterstützt die Ortsspalte.

`price_observation` speichert positive Preise als `NUMERIC(6,3)` und erlaubt
nur `diesel`, `e5` oder `e10`. Die Kombination aus Tankstelle, Kraftstoff und
Abrufzeitpunkt ist eindeutig. Ihr eindeutiger Index unterstützt die
Verlaufsabfrage nach Tankstelle, Kraftstoff und Zeitraum. Flyway verwaltet
Schemaänderungen; bestehende Migrationen werden nicht nachträglich verändert.

## Technologieentscheidungen

| Technologie | Zweck und Begründung im Projekt |
| --- | --- |
| Java 21 / Spring Boot | Typisierte Serverlogik, REST-Endpunkte, Konfiguration und Transaktionen |
| JDBC / PostgreSQL | Explizite SQL-Abfragen und relationale Integritätsregeln für Metadaten und Zeitreihen |
| Flyway | Versionierte, nachvollziehbare Schemaeinrichtung |
| React / TypeScript / Vite | Komponenten für Suche und Visualisierung, Typprüfung und lokale Entwicklungsumgebung |
| Leaflet / OpenStreetMap | Geografische Einordnung von Tankstellen und Suchradius |
| Recharts | Interaktive Darstellung zeitlich verteilter Preisbeobachtungen |
| Docker Compose | Einheitliche lokale PostgreSQL-Instanz mit persistentem Volume |

## Aussagegrenzen und Betrieb

`observed_at` bezeichnet den eigenen Abrufzeitpunkt, nicht eine bestätigte
Preisänderung. Es gibt derzeit keinen Hintergrundsammler. Lücken zwischen
Abrufen sind unbekannt; eine Diagrammlinie rekonstruiert keine Zwischenpreise.
Der Vergleich gewichtet jede verfügbare, beim Abruf geöffnete Tankstelle gleich
und ist kein repräsentativer regionaler Marktindex. Entfernungen sind Luftlinien.

Die Anwendung hat keine Benutzerverwaltung und ist kein fertiger öffentlicher
Dienst. Anbieterlimits werden pro Backend-Instanz verwaltet. Mehrere Instanzen
benötigen eine gemeinsame Begrenzung. Vor einer Veröffentlichung sind Betrieb,
HTTPS/Proxy, Zugriffsschutz und die Nutzungsbedingungen der Daten- und
Kartenanbieter gesondert zu klären. Automatische Datenbereinigung und ein
Backup-/Wiederherstellungsprozess sind noch nicht implementiert.
