# Ortsauflösung

Die Ortssuche verwendet Open-Meteo Geocoding mit GeoNames-Daten.
Für nichtkommerzielle Nutzung ist kein zusätzlicher API-Schlüssel erforderlich.

Quellen (geprüft am 16.10.2026):
- https://open-meteo.com/en/docs/geocoding-api
- https://open-meteo.com/en/terms
- https://www.geonames.org/

Anbieterbedingungen: weniger als 10.000 Abfragen/Tag, 5.000/Stunde und
600/Minute; die Übersicht nennt außerdem 300.000/Monat. Keine garantierte
Verfügbarkeit. Bei kommerzieller Bereitstellung sind die Bedingungen neu zu prüfen.
Quellen-/Lizenzangaben müssen in der Oberfläche sichtbar sein.

## Eigener Endpunkt

`GET /api/locations?query=Detmold`

- Suche nach Ort oder PLZ, 2 bis 100 Zeichen.
- Höchstens fünf Treffer, auf Deutschland beschränkt, bevorzugt deutsche Namen.
- Jeder Treffer enthält GeoNames-ID, Name, Region, Bezirk und Koordinaten.
- Antwort enthält zusätzlich source und sourceUrl zur Quellenangabe.
- Kein Preisabruf und keine Änderung an Tankstellen-/Preisbeobachtungen.
- HTTP 400 bei ungültigem Suchtext, 429 bei zu schneller Anfrage,
  502 bei Fehlern oder ungültigen Antworten des Anbieters.

## Implementierung

Suchergebnisse werden für 24 Stunden in einem auf 200 Suchbegriffe begrenzten
Speicher-Cache gehalten. Groß-/Kleinschreibung und wiederholte Leerzeichen
führen nicht zu weiteren Abrufen. Neue externe Abfragen erfolgen höchstens
einmal pro Sekunde je Backend-Instanz. Keine Hintergrundabfragen oder Retries.
Das globale Tages-/Monatskontingent wird nicht technisch gezählt; vor Nutzung
mit vielen Nutzern oder mehreren Instanzen ist eine zentrale Kontingentverwaltung
erforderlich. Für die lokale Einzelanwendung sind manuelle Ortssuchen vorgesehen.

Der Anbieterendpunkt kann über geocoding.search-url konfiguriert werden.
Ein anderer Anbieter mit abweichendem Antwortformat benötigt einen eigenen Adapter.
Es ist eine Ortssuche, keine vollständige Straßen-/Adresssuche.

Nächster Schritt: Ortsformular, Trefferwahl und Radiusauswahl im React-Frontend.
