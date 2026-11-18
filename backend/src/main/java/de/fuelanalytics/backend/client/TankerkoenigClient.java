package de.fuelanalytics.backend.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Internal adapter; provider records still require domain validation before storage. */
@Component
public class TankerkoenigClient {
    private static final Logger LOG = LoggerFactory.getLogger(TankerkoenigClient.class);
    private final String apiKey;
    private final URI endpoint;
    private final HttpClient http;
    private final LongSupplier nanoTime;
    private final ObjectMapper json = new ObjectMapper();
    private Long lastRequest;
    private static final long MIN_INTERVAL = Duration.ofSeconds(61).toNanos();
    private final LinkedHashMap<UUID, CachedHours> hoursCache = new LinkedHashMap<>();

    @Autowired
    public TankerkoenigClient(@Value("${TANKERKOENIG_API_KEY:}") String apiKey) {
        this(apiKey, URI.create("https://creativecommons.tankerkoenig.de/json/list.php"),
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), System::nanoTime);
    }

    TankerkoenigClient(String apiKey, URI endpoint, HttpClient http, LongSupplier nanoTime) {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.http = http;
        this.nanoTime = nanoTime;
    }

    /** No automatic retries or background requests. Gate applies to this backend instance. */
    public synchronized SearchResponse search(double latitude, double longitude, double radiusKm) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90 ||
                !Double.isFinite(longitude) || longitude < -180 || longitude > 180 ||
                !Double.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 25) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültige Koordinaten oder Radius (maximal 25 km)");
        }
        var observedAt = Instant.now();
        var rows = request(endpoint, "lat=" + latitude + "&lng=" + longitude +
                "&rad=" + radiusKm + "&type=all&sort=dist", "stations");
        if (!rows.isArray()) throw providerError();
        return new SearchResponse(observedAt, rows);
    }

    public synchronized OpeningHours openingHours(UUID id) {
        var cached = hoursCache.get(id);
        long now = nanoTime.getAsLong();
        if (cached != null && now - cached.loadedAt() < Duration.ofMinutes(10).toNanos()) return cached.hours();
        var station = request(endpoint.resolve("detail.php"), "id=" + id, "station");
        if (!station.isObject() || !id.toString().equalsIgnoreCase(station.path("id").asText())) throw providerError();
        var periods = new ArrayList<OpeningPeriod>();
        for (var row : station.path("openingTimes")) {
            String start = row.path("start").asText(), end = row.path("end").asText(), label = row.path("text").asText();
            if (!label.isBlank() && validTime(start) && validTime(end)) periods.add(new OpeningPeriod(label, start.substring(0, 5), end.substring(0, 5)));
        }
        var exceptions = new ArrayList<String>();
        for (var row : station.path("overrides")) if (row.isTextual() && !row.asText().isBlank()) exceptions.add(row.asText());
        var hours = new OpeningHours(station.path("wholeDay").asBoolean(false), List.copyOf(periods), List.copyOf(exceptions));
        hoursCache.put(id, new CachedHours(now, hours));
        if (hoursCache.size() > 200) hoursCache.pollFirstEntry();
        return hours;
    }

    private static boolean validTime(String value) {
        return value.matches("(?:(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?|24:00(?::00)?)");
    }

    private JsonNode request(URI target, String query, String field) {
        if (!apiKey.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tankerkönig-Schlüssel fehlt oder hat ein ungültiges Format");
        }
        long now = nanoTime.getAsLong();
        if (lastRequest != null && now - lastRequest < MIN_INTERVAL) {
            long seconds = Math.max(1, (MIN_INTERVAL - (now - lastRequest) + 999_999_999) / 1_000_000_000);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Tankerkönig wurde kürzlich abgefragt.") {
                @Override public HttpHeaders getHeaders() {
                    var headers = new HttpHeaders();
                    headers.set(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
                    return headers;
                }
            };
        }
        URI uri = URI.create(target + "?" + query + "&apikey=" + apiKey);
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(12))
                .header("Accept", "application/json").GET().build();
        lastRequest = now;
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                LOG.warn("Tankerkönig request failed: upstream_http_status={}", response.statusCode());
                throw providerError();
            }
            JsonNode root = json.readTree(response.body());
            if (root == null || !root.isObject() || !root.path("ok").isBoolean() ||
                    !root.path("ok").asBoolean() || !root.hasNonNull(field)) {
                LOG.warn("Tankerkönig request failed: rejected_or_invalid_response");
                throw providerError();
            }
            return root.get(field);
        } catch (HttpTimeoutException error) {
            LOG.warn("Tankerkönig request failed: timeout");
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,
                    "Tankerkönig hat nicht rechtzeitig geantwortet");
        } catch (InterruptedException error) {
            LOG.warn("Tankerkönig request failed: interrupted");
            Thread.currentThread().interrupt();
            throw providerError();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            // Do not propagate exceptions, URLs or provider messages containing the API key.
            LOG.warn("Tankerkönig request failed: exception_type={}", error.getClass().getSimpleName());
            throw providerError();
        }
    }

    private ResponseStatusException providerError() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Tankerkönig ist nicht erreichbar oder liefert keine gültige Antwort");
    }

    public record SearchResponse(Instant observedAt, JsonNode stations) { }
    public record OpeningPeriod(String label, String start, String end) { }
    public record OpeningHours(boolean wholeDay, List<OpeningPeriod> periods, List<String> exceptions) { }
    private record CachedHours(long loadedAt, OpeningHours hours) { }
}
