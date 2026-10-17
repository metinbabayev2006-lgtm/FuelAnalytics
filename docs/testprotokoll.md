# Testprotokoll und Abgabestand

Stand: 17.10.2026. Geprüft auf Windows mit Java 21.0.12.1, Node.js 24.20.0,
PostgreSQL 18.6 im Docker-Container und den im Repository gesperrten
Frontend-Abhängigkeiten. Dieses Protokoll beschreibt ausgeführte Prüfungen,
keine vollständige Testabdeckung oder verbindliche Abnahme des Hochschulmoduls.

## Automatisierte Prüfungen dieses Durchlaufs

| Prüfung | Ergebnis | Umfang |
| --- | --- | --- |
| Backend: `./mvnw.cmd test` | 42 Tests, 0 Fehler, 0 übersprungen | Spring-Kontext, Migrationen, Integritätsregeln, Repositories, REST, Anbieter-Mapping, Fehler und Abfragebegrenzung |
| Frontend: `npm test` | 5 Tests, 0 Fehler | Preisberechnung, Filterung, leere Mengen, Einzelpreise, Gleichstände, Kraftstoffwechsel |
| Frontend: `npm run build` | bestanden | TypeScript-Prüfung und Produktions-Bundle |
| Frontend: `npm run lint` | bestanden | ESLint |

Die Backend-Tests laufen isoliert mit H2 im PostgreSQL-Kompatibilitätsmodus.
Externe Anbieter werden für die Client-Tests durch lokale HTTP-Server ersetzt.
Ein Transaktionstest prüft das Zurückrollen aller Schreibvorgänge bei einem
fehlerhaften Preis. Verlaufsabfragen prüfen die inklusive Start- und exklusive
Endgrenze. Automatische Tests verwenden ausschließlich synthetische Daten.

Maven meldete 401-Warnungen beim Abruf zusätzlicher Repository-Metadaten;
der Testlauf endete mit BUILD SUCCESS. Flyway warnte, dass die H2-Version
neuer als seine zuletzt verifizierte Version ist. Das ist eine Einschränkung
der Testumgebung; die PostgreSQL-Prüfung wird dadurch nicht ersetzt.

## Lokaler PostgreSQL-/HTTP-Test dieses Durchlaufs

| Fall | Erwartung | Beobachtet |
| --- | --- | --- |
| Docker Compose PostgreSQL | healthy auf 127.0.0.1:5433 | erfüllt |
| `GET /api/health` | HTTP 200, UP / FuelAnalytics | erfüllt |
| Ungültige Tankstellen-UUID | HTTP 400 | erfüllt |
| Nicht vorhandene, gültige UUID | HTTP 404 | erfüllt |
| Verlauf mit vertauschtem Start/Ende | HTTP 400 | erfüllt |
| E5-Verlauf der synthetischen Demo ohne E5-Daten | HTTP 200, `[]` | erfüllt |
| Datenbankverlauf einer vorhandenen Live-Tankstelle | gespeicherte Messungen im Browser | 9 Beobachtungen für den gewählten Diesel-Verlauf |

Diese Prüfungen verwenden die bestehende lokale Datenbank. Eine Neuinstallation
in einem frischen Volume wurde in diesem Durchlauf nicht ausgeführt. Das
vorhandene Volume und die lokalen Zugangsdaten wurden nicht verändert.

## Browserprüfung

Die vorhandene Detmold-Suche mit 13 Tankstellen und Datenstand 17.10.2026,
12:11:53 Uhr (Berlin) wurde weiterverwendet. Für diesen Prüfdurchlauf wurde
kein zusätzlicher Tankerkönig-Preisabruf ausgelöst.

- Sortierung nach Entfernung: Reihenfolge beginnt mit 0,7 km, 0,8 km und 1 km;
  Preisübersicht und Datenstand bleiben erhalten.
- Verlauf aus der sortierten Liste gewählt: neun gespeicherte Diesel-Beobachtungen
  geladen; Fokus springt zur Verlaufsüberschrift.
