# Elektro- und Gasstandorte

## Bedienung

1. Einen Ort oder eine PLZ suchen und einen Treffer auswählen.
2. Unter „Kraftstoff“ entweder Benzin (E5/E10), Diesel, Elektro oder Gas wählen.
3. Bei Elektro/Gas auf „Standorte suchen“ klicken. Liste und Karte zeigen
   dieselben Treffer; die Sortierung erfolgt nach Luftlinie oder Name.
4. Eine Kartenmarkierung öffnet Details. „Route zum Standort“ öffnet Google
   Maps mit den Zielkoordinaten; den Startpunkt dort wählen.

Elektro zeigt Ladestationen, bekannte Anschlüsse (Typ 2, CCS, CHAdeMO, Schuko)
und gegebenenfalls eingetragene Leistungen. Gas zeigt nur Stationen mit
ausdrücklichem LPG- oder CNG-Eintrag, jeweils gekennzeichnet. Unbekannte
Adressen, Öffnungszeiten und Preise bleiben ausdrücklich unbekannt.

## Datenquelle und Grenzen

Standorte: © OpenStreetMap-Mitwirkende, ODbL. Quelle und Lizenz sind in der
Oberfläche verlinkt. Abfrage über die öffentlich dokumentierte Overpass-Instanz
von [Private.coffee](https://overpass.private.coffee/). Die
[OSM-Dokumentation](https://wiki.openstreetmap.org/wiki/Overpass_API) führt
diese Instanz und ihre Nutzungshinweise auf.

Die Daten beschreiben Karteneinträge, keine aktuellen Ladepreise, freien
Anschlüsse oder bestätigten Öffnungszustände. `access=private` und `access=no`
werden ausgeschlossen; Kundenbeschränkungen werden angezeigt. Nicht ausdrücklich
als privat markierte Einträge sind keine Garantie für öffentlichen Zugang.
Bei Elektro werden ausdrücklich für Autos ausgeschlossene Standorte verworfen.
Die Vollständigkeit und Aktualität der Kartierung kann nicht garantiert werden.

Es werden keine Strom-/Gaspreise erfunden oder in die bisherigen Preisverläufe
übernommen. Benzin und Diesel verwenden weiterhin Tankerkönig. Neue
Standortdaten werden vorübergehend im Backend gecacht, nicht in PostgreSQL
gespeichert. Der bestehende Vorführmodus bleibt auf die bisherigen Kraftstoffe
begrenzt und löst keine neuen Anbieterabrufe aus.

## Backend

`POST /api/energy/search`

```json
{"latitude":51.9386,"longitude":8.8732,"radiusKm":5,"kind":"electric"}
```

`kind` ist `electric` oder `gas`. Radius größer null bis maximal 25 km.
Antwort: `fetchedAt`, `kind`, `stations`, `truncated`. Standort-IDs verwenden
`osm:node:…`, `osm:way:…` oder `osm:relation:…` und sind keine Tankerkönig-UUIDs.
Koordinaten von Flächen/Relationen beziehen sich auf deren OSM-Mittelpunkt.
Die Entfernung wird daraus als Luftlinie berechnet. Ungültige Koordinaten,
unpassende Energietags und Mittelpunkte außerhalb des Radius werden verworfen.

Anfragen nur nach Klick, mindestens fünf Sekunden zwischen ungecachten
Abfragen, Cache maximal 100 Suchen für jeweils 30 Minuten. Höchstens 500
Standorte; bei Begrenzung wird eine Warnung angezeigt. Die begrenzte Antwort
ist keine Garantie für die nächsten 500 Standorte. Anbieter-Teilfehler
(`remark`) werden als Fehler behandelt, nicht als leeres Erfolgsergebnis.
Kein automatischer Retry. Anbieterfehler: HTTP 502, Zeitlimit: 504,
Abfragelimit: 429. Der Endpunkt ist über `overpass.search-url` konfigurierbar.

## Prüfung am 22.10.2026

- 57 Standard-Backend-Tests bestanden, darunter acht neue Client-Tests und
  drei REST-Integrationstests mit synthetischen Anbieterantworten.
- 27 Frontend-Tests bestanden, darunter zwei neue Antwortvalidierungstests.
- Produktionsbuild erfolgreich. Die vier separaten PostgreSQL-Tests werden
  im Standardlauf planmäßig übersprungen; keine Datenbankänderung erforderlich.
- Auswahl Elektro/Gas, Ortssuche 32756, Wechsel der Ansicht, Karten-Popup,
  Gas-Kennzeichnung und leeres Ergebnis im Browser geprüft. Erfolgsdaten der
  Kartenprüfung waren ausdrücklich synthetisch, keine bestätigten Live-Standorte.
- Direkte Abrufe von overpass-api.de lieferten HTTP 406 oder Zeitlimits;
  Private.coffee lief vom Rechner ebenfalls in Zeitlimits. Der tatsächliche
  Browserabruf für Elektro/Detmold zeigte korrekt die Zeitlimitmeldung.
  Ein erfolgreicher Live-Abruf bleibt somit offen; die Ursache im Netzwerkweg
  oder beim Anbieter wurde nicht abschließend geklärt.
- Synthetische Komponentenprüfung lokal unter `/tests/energy-preview.html`;
  sie ist kein Bestandteil des Produktionsbuilds.
