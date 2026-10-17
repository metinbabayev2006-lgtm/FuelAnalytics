# REST-API: gespeicherte Daten

Die GET-Endpunkte lesen ausschließlich die eigene Datenbank. Die POST-Umkreissuche
ruft dagegen den externen Anbieter ab und speichert die validierten Ergebnisse.

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
  503: fehlender/ungültig formatierter lokaler Schlüssel; 502: ungültige Anbieterantwort.
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
Die Suchzeichenfolge muss nach dem Trimmen 2 bis 100 Zeichen enthalten.
Die Antwort enthält `locations`, `source` und `sourceUrl`; es werden keine Preise geladen.
Caching, Abfragegrenzen und Datenquellen sind in [geocoding.md](geocoding.md) beschrieben.
