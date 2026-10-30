package de.fuelanalytics.backend.service;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class LpgHistory {
    public record Point(LocalDate date, BigDecimal price) { }
    public record Series(String country, String fuel, String unit, boolean taxesIncluded, String source,
                         String sourceUrl, Instant importedAt, List<Point> points) { }
    private final Series series;
    public LpgHistory() throws IOException {
        try (var input = new ClassPathResource("data/lpg-de-weekly.json").getInputStream()) {
            var root = new ObjectMapper().readTree(input);
            if (!"DE".equals(root.path("country").asText()) || !"lpg".equals(root.path("fuel").asText()) ||
                    !"EUR/l".equals(root.path("unit").asText()) || !root.path("taxesIncluded").asBoolean() || !root.path("points").isArray())
                throw new IOException("Unexpected LPG dataset");
            List<Point> points = new ArrayList<>();
            LocalDate previous = LocalDate.MIN;
            for (var value : root.get("points")) {
                LocalDate date = LocalDate.parse(value.path("date").asText());
                if (!value.path("price").isNumber()) throw new IOException("Invalid LPG price");
                var price = value.get("price").decimalValue();
                if (!date.isAfter(previous) || price.signum() <= 0 || price.doubleValue() >= 20) throw new IOException("Invalid LPG sequence");
                points.add(new Point(date, price)); previous = date;
            }
            if (points.isEmpty()) throw new IOException("Empty LPG history");
            series = new Series("DE", "lpg", "EUR/l", true, root.get("source").asText(), root.get("sourceUrl").asText(),
                    Instant.parse(root.get("importedAt").asText()), List.copyOf(points));
        }
    }
    public Series series() { return series; }
}
