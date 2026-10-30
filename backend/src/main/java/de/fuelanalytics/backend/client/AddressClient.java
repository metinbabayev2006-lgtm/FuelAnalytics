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
import tools.jackson.databind.ObjectMapper;

/** Explicit address searches only: no autocomplete, cached, at most one request/second. */
@Component
public class AddressClient {
    private final URI endpoint;
    private final HttpClient http;
    private final Clock clock;
    private final LongSupplier nanoTime;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Cached> cache = new LinkedHashMap<>(16, .75f, true);
    private Long lastRequest;

    @Autowired
    public AddressClient(@Value("${geocoding.address-url:https://nominatim.openstreetmap.org/search}") URI endpoint) {
        this(endpoint, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), Clock.systemUTC(), System::nanoTime);
    }

    AddressClient(URI endpoint, HttpClient http, Clock clock, LongSupplier nanoTime) {
        this.endpoint = endpoint; this.http = http; this.clock = clock; this.nanoTime = nanoTime;
    }

    public synchronized List<Location> search(String query) {
        String normalized = query == null ? "" : query.strip().replaceAll("\\s+", " ");
        if (normalized.length() < 2 || normalized.length() > 100 || normalized.chars().anyMatch(Character::isISOControl))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adresse muss 2 bis 100 Zeichen enthalten");
        String key = normalized.toLowerCase(Locale.ROOT);
        Instant now = clock.instant();
        Cached hit = cache.get(key);
        if (hit != null && now.isBefore(hit.expiresAt())) return hit.locations();
        long tick = nanoTime.getAsLong();
        if (lastRequest != null && tick - lastRequest < Duration.ofSeconds(1).toNanos())
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bitte kurz vor der nächsten Adresssuche warten");
        lastRequest = tick;
        URI uri = URI.create(endpoint + "?format=jsonv2&addressdetails=1&countrycodes=de&limit=5&accept-language=de&q="
                + URLEncoder.encode(normalized, StandardCharsets.UTF_8));
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json")
                .header("User-Agent", "FuelAnalytics-Educational/0.1 (+https://github.com/metinbabayev2006-lgtm/FuelAnalytics)")
                .GET().build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Adressdienst begrenzt Anfragen");
            if (response.statusCode() != 200) throw providerError();
            var rows = json.readTree(response.body());
            if (rows == null || !rows.isArray()) throw providerError();
            List<Location> results = new ArrayList<>();
            for (var row : rows) {
                if (!"de".equals(row.path("address").path("country_code").asText()) ||
                        !row.path("place_id").isIntegralNumber() || !row.path("display_name").isTextual() ||
                        row.path("display_name").asText().isBlank() || !row.path("lat").isTextual() || !row.path("lon").isTextual()) continue;
                try {
                    double lat = Double.parseDouble(row.get("lat").asText()), lng = Double.parseDouble(row.get("lon").asText());
                    long id = row.get("place_id").longValue();
                    if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
                            id <= 0 || id > 8_000_000_000_000_000L) continue;
                    results.add(new Location(-100_000_000_000L - id, row.get("display_name").asText(), null, null, lat, lng));
                    if (results.size() == 5) break;
                } catch (NumberFormatException ignored) { }
            }
            if (!rows.isEmpty() && results.isEmpty()) throw providerError();
            var immutable = List.copyOf(results);
            cache.put(key, new Cached(immutable, now.plus(Duration.ofHours(24))));
            if (cache.size() > 200) cache.remove(cache.keySet().iterator().next());
            return immutable;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt(); throw providerError();
        } catch (ResponseStatusException error) { throw error;
        } catch (Exception error) { throw providerError(); }
    }
    private ResponseStatusException providerError() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Die Adresssuche ist derzeit nicht verfügbar");
    }
    private record Cached(List<Location> locations, Instant expiresAt) { }
}
