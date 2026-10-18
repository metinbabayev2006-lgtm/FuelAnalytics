package de.fuelanalytics.backend.client;

import de.fuelanalytics.backend.model.Location;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
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
public class LocationClient {
    private final URI endpoint;
    private final URI postalEndpoint;
    private final HttpClient http;
    private final Clock clock;
    private final LongSupplier nanoTime;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Cached> cache = new LinkedHashMap<>(16, 0.75f, true);
    private Long lastRequest;

    @Autowired
    public LocationClient(@Value("${geocoding.search-url:https://geocoding-api.open-meteo.com/v1/search}") URI endpoint,
                          @Value("${geocoding.postal-url:https://api.zippopotam.us/de/}") URI postalEndpoint) {
        this(endpoint, postalEndpoint, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                Clock.systemUTC(), System::nanoTime);
    }

    LocationClient(URI endpoint, HttpClient http, Clock clock, LongSupplier nanoTime) {
        this(endpoint, URI.create("https://api.zippopotam.us/de/"), http, clock, nanoTime);
    }

    LocationClient(URI endpoint, URI postalEndpoint, HttpClient http, Clock clock, LongSupplier nanoTime) {
        this.endpoint = endpoint;
        this.postalEndpoint = URI.create(postalEndpoint.toString().replaceAll("/+$", "") + "/");
        this.http = http;
        this.clock = clock;
        this.nanoTime = nanoTime;
    }

    /** Button-triggered searches only; bounded in-memory cache lives for 24 hours. */
    public synchronized List<Location> search(String query) {
        String normalized = query == null ? "" : query.strip().replaceAll("\\s+", " ");
        if (normalized.length() < 2 || normalized.length() > 100 ||
                normalized.chars().anyMatch(Character::isISOControl) ||
                (normalized.matches("[0-9]+") && !isPostalQuery(normalized))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ort muss 2 bis 100 Zeichen enthalten; PLZ muss fünfstellig sein");
        }
        String key = normalized.toLowerCase(Locale.ROOT);
        Instant now = clock.instant();
        Cached hit = cache.get(key);
        if (hit != null && now.isBefore(hit.expiresAt())) return hit.locations();
        long tick = nanoTime.getAsLong();
        if (lastRequest != null && tick - lastRequest < Duration.ofSeconds(1).toNanos()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bitte kurz vor der nächsten Ortssuche warten");
        }
        lastRequest = tick;
        boolean postal = isPostalQuery(normalized);
        URI uri = postal ? postalEndpoint.resolve(normalized) : URI.create(endpoint + "?name=" + URLEncoder.encode(normalized, StandardCharsets.UTF_8)
                + "&count=5&language=de&countryCode=DE&format=json");
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json").header("User-Agent", "FuelAnalytics-Educational/0.1")
                .GET().build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            List<Location> result;
            if (postal && response.statusCode() == 404) result = List.of();
            else {
                if (response.statusCode() != 200) throw providerError();
                JsonNode root = json.readTree(response.body());
                if (root == null || !root.isObject() || root.path("error").asBoolean(false)) throw providerError();
                result = postal ? postalLocations(root, normalized) : cityLocations(root);
            }
            List<Location> immutable = List.copyOf(result);
            cache.put(key, new Cached(immutable, now.plus(Duration.ofHours(24))));
            if (cache.size() > 200) cache.remove(cache.keySet().iterator().next());
            return immutable;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw providerError();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            throw providerError();
        }
    }

    public static boolean isPostalQuery(String query) {
        return query != null && query.strip().matches("[0-9]{5}");
    }

    private List<Location> cityLocations(JsonNode root) {
        List<Location> result = new ArrayList<>();
        JsonNode rows = root.get("results");
        if (rows != null && !rows.isArray()) throw providerError();
        if (rows != null) for (JsonNode row : rows) {
            if (!"DE".equals(row.path("country_code").asText()) ||
                    !row.path("id").isIntegralNumber() || row.path("id").longValue() <= 0 ||
                    !row.path("name").isTextual() || row.path("name").asText().isBlank() ||
                    !row.path("latitude").isNumber() || !row.path("longitude").isNumber()) continue;
            double lat = row.get("latitude").doubleValue(), lng = row.get("longitude").doubleValue();
            if (!validCoordinates(lat, lng)) continue;
            result.add(new Location(row.get("id").longValue(), row.get("name").asText(),
                    optionalText(row, "admin1"), optionalText(row, "admin2"), lat, lng));
            if (result.size() == 5) break;
        }
        if (rows != null && !rows.isEmpty() && result.isEmpty()) throw providerError();
        return result;
    }

    private List<Location> postalLocations(JsonNode root, String postal) {
        if (!"DE".equals(root.path("country abbreviation").asText()) ||
                !postal.equals(root.path("post code").asText()) || !root.path("places").isArray()) throw providerError();
        List<Location> result = new ArrayList<>();
        for (JsonNode row : root.get("places")) {
            if (!row.path("place name").isTextual() || row.path("place name").asText().isBlank() ||
                    !row.path("latitude").isTextual() || !row.path("longitude").isTextual()) continue;
            try {
                double lat = Double.parseDouble(row.get("latitude").asText());
                double lng = Double.parseDouble(row.get("longitude").asText());
                if (!validCoordinates(lat, lng)) continue;
                // Separate namespace from positive GeoNames IDs and device/favorite centers.
                long id = -1_000_000L - Long.parseLong(postal) * 10 - result.size();
                result.add(new Location(id, postal + " " + row.get("place name").asText(),
                        optionalText(row, "state"), null, lat, lng));
                if (result.size() == 5) break;
            } catch (NumberFormatException ignored) { }
        }
        if (!root.get("places").isEmpty() && result.isEmpty()) throw providerError();
        return result;
    }

    private boolean validCoordinates(double latitude, double longitude) {
        return Double.isFinite(latitude) && Double.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    }

    private String optionalText(JsonNode row, String field) {
        return row.path(field).isTextual() ? row.get(field).asText() : null;
    }

    private ResponseStatusException providerError() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Die Ortsauflösung ist derzeit nicht verfügbar");
    }

    private record Cached(List<Location> locations, Instant expiresAt) { }
}