- Ortseingabe auf ein Zeichen verkürzt: Ortssuche und Preisabruf deaktiviert,
  alte Ergebnisse behalten ihren bezeichneten Datenstand.
- Detmold wieder gesucht und Treffer gewählt: Preisabruf wieder freigegeben,
  ohne selbst einen Preisabruf auszulösen.

Bereits in den vorangegangenen Entwicklungsschritten wurden geprüft:
Ortssuche Detmold/Lemgo, Radiuswahl, Preisabruf mit Speicherung, Kartenkacheln,
Marker-Popup und Zoom, E10/Diesel-Wechsel, Preisvergleich einschließlich
Gleichständen, Zeiträume 24 Stunden/7 Tage/30 Tage und aufklappbare Messwerte.
Diese Fälle wurden hier nicht sämtlich erneut ausgeführt.

## Noch offene Arbeiten vor der Abgabe

1. Verbindliche Aufgabenstellung, Bewertungskriterien und Abgabeformat mit
   dem Modul abgleichen. Die technische Dokumentation ersetzt keine bewertete
   Ausarbeitung und keine eigene Erklärung der Implementierung.
2. Ausarbeitung fertigstellen: Problemstellung, Zielgruppe, Anforderungen,
   Technologieentscheidungen, Datenqualität, Ergebnisse und Reflexion;
   Präsentation mit nachvollziehbarer Vorführung vorbereiten.
3. Installation auf einer zweiten Umgebung bzw. in einem frischen Test-Volume
   prüfen. Keine vorhandenen Daten für einen Installationstest löschen.
4. PostgreSQL-Integrationstests sind inzwischen ergänzt und separat bestanden
   (siehe Ergänzung unten). Weiterhin kein vollständiger zweiter Rechner getestet.
5. Browser-Fehlerfälle für langsame/ausgefallene Dienste, leere und einzelne
   Messreihen sowie kleinere Bildschirmbreiten systematisch ausweiten.
   Tastaturbedienung und Screenreader wurden noch nicht vollständig geprüft.
6. Vor öffentlicher Bereitstellung: Betriebs-/Proxy-Konfiguration, Anbieterbedingungen,
   Zugriffsschutz, Backup/Wiederherstellung und gemeinsame Abfragebegrenzung
   für mehrere Backend-Instanzen klären.

Historische Daten entstehen derzeit ausschließlich bei manuellen Preisabrufen.
Es existieren kein Hintergrundsammler, keine Prognose und kein Routing.

## Ergänzung: Dashboard-Gestaltung

Am 17.10.2026 wurde die Oberfläche neu gestaltet. Bei 1440 Pixeln wurden die
nebeneinander angeordneten Karten- und Listenbereiche, Ortssuche und Auswahl,
ein expliziter Preisabruf, Marker-Popup sowie der Wechsel in den gespeicherten
Verlauf geprüft. Bei 390 Pixeln wurden die gestapelte Suche, Preiskennzahlen,
Karte, Tankstellenliste, Diagramm, Kraftstoffwechsel und Sortierung geprüft.
Die Daten stammen aus einem einzelnen zusätzlichen Abruf um 12:33:55 Uhr Berlin
mit 13 Tankstellen in Detmold.

Messung der DOM-Breiten: kein horizontaler Seitenüberlauf bei 1440, 900 und
390 Pixeln. Ein durch die minimale Body-Breite verursachter Überlauf bei
320 Pixeln wurde korrigiert und erneut geprüft. Die Breitenprüfung ersetzt
keine vollständige Prüfung aller Bildschirmgrößen, Browser oder Screenreader.
Frontend-Tests, Build und ESLint wurden nach den Änderungen erneut ausgeführt.

## Ergänzung: Tankkostenrechner

Fünf weitere automatisierte Tests für den Tankkostenrechner sind hinzugekommen;
der Frontend-Testlauf umfasst jetzt zehn bestandene Tests. Build und ESLint
sind bestanden. Geprüft werden Mengenparsing, gültige Grenzwerte, ungültige
Eingaben, Dezimalmengen, Cent-Rundung und Differenzen gerundeter Füllbeträge.

