package de.fuelanalytics.backend.client;

import de.fuelanalytics.backend.model.EnergySearchResult;
import de.fuelanalytics.backend.model.EnergySearchResult.Site;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class EnergyLocationClient {
    private final URI endpoint;
    private final HttpClient http;
    private final Clock clock;
    private final LongSupplier nanoTime;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, EnergySearchResult> cache = new LinkedHashMap<>(16, 0.75f, true);
    private Long lastRequest;

    @Autowired
    public EnergyLocationClient(@Value("${overpass.search-url:https://overpass.private.coffee/api/interpreter}") URI endpoint) {
        this(endpoint, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), Clock.systemUTC(), System::nanoTime);
    }
    EnergyLocationClient(URI endpoint, HttpClient http, Clock clock, LongSupplier nanoTime) {
        this.endpoint = endpoint; this.http = http; this.clock = clock; this.nanoTime = nanoTime;
    }

    /** Explicit user requests only; bounded 30-minute cache and no automatic retries. */
    public synchronized EnergySearchResult search(double lat, double lon, double radius, String kind) {
        if (!Double.isFinite(lat) || Math.abs(lat) > 90 || !Double.isFinite(lon) || Math.abs(lon) > 180 ||
                !Double.isFinite(radius) || radius <= 0 || radius > 25 ||
                !("electric".equals(kind) || "gas".equals(kind))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültiger Suchmittelpunkt, Radius (maximal 25 km) oder Energietyp");
        }
        String key = kind + ":" + lat + ":" + lon + ":" + radius;
        var hit = cache.get(key);
        if (hit != null && clock.instant().isBefore(hit.fetchedAt().plus(Duration.ofMinutes(30)))) return hit;
        long tick = nanoTime.getAsLong();
        if (lastRequest != null && tick - lastRequest < Duration.ofSeconds(5).toNanos()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bitte fünf Sekunden zwischen Standortabfragen warten");
        }
        String around = String.format(Locale.ROOT, "(around:%.0f,%.7f,%.7f)", radius * 1000, lat, lon);
        String selectors = "electric".equals(kind)
                ? "nwr[amenity=charging_station][access!=private][access!=no][motorcar!=no]" + around + ";"
                : "nwr[amenity=fuel][\"fuel:lpg\"=yes][access!=private][access!=no]" + around + ";"
                  + "nwr[amenity=fuel][\"fuel:cng\"=yes][access!=private][access!=no]" + around + ";";
        String query = "[out:json][timeout:20];(" + selectors + ");out center 501;";
        var request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(28))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Accept", "application/json").header("User-Agent", "FuelAnalytics/0.1 (https://github.com/metinbabayev2006-lgtm/FuelAnalytics)")
                .POST(HttpRequest.BodyPublishers.ofString("data=" + URLEncoder.encode(query, StandardCharsets.UTF_8))).build();
        lastRequest = tick;
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Der Standortanbieter ist ausgelastet");
            if (response.statusCode() != 200 || response.body().length() > 8_000_000) throw providerError();
            var root = json.readTree(response.body());
            if (root == null || !root.isObject() || root.has("remark") || !root.path("elements").isArray()) throw providerError();
            List<Site> sites = new ArrayList<>();
            for (var row : root.get("elements")) {
                Site site = map(row, lat, lon, radius, kind);
                if (site != null) sites.add(site);
            }
            sites.sort(Comparator.comparingDouble(Site::distanceKm).thenComparing(Site::id));
            var result = new EnergySearchResult(clock.instant(), kind, List.copyOf(sites.subList(0, Math.min(500, sites.size()))), root.get("elements").size() > 500);
            cache.put(key, result);
            if (cache.size() > 100) cache.remove(cache.keySet().iterator().next());
            return result;
        } catch (HttpTimeoutException error) {
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Der Standortanbieter hat nicht rechtzeitig geantwortet");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt(); throw providerError();
        } catch (ResponseStatusException error) { throw error;
        } catch (Exception error) { throw providerError(); }
    }

    private Site map(JsonNode row, double lat, double lon, double radius, String kind) {
        var tags = row.path("tags");
        String type = row.path("type").asText();
        if (!List.of("node", "way", "relation").contains(type) || !row.path("id").isIntegralNumber() || row.path("id").longValue() <= 0 ||
                List.of("private", "no").contains(text(tags, "access") == null ? "" : text(tags, "access"))) return null;
        List<String> services = new ArrayList<>();
        if ("electric".equals(kind)) {
            if (!"charging_station".equals(text(tags, "amenity")) || "no".equals(text(tags, "motorcar"))) return null;
            services.add("Elektro");
        } else {
            if (!"fuel".equals(text(tags, "amenity"))) return null;
            if ("yes".equals(text(tags, "fuel:lpg"))) services.add("LPG");
            if ("yes".equals(text(tags, "fuel:cng"))) services.add("CNG");
            if (services.isEmpty()) return null;
        }
        var position = "node".equals(type) ? row : row.path("center");
        if (!position.path("lat").isNumber() || !position.path("lon").isNumber()) return null;
        double latitude = position.get("lat").doubleValue(), longitude = position.get("lon").doubleValue();
        if (!Double.isFinite(latitude) || Math.abs(latitude) > 90 || !Double.isFinite(longitude) || Math.abs(longitude) > 180) return null;
        double distance = distanceKm(lat, lon, latitude, longitude);
        if (distance > radius) return null;
        String name = text(tags, "name");
        if (name == null) name = text(tags, "brand");
        if (name == null) name = text(tags, "operator");
        if (name == null) name = "electric".equals(kind) ? "Ladestation" : "Gastankstelle";
        List<String> address = new ArrayList<>();
        for (String field : List.of("addr:street", "addr:housenumber", "addr:postcode", "addr:city")) {
            String value = text(tags, field); if (value != null) address.add(value);
        }
        List<String> connectors = new ArrayList<>();
        if ("electric".equals(kind)) for (String socket : List.of("type2", "type2_combo", "chademo", "schuko")) {
            String value = text(tags, "socket:" + socket);
            if (value != null && (value.equals("yes") || value.matches("[1-9][0-9]*"))) {
                String label = switch(socket) { case "type2" -> "Typ 2"; case "type2_combo" -> "CCS"; case "chademo" -> "CHAdeMO"; default -> "Schuko"; };
                String output = text(tags, "socket:" + socket + ":output");
                connectors.add(label + (output == null ? "" : " · " + output));
            }
        }
        return new Site("osm:" + type + ":" + row.get("id").longValue(), name, latitude, longitude, distance,
                String.join(" ", address), List.copyOf(services), text(tags, "opening_hours"), text(tags, "access"), List.copyOf(connectors));
    }
    private String text(JsonNode node, String field) {
        var value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText().strip().substring(0, Math.min(value.asText().strip().length(), 300)) : null;
    }
    private double distanceKm(double lat, double lon, double latitude, double longitude) {
        double a = Math.pow(Math.sin(Math.toRadians(latitude - lat) / 2), 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(latitude)) * Math.pow(Math.sin(Math.toRadians(longitude - lon) / 2), 2);
        return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    }
    private ResponseStatusException providerError() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Der Standortanbieter ist nicht erreichbar oder liefert ungültige Daten");
    }
}
