package de.fuelanalytics.backend.client;

import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ChargingRegisterClientTests {
    @TempDir Path directory;
    private String header() {
        return "Ladesäulenregister Bundesnetzagentur\nLetzte Aktualisierung vom: 01.09.2026\n"
                + "Ladeeinrichtungs-ID;Betreiber;Anzeigename (Karte);Status;Breitengrad;Längengrad;Steckertypen1;Nennleistung Stecker1;Straße;Hausnummer;Postleitzahl;Ort;Öffnungszeiten\n";
    }
    @Test void parsesOfficialShapeWithQuotedSeparatorsQuotesNewlinesAndGermanCoordinates() throws Exception {
        String csv = header() + "1;Test;\"Laden; \\\"\\\"Nord\\\"\\\"\nStandort\";In Betrieb;52,5244;13,4105;AC Typ 2 Steckdose;22;Teststraße;1;01067;Testort;247\n";
        csv = csv.replace("\\\"", "\"");
        var snapshot = ChargingRegisterClient.parse(new StringReader(csv), Instant.EPOCH);
        assertEquals("2026-09-01", snapshot.sourceDate());
        var site = snapshot.sites().getFirst();
        assertEquals("Laden; \"Nord\"\nStandort", site.name());
        assertEquals("bnetza:1", site.id());
        assertEquals(52.5244, site.latitude());
        assertTrue(site.address().contains("01067"));
        assertEquals("24/7", site.openingHours());
        assertEquals("AC Typ 2 Steckdose · 22 kW", site.connectors().getFirst());
    }
    @Test void filtersInactiveInvalidCoordinatesAndDuplicates() throws Exception {
        String csv = header() + "1;Test;Aktiv;In Betrieb;52;9;CCS;150;;;;;\n"
                + "1;Test;Duplikat;In Betrieb;52;9;CCS;150;;;;;\n"
                + "2;Test;Inaktiv;Außer Betrieb;52;9;CCS;150;;;;;\n"
                + "3;Test;Fehler;In Betrieb;200;9;CCS;150;;;;;\n";
        assertEquals(1, ChargingRegisterClient.parse(new StringReader(csv), Instant.EPOCH).sites().size());
    }
    @Test void searchesRealDistancesAndReloadsAfterFileReplacement() throws Exception {
        Path file = directory.resolve("register.csv");
        Files.writeString(file, header() + "1;Test;Nah;In Betrieb;52;9;CCS;150;;;;;\n2;Test;Fern;In Betrieb;53;9;CCS;150;;;;;\n");
        var client = new ChargingRegisterClient(file);
        var result = client.search(52, 9, 1);
        assertEquals(1, result.stations().size());
        assertEquals("bnetza", result.source());
        assertEquals("2026-09-01", result.sourceDate());
        assertEquals(0, result.stations().getFirst().distanceKm(), 0.001);
        assertTrue(client.search(51, 9, 1).stations().isEmpty());
        Files.writeString(file, header() + "3;Test;Neu;In Betrieb;52;9;CCS;150;;;;;\n");
        Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.from(Instant.now().plusSeconds(10)));
        assertEquals("bnetza:3", client.search(52, 9, 1).stations().getFirst().id());
    }
    @Test void rejectsMissingOrInvalidRegistersAndInvalidSearch() throws Exception {
        var client = new ChargingRegisterClient(directory.resolve("missing.csv"));
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 30)).getStatusCode().value());
        assertThrows(IOException.class, () -> ChargingRegisterClient.parse(new StringReader("not a register"), Instant.EPOCH));
        assertThrows(IOException.class, () -> ChargingRegisterClient.parse(new StringReader(header() + "\"Unclosed"), Instant.EPOCH));
    }
    @Test void capsAfterDistanceSortSoNearestSitesAreKept() throws Exception {
        StringBuilder csv = new StringBuilder(header());
        for (int id = 1; id <= 502; id++) csv.append(id).append(";Test;Lader;In Betrieb;52;").append(9 + (503 - id) * 0.00001).append(";CCS;150;;;;;\n");
        Path file = directory.resolve("many.csv"); Files.writeString(file, csv);
        var result = new ChargingRegisterClient(file).search(52, 9, 5);
        assertEquals(500, result.stations().size());
        assertTrue(result.truncated());
        assertEquals("bnetza:502", result.stations().getFirst().id());
    }
}