Die isolierte Testseite `/tests/tank-calculator.html` enthält ausschließlich
synthetische Daten und verwendet die tatsächlichen Komponenten. Im Browser
wurden 40 und 35,5 Liter, leere Eingaben, die Schnellauswahl, Diesel/E10 sowie
ein Kraftstoff ohne Daten geprüft. Fehlende Preise und geschlossene Tankstellen
erhalten keinen Füllbetrag. Die Testkomponente wurde bei 390 Pixeln ohne
horizontalen Seitenüberlauf angezeigt.

Ein erster Live-Abruf scheiterte mit HTTP 502; nach Ablauf der Sperre folgte
ein erfolgreicher Abruf mit 13 Tankstellen in Detmold um 13:04:58 Uhr Berlin.
Mit dessen Daten wurden Mengen- und Kraftstoffwechsel sowie die Kosten je
Tankstelle geprüft. E10: 40 Liter von 87,16 € bis 91,96 € (4,80 € Unterschied),
35,5 Liter von 77,35 € bis 81,61 € (4,26 € Unterschied). Es handelt sich um
zeitgebundene Rechenwerte zum angegebenen Datenstand, keine aktuellen Angebote.

## Ergänzung: Vergleich gespeicherter Preisverläufe (17.10.2026)

Sieben neue Tests prüfen gemeinsame Zeitpunkte ohne Auffüllen fehlender Preise,
stabile Serienzuordnung bei leeren/fehlerhaften Daten, Auswahlbegrenzung,
Validierung von Station/Kraftstoff/Preis/Zeitgrenzen/Duplikaten, Sortierung,
Teilfehler sowie ungültige JSON-Antworten und abgebrochene Anfragen.
Alle 17 Frontend-Tests, Produktionsbuild und ESLint sind bestanden.

Browserprüfung über `/tests/history-comparison.html` mit ausdrücklich
synthetischen Daten und der echten Verlaufskomponente: zwei/drei Stationen,
deaktivierte zusätzliche Auswahl, Entfernen und Reset, Einzelpunkt, Teilfehler,
leere Serie sowie komplett leerer E5-Zustand. Dieselwechsel, 24-Stunden-Auswahl,
Neuladen und die Tabelle mit sieben Messwerten wurden geprüft.
Die schmale Ansicht mit 390 Pixeln zeigte keinen horizontalen Seitenüberlauf
(Seitenbreite 375 Pixel), auch bei geöffneter Tabelle. Desktopdarstellung wurde
visuell geprüft. Diese Prüfung umfasst keine vollständige Screenreader-Abnahme.

Keine Tankerkönig-Abfrage für diese Tests. Das Backend wurde nicht verändert;
die bestehenden Backend-Tests wurden für diese reine Frontend-Erweiterung
nicht erneut ausgeführt. Der Browserlauf verwendet synthetische Daten und
ersetzt keine erneute Integrationserprobung mit echten gespeicherten Verläufen.

## Ergänzung: Verlaufskennzahlen (17.10.2026)

Zwei zusätzliche Tests prüfen den gleich gewichteten Mittelwert bei wiederholten
Preisen und ungleichmäßigen Zeitabständen, Minimum/Maximum, Messanzahl,
erste/letzte Messung bei unsortierter Eingabe, unveränderte Quelldaten sowie
leere und einzelne Messreihen. Alle 19 Frontend-Tests, Build und ESLint bestanden.

Die bestehende synthetische Browser-Testseite zeigte für Nord Minimum 1,759,
Mittel 1,779, Maximum 1,799 bei drei Messungen; für Süd Mittel 1,822 bei drei
Messungen. Der Einzelpunkt zeigte dreimal 1,789 mit erklärendem Hinweis.
Ein simulierter Ladefehler ließ die erfolgreichen Auswertungen bestehen.
E5 ohne Messwerte zeigte keine alten Kennzahlen und keine Nullpreise.
Bei 390 Pixeln: Seitenbreite 375 Pixel, Kartenbreite 313 Pixel, kein horizontaler
Seitenüberlauf. Desktopvorschau und schmale Ansicht lokal gespeichert.
Keine neuen echten Preise abgerufen; keine Backend-Änderungen.

