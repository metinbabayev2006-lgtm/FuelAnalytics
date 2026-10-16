# Interaktive Tankstellenkarte

Leaflet 1.9.4 zeigt die Tankstellen des vorhandenen Suchergebnisses auf
OpenStreetMap-Kartenkacheln. Kartenbedienung und Kraftstoffwechsel lösen keine
Tankerkönig-Anfrage aus. Die Markierungen zeigen den ausgewählten Preis oder
einen Strich für fehlende Preise. Popups nennen Tankstelle, Preis und Öffnungsstatus
zum Abrufzeitpunkt. Ungeprüfter Anbietertext wird als DOM-Text eingebunden.

Der Suchmittelpunkt und Radius gehören zum angezeigten Suchergebnis und ändern
sich erst nach einer neuen erfolgreichen Suche. Zoomen/Verschieben und Rückkehr
zum Suchgebiet sind möglich. Die Tabelle bleibt als alternative Darstellung erhalten.

Kartenkacheln werden direkt vom Browser über HTTPS abgerufen. Browser-Cache und
Referer bleiben unverändert; kein Offline-Download oder Vorladen von Kartengebieten.
OpenStreetMap-Quellenangabe bleibt auf der Karte sichtbar. Der Dienst arbeitet
ohne Verfügbarkeitsgarantie. Vor öffentlichem Betrieb oder vielen Nutzern muss
die Eignung des Kacheldiensts erneut bewertet werden.

Quellen (geprüft am 16.10.2026):
- https://leafletjs.com/examples/quick-start/
- https://operations.osmfoundation.org/policies/tiles/
