package de.fuelanalytics.backend.tankerkoenig;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
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
        if (!apiKey.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tankerkönig-Schlüssel fehlt oder hat ein ungültiges Format");
        }
        long now = nanoTime.getAsLong();
        if (lastRequest != null && now - lastRequest < MIN_INTERVAL) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Tankerkönig wurde kürzlich abgefragt. Bitte mindestens 61 Sekunden zwischen Abfragen warten.");
        }
        URI uri = URI.create(endpoint + "?lat=" + latitude + "&lng=" + longitude +
                "&rad=" + radiusKm + "&type=all&sort=dist&apikey=" + apiKey);
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(12))
                .header("Accept", "application/json").GET().build();
        lastRequest = now;
        Instant observedAt = Instant.now();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                LOG.warn("Tankerkönig request failed: upstream_http_status={}", response.statusCode());
                throw providerError();
            }
            JsonNode root = json.readTree(response.body());
            if (root == null || !root.isObject() || !root.path("ok").isBoolean() ||
                    !root.path("ok").asBoolean() || !root.path("stations").isArray()) {
                LOG.warn("Tankerkönig request failed: rejected_or_invalid_response");
                throw providerError();
            }
            return new SearchResponse(observedAt, root.get("stations"));
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
}
