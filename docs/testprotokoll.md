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
4. Automatisierte Tests gegen echtes PostgreSQL ergänzen, beispielsweise mit
   einer isolierten Testdatenbank; H2 deckt nicht jede PostgreSQL-Eigenschaft ab.
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
