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
