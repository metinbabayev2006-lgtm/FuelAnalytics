# Routen, Favoriten, Standort, CSV und Vorführmodus

## Routen

In Ergebnisliste, Karten-Popup und Favoriten öffnet „Route zur Tankstelle“
Google Maps in einem neuen Tab. Der Link enthält `api=1`, `destination` mit
validierten Tankstellenkoordinaten und `travelmode=driving`. Ein Startpunkt,
Suchmittelpunkt oder API-Schlüssel wird nicht übertragen. Google Maps wählt
seinen Startpunkt unabhängig (z. B. über dort bestehende Einstellungen), oder
der Nutzer gibt ihn ein. FuelAnalytics berechnet keine Fahrstrecke oder Fahrzeit.
Die angezeigte Entfernung bleibt Luftlinie. Links verwenden `noopener noreferrer`.

Referenz: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

## Favoriten

„Merken“ speichert maximal 50 Tankstellen mit ID, Name, Adresse und Koordinaten
in localStorage. Preise, Beobachtungen und der Nutzerstandort werden nicht
gespeichert. Favoriten erscheinen unter „Meine Favoriten“, mit Route und der
Möglichkeit, die Station als Mittelpunkt einer neuen Suche auszuwählen. Das
führt noch keinen Anbieterabruf aus. Entfernen löscht den Eintrag lokal.

Der Favoritenfilter betrifft nur Liste und Karte des bestehenden Suchergebnisses.
Die Preisübersicht und der Tankkostenvergleich behalten alle gefundenen Stationen
als Basis; die Oberfläche erklärt das. Außerhalb des Suchgebiets liegende Favoriten
werden dadurch nicht nachgeladen. Ungültiger oder nicht verfügbarer Browserspeicher
führt zu einer Meldung; eine Sitzungsauswahl bleibt möglich. Andere Browser,
Geräte oder Origins (z. B. localhost gegenüber 127.0.0.1) haben eigene Favoriten.
Echte und Demo-Favoriten verwenden getrennte Speicherkennungen.

## Standort

Nur ein Klick auf „Meinen Standort verwenden“ ruft die Geolocation-API auf.
Der Browser benötigt eine Freigabe und einen sicheren Kontext (lokal localhost,
bei Bereitstellung HTTPS). Das Ergebnis wird nur als Suchmittelpunkt im
Arbeitsspeicher gehalten. Erst der separate Klick „Preise abrufen“ sendet ihn
an das Backend und Tankerkönig. Kartenkacheln werden anschließend für das
angezeigte Gebiet von OpenStreetMap geladen. Es gibt kein Standorttracking.
Die Genauigkeit wird angezeigt, Fehler/Ablehnung/Zeitlimit haben eigene Meldungen.
Während der Ermittlung sind konkurrierende Ortseingaben gesperrt.

Referenz: [Geolocation getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
Die Testseite `/tests/location-access.html` nutzt ausschließlich simulierte
Rückmeldungen, ohne Geräteortung oder Browserfreigabe.

## CSV

Der Export verwendet die bereits geladenen Messungen des gewählten Kraftstoffs,
Zeitraums und der maximal drei ausgewählten Tankstellen. Kein zusätzlicher
Backend- oder Anbieterabruf. Leere Ergebnisse deaktivieren den Download;
fehlgeschlagene Stationen werden ausgelassen und ausdrücklich gemeldet.

Format: UTF-8 mit BOM, Semikolon, CRLF-Zeilen, Dezimalkomma mit drei Nachkommastellen,
doppelt gequotete Felder mit verdoppelten Anführungszeichen. Spalten: Datenart,
Tankstellen-ID, Name, Adresse, Kraftstoff, Preis EUR/Liter, Beobachtung UTC,
inklusive Start-/exklusive Endgrenze und Quelle. Zeiten sind ISO-8601 in UTC;
die Bildschirmansicht verwendet Europe/Berlin. Jede Zeile trägt ihre Herkunft.
Felder mit möglichen Tabellenformeln (`=`, `+`, `-`, `@`, auch nach Leerzeichen)
bekommen ein führendes Apostroph. Dadurch können exportierte Namen vom
Originaltext abweichen, werden aber nicht als Formeln ausgeführt.

Bei Excel-Versionen ohne automatische Erkennung: Daten → Aus Text/CSV,
UTF-8, Semikolon und deutsche Dezimalzahlen auswählen. Der CSV-Export ist eine
lokale Datei, kein Upload. Vor externer Weitergabe echter Daten gelten weiterhin
die Anbieterbedingungen. Synthetische Exporte enthalten `DEMO` im Dateinamen
und `SYNTHETISCH` in jeder Zeile.

## Vorführmodus

Der Modus verwendet die normalen Komponenten für vier ausdrücklich fiktive
Tankstellen bei Detmold: offene, geschlossene und eine Station ohne E5-Preis.
Verläufe besitzen vier Zeitpunkte bzw. einen Einzelpunkt. Die künstlichen
Zeitpunkte sind relativ zum Einstieg in den Modus. Sie sind keine gespeicherten
Live-Daten und werden nicht in PostgreSQL geschrieben.
Die Karte zeigt Marker auf einem schematischen Gitter ohne Straßenkarte oder
Kachelanfragen. Routen und Standortsuche sind deaktiviert. Preisabrufe sind
gesperrt; Sortierung, Kraftstoffe, Tankmenge, Favoriten, Verläufe und CSV funktionieren.
Das Backend-Statusfeld der App prüft unabhängig davon weiterhin die Erreichbarkeit,
aber die Vorführung benötigt kein Backend. Die Anwendung muss zuvor geladen sein;
es gibt keinen Offline-Service-Worker. Der Modus ersetzt keinen Test mit echten Daten.

## PostgreSQL-Tests

`backend/Test-Postgres.ps1` startet ein eigenes Compose-Projekt mit PostgreSQL 18.6,
einer festen synthetischen Testkennung und nur lokalem Port 55433. Daten liegen
in tmpfs und verschwinden mit dem Testcontainer. Es gibt kein Anwendungsvolume.
Die Tests prüfen Migrationen auf einer leeren Datenbank, NUMERIC-/Zeitstempel-
Genauigkeit und halb offene Zeitintervalle, Eindeutigkeit, Fremdschlüssel sowie
vollständigen Transaktions-Rollback bei einer ungültigen Preisbeobachtung.
Die vier JUnit-Tests sind nur mit `fuelanalytics.postgres.tests=true` aktiv.
Beim Standardsuite-Lauf sind sie deaktiviert; die vorhandenen H2-Tests bleiben bestehen.
