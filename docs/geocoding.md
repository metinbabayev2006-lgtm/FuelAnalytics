# Ortsauflösung

Die Suche nach Ortsnamen verwendet Open-Meteo Geocoding mit GeoNames-Daten.
Fünfstellige deutsche Postleitzahlen verwenden Zippopotam.us mit GeoNames-Daten.
Diese Trennung wurde am 17.10.2026 ergänzt: Open-Meteo lieferte für die PLZ
32756 keinen Treffer, während die Namenssuche nach Detmold funktionierte.
Für nichtkommerzielle Nutzung ist kein zusätzlicher API-Schlüssel erforderlich.

Quellen (geprüft am 16.10.2026):
- https://open-meteo.com/en/docs/geocoding-api
- https://open-meteo.com/en/terms
- https://www.geonames.org/
- https://zippopotam.us/
- https://docs.zippopotam.us/docs/getting-started/

Anbieterbedingungen: weniger als 10.000 Abfragen/Tag, 5.000/Stunde und
600/Minute; die Übersicht nennt außerdem 300.000/Monat. Keine garantierte
Verfügbarkeit. Bei kommerzieller Bereitstellung sind die Bedingungen neu zu prüfen.
Quellen-/Lizenzangaben müssen in der Oberfläche sichtbar sein.

## Eigener Endpunkt

`GET /api/locations?query=Detmold`

- Ortsname mit 2 bis 100 Zeichen oder genau fünfstellige deutsche PLZ.
  Rein numerische Eingaben anderer Länge werden mit HTTP 400 zurückgewiesen.
- Höchstens fünf Treffer, auf Deutschland beschränkt, bevorzugt deutsche Namen.
- Jeder Treffer enthält ID, Name, Region, Bezirk und Koordinaten. Ortsnamen
  besitzen positive GeoNames-IDs. PLZ-Treffer besitzen negative, aus PLZ und
  Trefferposition gebildete IDs unterhalb von -1.000.000 und Namen wie
  „32756 Detmold“. Führende Nullen bleiben erhalten. Diese IDs sind nur für
  die Auswahl gedacht, keine dauerhaften Tankstellen- oder GeoNames-IDs.
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

Die Anbieterendpunkte können über geocoding.search-url und geocoding.postal-url
konfiguriert werden. Der PLZ-Endpunkt ist eine HTTPS-Basis-URL mit Länderpfad
`https://api.zippopotam.us/de/`; daran wird ausschließlich die validierte PLZ
angehängt. Antwortland und zurückgegebene PLZ müssen zur Anfrage passen.
PLZ-HTTP-404 bedeutet „keine Treffer“ und wird ebenfalls zwischengespeichert.
Ein anderer Anbieter mit abweichendem Antwortformat benötigt einen eigenen Adapter.
Es ist eine Ortssuche, keine vollständige Straßen-/Adresssuche.

Ortsformular, Trefferwahl und Radiusauswahl sind im React-Frontend umgesetzt.
PLZ-Koordinaten sind ungefähre Suchmittelpunkte, keine genaue Nutzeradresse.
Im Live-Test vom 17.10.2026 lieferte der PLZ-Anbieter für 01067 ungültige
Breitengrade. Solche Antworten werden mit HTTP 502 abgewiesen; die Oberfläche
empfiehlt dann die Suche nach Ortsnamen. Nicht jede PLZ ist dadurch garantiert auflösbar.
