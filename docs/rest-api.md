# REST-API: gespeicherte Daten

## Tankerkönig-Archiv (zeitgewichtete Intervalle, lokal)

- `GET /api/history/archive/status`: `available` sowie bei vorhandenem Import
  `periodStart`, `periodEnd` (exklusiv, Berlin), Quelle, Lizenz, Importzeitpunkt,
  Anzahl der Quelldateitage einschließlich Starttag und verfügbare Städte.
- `GET /api/history/archive/stations?city=Detmold&fuelType=e10&offset=0`:
  höchstens 100 Treffer, `entries`/`hasMore`, Monatszahl mit bekannten Preisen.
- `GET /api/history/archive/series?fuelType=e10&stationIds=UUID,UUID`:
  bis zu drei verschiedene Tankstellen, Metadaten, Kraftstoff,
  `aggregation=time_weighted_known_intervals` und monatliche Serien.
  Jeder Punkt enthält `month`, `meanPrice` (€/l, null ohne bekannte Intervalle),
  `knownSeconds`, `totalSeconds`. Ein Teilmittel darf nicht als vollständig
  bekannter Monatswert dargestellt werden.

400 bei ungültigem Kraftstoff, UUID, doppelter/zu großer Tankstellenauswahl
oder ungültiger Seiteneingabe. 404 ohne importiertes Archiv bzw. ohne Verlauf
für die ausgewählte Station/Kraftstoffkombination. Keine externen Aufrufe.
[Import, Definition und Einschränkungen](tankerkoenig-archive.md).

## Historische Monatsmittel (lokaler Import)

- `GET /api/history/monthly/years`: tatsächlich importierte Jahre, absteigend.
- `GET /api/history/monthly/stations?year=2022&fuelType=e10&city=Detmold&offset=0`:
  `entries` und `hasMore`, maximal 100 Tankstellen pro Seite mit vorhandenen
  Monatszahlen. Exakter Stadtname, ohne Beachtung der Groß-/Kleinschreibung.
- `GET /api/history/monthly/series?year=2022&fuelType=e10&stationIds=UUID,UUID`:
  bis zu drei verschiedene Tankstellen. Antwort enthält Jahr, Kraftstoff,
  `aggregation=monthly_source_mean`, `unit=EUR/l`, Herkunft, Importzeitpunkt
  und Serien mit `month` (erster Kalendertag) und `meanPrice`.

Gültige Kraftstoffe: `diesel`, `e5`, `e10`; Jahre 2000–2100. Ungültige Eingaben
führen zu 400, unbekannte importierte Jahre oder fehlende Serien zu 404.
Fehlende Monate werden nicht ergänzt. Diese Endpunkte lesen ausschließlich
PostgreSQL und rufen keine externen Anbieter ab. Monatsmittel sind keine
Einzelmessungen. [Import und Semantik](historical-monthly.md).

Die GET-Tankstellenendpunkte lesen ausschließlich die eigene Datenbank.
Die separate GET-Ortsauflösung verwendet externe Geodatenanbieter und einen Cache.
Die POST-Umkreissuche ruft Tankerkönig ab und speichert validierte Ergebnisse.

## Aktuelle Umkreissuche (externer Abruf und Speicherung)

`POST /api/search` mit Content-Type `application/json`, beispielsweise:

```json
{"latitude":52.0,"longitude":8.9,"radiusKm":5}
```

Dieser Endpunkt ruft Tankerkönig ab und speichert validierte Tankstellen und
verfügbare Kraftstoffpreise gemeinsam in einer Transaktion. Kein automatischer
Abruf beim Backend-Start. Nur auf ausdrückliche Nutzeraktion aufrufen.

- Koordinaten und Radius sind erforderlich; Radius > 0 bis maximal 25 km.
- Antwort: observedAt, stations und rejectedStations (Anzahl verworfener Datensätze).
- Pro Ergebnis: station, open, distanceKm und prices (diesel/e5/e10, soweit verfügbar).
- Geschlossene Tankstellen bleiben enthalten, haben aber keine verfügbaren Preise.
- Fehlende oder false-Preise sind keine Nullpreise und werden nicht gespeichert.
- PLZ werden als Zeichenfolge gespeichert, numerische PLZ auf fünf Stellen ergänzt.
- Die Koordinaten stammen in der Oberfläche aus der separaten Ortssuche.
  Kraftstoffwahl und Sortierung erfolgen lokal im Frontend.
