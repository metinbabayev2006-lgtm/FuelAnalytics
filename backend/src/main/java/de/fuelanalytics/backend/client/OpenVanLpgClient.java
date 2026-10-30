package de.fuelanalytics.backend.client;
import de.fuelanalytics.backend.model.OpenVanLpg;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class OpenVanLpgClient {
    private final URI endpoint;
    private final HttpClient http;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();
    private OpenVanLpg cached;
    private Instant nextAttempt;
    @Autowired
    public OpenVanLpgClient(@Value("${lpg.openvan-url:https://openvan.camp/api/fuel/prices?source=fuelanalytics-th-owl}") URI endpoint) {
        this(endpoint, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), Clock.systemUTC());
    }
    OpenVanLpgClient(URI endpoint, HttpClient http, Clock clock) { this.endpoint = endpoint; this.http = http; this.clock = clock; }
    public synchronized OpenVanLpg fetch() {
        Instant now = clock.instant();
        if (cached != null && now.isBefore(cached.retrievedAt().plus(Duration.ofHours(6)))) return cached;
        if (nextAttempt != null && now.isBefore(nextAttempt))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "OpenVan bitte frühestens nach zehn Minuten erneut anfragen");
        nextAttempt = now.plus(Duration.ofMinutes(10));
        try {
            var response = http.send(HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(12))
                    .header("Accept", "application/json").header("User-Agent", "FuelAnalytics-Educational/0.1").GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw invalid();
            var root = json.readTree(response.body());
            JsonNode de = root.path("data").path("DE");
            if (!root.path("success").asBoolean(false) || !"DE".equals(de.path("country_code").asText())) throw invalid();
            String currency = de.path("currencies").has("lpg") ? de.path("currencies").path("lpg").asText() : de.path("currency").asText();
            String unit = de.path("units").has("lpg") ? de.path("units").path("lpg").asText() : de.path("unit").asText();
            var raw = de.path("prices").path("lpg");
            if (!"EUR".equals(currency) || !"liter".equals(unit) || !raw.isNumber()) throw invalid();
            var price = raw.decimalValue();
            Instant fetched = Instant.parse(de.path("fetched_at").asText());
            if (price.signum() <= 0 || price.doubleValue() >= 20 || price.scale() > 6 || fetched.isAfter(now.plusSeconds(86400))) throw invalid();
            cached = new OpenVanLpg(price, currency, unit, fetched, now);
            return cached;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt(); throw invalid();
        } catch (ResponseStatusException error) { throw error;
        } catch (Exception error) { throw invalid(); }
    }
    private ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenVan liefert derzeit keine verwendbaren deutschen LPG-Preise"); }
}
