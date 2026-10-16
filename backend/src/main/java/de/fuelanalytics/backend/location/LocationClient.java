package de.fuelanalytics.backend.location;

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
    private final HttpClient http;
    private final Clock clock;
    private final LongSupplier nanoTime;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Cached> cache = new LinkedHashMap<>(16, 0.75f, true);
    private Long lastRequest;

    @Autowired
    public LocationClient(@Value("${geocoding.search-url:https://geocoding-api.open-meteo.com/v1/search}") URI endpoint) {
        this(endpoint, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                Clock.systemUTC(), System::nanoTime);
    }

    LocationClient(URI endpoint, HttpClient http, Clock clock, LongSupplier nanoTime) {
        this.endpoint = endpoint;
        this.http = http;
        this.clock = clock;
        this.nanoTime = nanoTime;
    }

    /** Button-triggered searches only; bounded in-memory cache lives for 24 hours. */
    public synchronized List<Location> search(String query) {
        String normalized = query == null ? "" : query.strip().replaceAll("\\s+", " ");
        if (normalized.length() < 2 || normalized.length() > 100 ||
                normalized.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ort oder PLZ muss 2 bis 100 Zeichen enthalten");
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
        URI uri = URI.create(endpoint + "?name=" + URLEncoder.encode(normalized, StandardCharsets.UTF_8)
                + "&count=5&language=de&countryCode=DE&format=json");
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json").header("User-Agent", "FuelAnalytics-Educational/0.1")
                .GET().build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw providerError();
            JsonNode root = json.readTree(response.body());
            if (root == null || !root.isObject() || root.path("error").asBoolean(false)) throw providerError();
            List<Location> result = new ArrayList<>();
            JsonNode rows = root.get("results");
            if (rows != null && !rows.isArray()) throw providerError();
            if (rows != null) for (JsonNode row : rows) {
                if (!"DE".equals(row.path("country_code").asText()) ||
                        !row.path("id").isIntegralNumber() || row.path("id").longValue() <= 0 ||
                        !row.path("name").isTextual() || row.path("name").asText().isBlank() ||
                        !row.path("latitude").isNumber() || !row.path("longitude").isNumber()) continue;
                double lat = row.get("latitude").doubleValue();
                double lng = row.get("longitude").doubleValue();
                if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
                result.add(new Location(row.get("id").longValue(), row.get("name").asText(),
                        optionalText(row, "admin1"), optionalText(row, "admin2"), lat, lng));
                if (result.size() == 5) break;
            }
            if (rows != null && !rows.isEmpty() && result.isEmpty()) throw providerError();
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

    private String optionalText(JsonNode row, String field) {
        return row.path(field).isTextual() ? row.get(field).asText() : null;
    }

    private ResponseStatusException providerError() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Die Ortsauflösung ist derzeit nicht verfügbar");
    }

    private record Cached(List<Location> locations, Instant expiresAt) { }
}