- HTTP 400: Eingabefehler; 429: weniger als 61 Sekunden seit der letzten Abfrage;
  503: fehlender/ungültig formatierter lokaler Schlüssel; 502: Verbindungs-/Antwortfehler;
  504: Zeitüberschreitung beim Anbieter.
- Abfrageabstand gilt innerhalb einer Backend-Instanz, auch für fehlgeschlagene
  Abrufversuche. Nicht durch Neustarts oder parallele Instanzen umgehen.

Quelle und Nutzungsbedingungen: https://creativecommons.tankerkoenig.de/

## Tankstelle

`GET /api/stations/{id}`

`id` ist die UUID einer gespeicherten Tankstelle. Die Antwort enthält deren
Metadaten als JSON. Unbekannte IDs ergeben HTTP 404, ungültige UUIDs HTTP 400.

## Preisverlauf

`GET /api/stations/{id}/prices?fuelType=e10&from=2026-10-16T00:00:00Z&to=2026-10-17T00:00:00Z`

- Alle drei Suchparameter sind erforderlich.
- `fuelType`: `diesel`, `e5` oder `e10` (kleingeschrieben).
- `from` und `to`: ISO-8601-Zeitpunkte mit Zeitzone; `Z` bedeutet UTC.
- Zeitraum: einschließlich `from`, ausschließlich `to`; `from` muss vor `to` liegen.
- Antwort: JSON-Liste mit stationId, fuelType, price (EUR/Liter) und observedAt.
- Reihenfolge: älteste Beobachtung zuerst. Keine Beobachtungen: HTTP 200 mit `[]`.
- Unbekannte Tankstelle: HTTP 404. Ungültige oder fehlende Parameter: HTTP 400.

`observedAt` ist unser Abrufzeitpunkt, kein bestätigter Preisänderungszeitpunkt.
Ein leerer Verlauf bedeutet nicht, dass sich der Preis nicht geändert hat.

In der Entwicklung sind die Endpunkte direkt über localhost:8080 oder über
den Vite-Proxy auf localhost:5173 erreichbar. Nach Java-Änderungen ist ein
Backend-Neustart nötig.

## Ortssuche

`GET /api/locations?query=Detmold`

Liefert bis zu fünf deutsche Ortstreffer mit Koordinaten über Open-Meteo/GeoNames.
Genau fünfstellige numerische Eingaben (z. B. `32756`, `01067`) werden stattdessen
über Zippopotam.us/GeoNames aufgelöst. Name und PLZ unterscheiden sich in der
Quellenangabe und im ID-Namensraum; negative PLZ-IDs sind gültige Auswahl-IDs.
Die Suchzeichenfolge muss nach dem Trimmen 2 bis 100 Zeichen enthalten.
Rein numerische Eingaben müssen genau fünfstellig sein.
Die Antwort enthält `locations`, `source` und `sourceUrl`; es werden keine Preise geladen.
Caching, Abfragegrenzen und Datenquellen sind in [geocoding.md](geocoding.md) beschrieben.

Bei Preisabrufen unterscheidet das Backend HTTP 504 (Zeitlimit bei Tankerkönig)
von HTTP 502 (andere Verbindungs-/Antwortfehler). Diagnoseprotokolle enthalten
nur feste Fehlerkategorien, HTTP-Statuscodes oder Exception-Klassennamen,
keine API-Schlüssel, Anfrage-URLs, Rohantworten oder Exception-Nachrichten.
Es gibt weiterhin keine automatischen Wiederholungen; 61 Sekunden Abstand bleiben bestehen.


## Nationale LPG-Daten

GET /api/lpg/national liefert den lokalen EU-Wochenverlauf für Deutschland. POST /api/lpg/openvan fragt auf ausdrücklichen Klick den kostenlosen Deutschland-Vergleich ab (6 Stunden Cache). GET /api/lpg/openvan/saved liest bisher gespeicherte OpenVan-Quellstände. Keine dieser Reihen bezeichnet einzelne Stationspreise. Siehe lpg-statistics.md.