## Ergänzung: Routen, CSV, Favoriten und Vorführung (17.10.2026)

- Frontend: 25 Tests bestanden; Produktionsbuild und ESLint bestanden.
  Neue Tests prüfen validierte Zielkoordinaten ohne Startpunkt/API-Schlüssel,
  Favoritenvalidierung/Limit/Metadaten ohne Preise, CSV-Quoting/Dezimalkomma/BOM,
  Schutz vor Tabellenformeln, Sortierung/Leer-/Teilfehlerfälle und Demo-Verläufe.
- Standardsuite Backend: 46 Tests erkannt, 42 ausgeführt und bestanden,
  vier PostgreSQL-Tests absichtlich deaktiviert. Separater Aufruf über
  `Test-Postgres.ps1`: alle vier PostgreSQL-Integrationstests bestanden.
  Migrationen V1/V2 auf frischer Testdatenbank, Präzision/UTC-Grenzen,
  Fremdschlüssel, Duplikate und vollständiger Rollback geprüft. Testcontainer
  anschließend beendet; produktives lokales Volume unverändert.
- Browser: Vorführmodus gestartet; vier fiktive Stationen mit schematischer
  Karte, Preisübersicht, Tankkosten und Verlauf angezeigt. Favorit hinzugefügt,
  Liste/Karte darauf gefiltert, nach Neuladen und erneutem Einstieg wiedergefunden
  und entfernt. Beim Rückwechsel waren keine Demo-Favoriten in der echten Suche.
- CSV mit zwei Demo-Tankstellen: Download-Schaltfläche und Startmeldung geprüft.
  Serien wurden mit je vier Messungen angezeigt. Serializer automatisiert geprüft;
  die Speicherung im Downloadordner und ein tatsächlicher Excel-Import wurden
  in diesem Durchlauf nicht bestätigt.
- Standort: echte Komponente über `/tests/location-access.html` mit simuliertem
  Erfolg (Genauigkeit 120 m), Ablehnung, Zeitlimit und fehlender Unterstützung
  geprüft. Kein echter Standort abgefragt; OS-/Browserfreigabe bleibt ein manueller
  Abnahmepunkt auf dem Zielgerät.
- Live-Test: ein Preisabruf für Detmold mit 13 Stationen und Datenstand
  17.10.2026, 18:07:09 Uhr Berlin. Routenlinks in Liste und Q1-Karten-Popup
  geprüft. Google Maps öffnete das übergebene Tankstellenziel im Routenplaner;
  Startpunkt und Fahrstrecke wurden nicht in FuelAnalytics übernommen.
  Q1-Verlauf mit 18 gespeicherten E10-Messungen geladen, Kennzahlen angezeigt.
- Bei 390 Pixeln kein horizontaler Seitenüberlauf (Seitenbreite 375 Pixel)
  im geprüften Demo-Zustand mit Verlauf und Export. Browserkonsole ohne Fehler.
  Screenshots lokal: tmp/routes-live.png, tmp/csv-export-demo.png und
  tmp/extensions-mobile.png. Kein vollständiger Test aller Geräte/Browser.

## Erneuter Gesamttest mit Befunden und Korrekturen

Der ausführliche [Bericht vom 17.10.2026](abnahme-2026-10-17.md) dokumentiert
die erneute Prüfung nach Nutzerauftrag. Stand danach: 25 Frontend-Tests,
46 Standard-Backend-Tests und vier separate PostgreSQL-Tests bestanden,
Build und ESLint bestanden. Ein tatsächlicher PLZ-Suchfehler wurde behoben;
Zeitüberschreitungen bei Tankerkönig werden gesondert diagnostiziert.
Die ursprüngliche externe Abrufstörung war aktuell nicht reproduzierbar.
Offen bleiben insbesondere echte Geräteortung und tatsächlicher Excel-Import;
der Bericht unterscheidet Live-Prüfungen und synthetische Prüfungen ausdrücklich.
