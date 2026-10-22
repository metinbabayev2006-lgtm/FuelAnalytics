package de.fuelanalytics.backend.client;

import de.fuelanalytics.backend.model.EnergySearchResult;
import de.fuelanalytics.backend.model.EnergySearchResult.Site;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Locally imported official register: search coordinates are never sent to a third party. */
@Component
public class ChargingRegisterClient {
    private final Path file;
    private Snapshot snapshot;
    @Autowired
    public ChargingRegisterClient(@Value("${charging.register-file:../data/charging-bnetza.csv}") String file) { this(Path.of(file)); }
    ChargingRegisterClient(Path file) { this.file = file; }

    public synchronized EnergySearchResult search(double lat, double lon, double radius) {
        if (!Double.isFinite(lat) || Math.abs(lat) > 90 || !Double.isFinite(lon) || Math.abs(lon) > 180 ||
                !Double.isFinite(radius) || radius <= 0 || radius > 25) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültiger Suchmittelpunkt oder Radius (maximal 25 km)");
        }
        try {
            if (Files.size(file) > 100_000_000) throw new IOException("Register too large");
            var modified = Files.getLastModifiedTime(file).toInstant();
            if (snapshot == null || !snapshot.modified().equals(modified)) {
                try (var reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) { snapshot = parse(reader, modified); }
            }
            List<Site> matches = new ArrayList<>();
            for (var site : snapshot.sites()) {
                double distance = distanceKm(lat, lon, site.latitude(), site.longitude());
                if (distance <= radius) matches.add(new Site(site.id(), site.name(), site.latitude(), site.longitude(), distance,
                        site.address(), site.services(), site.openingHours(), site.access(), site.connectors()));
            }
            matches.sort(Comparator.comparingDouble(Site::distanceKm).thenComparing(Site::id));
            return new EnergySearchResult(Instant.now(), "electric", List.copyOf(matches.subList(0, Math.min(matches.size(), 500))),
                    matches.size() > 500, "bnetza", snapshot.sourceDate());
        } catch (IOException | IllegalArgumentException | java.time.DateTimeException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Ladesäulenregister fehlt oder ist ungültig. Bitte Import-ChargingRegister.ps1 im Projektordner ausführen");
        }
    }

    static Snapshot parse(Reader input, Instant modified) throws IOException {
        var reader = input instanceof BufferedReader buffered ? buffered : new BufferedReader(input);
        List<String> row;
        Map<String, Integer> columns = null;
        Map<String, Site> sites = new LinkedHashMap<>();
        String sourceDate = null;
        while ((row = readRow(reader)) != null) {
            if (row.isEmpty()) continue;
            if (row.getFirst().startsWith("Letzte Aktualisierung vom:")) {
                sourceDate = LocalDate.parse(row.getFirst().substring(row.getFirst().indexOf(':') + 1).strip(), DateTimeFormatter.ofPattern("dd.MM.yyyy")).toString();
            }
            if (row.getFirst().replace("\uFEFF", "").equals("Ladeeinrichtungs-ID")) {
                columns = new HashMap<>();
                for (int i = 0; i < row.size(); i++) columns.put(row.get(i).replace("\uFEFF", ""), i);
                if (!columns.keySet().containsAll(List.of("Ladeeinrichtungs-ID", "Status", "Breitengrad", "Längengrad", "Betreiber", "Steckertypen1"))) {
                    throw new IOException("Register schema mismatch");
                }
                continue;
            }
            if (columns == null || !"In Betrieb".equals(value(row, columns, "Status"))) continue;
            String id = value(row, columns, "Ladeeinrichtungs-ID");
            if (!id.matches("[1-9][0-9]*")) continue;
            double lat, lon;
            try { lat = Double.parseDouble(value(row, columns, "Breitengrad").replace(',', '.'));
                  lon = Double.parseDouble(value(row, columns, "Längengrad").replace(',', '.')); }
            catch (NumberFormatException ignored) { continue; }
            if (!Double.isFinite(lat) || Math.abs(lat) > 90 || !Double.isFinite(lon) || Math.abs(lon) > 180) continue;
            String name = value(row, columns, "Anzeigename (Karte)");
            if (name.isBlank()) name = value(row, columns, "Betreiber");
            if (name.isBlank()) name = "Ladestation";
            List<String> address = new ArrayList<>();
            for (String field : List.of("Straße", "Hausnummer", "Postleitzahl", "Ort")) {
                String part = value(row, columns, field); if (!part.isBlank()) address.add(part);
            }
            List<String> connectors = new ArrayList<>();
            for (int i = 1; i <= 6; i++) {
                String socket = value(row, columns, "Steckertypen" + i);
                String power = value(row, columns, "Nennleistung Stecker" + i);
                if (!socket.isBlank()) {
                    String label = socket + (power.isBlank() ? "" : " · " + power + " kW");
                    if (!connectors.contains(label)) connectors.add(label);
                }
            }
            String opening = value(row, columns, "Öffnungszeiten");
            if (opening.equals("247")) opening = "24/7";
            else if (opening.isBlank() || opening.equalsIgnoreCase("Keine Angabe")) opening = null;
            else {
                String days = value(row, columns, "Öffnungszeiten: Wochentage");
                String hours = value(row, columns, "Öffnungszeiten: Tageszeiten");
                if (!days.isBlank() || !hours.isBlank()) opening = days + " · " + hours;
            }
            sites.putIfAbsent("bnetza:" + id, new Site("bnetza:" + id, name, lat, lon, 0, String.join(" ", address),
                    List.of("Elektro"), opening, null, List.copyOf(connectors)));
        }
        if (columns == null || sourceDate == null || sites.isEmpty()) throw new IOException("Empty or invalid register");
        return new Snapshot(modified, sourceDate, List.copyOf(sites.values()));
    }
    private static String value(List<String> row, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        return index != null && index < row.size() ? row.get(index).strip() : "";
    }
    /** Semicolon CSV with quoted separators, escaped quotes, and multiline fields. */
    private static List<String> readRow(Reader reader) throws IOException {
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false, started = false;
        int character;
        while ((character = reader.read()) != -1) {
            started = true;
            char c = (char) character;
            if (c == '"') {
                if (quoted) {
                    reader.mark(1); int next = reader.read();
                    if (next == '"') field.append('"');
                    else { quoted = false; if (next != -1) reader.reset(); }
                } else if (field.isEmpty()) quoted = true;
                else throw new IOException("Invalid CSV quoting");
            } else if (c == ';' && !quoted) { row.add(field.toString()); field.setLength(0);
            } else if (c == '\n' && !quoted) { row.add(field.toString()); return row;
            } else if (c != '\r' || quoted) field.append(c);
        }
        if (quoted) throw new IOException("Unclosed CSV field");
        if (!started) return null;
        row.add(field.toString()); return row;
    }
    private static double distanceKm(double lat, double lon, double latitude, double longitude) {
        double a = Math.pow(Math.sin(Math.toRadians(latitude - lat) / 2), 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(latitude)) * Math.pow(Math.sin(Math.toRadians(longitude - lon) / 2), 2);
        return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    }
    record Snapshot(Instant modified, String sourceDate, List<Site> sites) { }
}
