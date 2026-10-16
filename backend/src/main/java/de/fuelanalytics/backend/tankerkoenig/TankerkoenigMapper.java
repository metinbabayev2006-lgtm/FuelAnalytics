package de.fuelanalytics.backend.tankerkoenig;

import de.fuelanalytics.backend.price.FuelType;
import de.fuelanalytics.backend.station.Station;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class TankerkoenigMapper {
    public StationSearchResult map(TankerkoenigClient.SearchResponse response) {
        List<StationSearchResult.Entry> stations = new ArrayList<>();
        var ids = new HashSet<UUID>();
        int rejected = 0;
        for (JsonNode row : response.stations()) {
            try {
                var entry = mapEntry(row, response.observedAt());
                if (!ids.add(entry.station().id())) throw new IllegalArgumentException();
                stations.add(entry);
            } catch (IllegalArgumentException | ArithmeticException error) {
                // Do not expose or log raw provider records.
                rejected++;
            }
        }
        return new StationSearchResult(response.observedAt(), List.copyOf(stations), rejected);
    }

    private StationSearchResult.Entry mapEntry(JsonNode row, Instant observedAt) {
        String idText = text(row, "id", 36, true);
        if (!idText.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) throw new IllegalArgumentException();
        var lat = number(row.get("lat"));
        var lng = number(row.get("lng"));
        if (lat.abs().compareTo(BigDecimal.valueOf(90)) > 0 ||
                lng.abs().compareTo(BigDecimal.valueOf(180)) > 0) throw new IllegalArgumentException();
        var distance = number(row.get("dist"));
        if (distance.signum() < 0 || !row.path("isOpen").isBoolean()) throw new IllegalArgumentException();
        boolean open = row.get("isOpen").asBoolean();
        var station = new Station(UUID.fromString(idText), text(row, "name", 255, true),
                text(row, "brand", 255, false), text(row, "street", 255, false),
                text(row, "houseNumber", 50, false), postalCode(row.get("postCode")),
                text(row, "place", 255, false), lat.setScale(6, RoundingMode.HALF_UP),
                lng.setScale(6, RoundingMode.HALF_UP), observedAt);
        Map<FuelType, BigDecimal> prices = new EnumMap<>(FuelType.class);
        for (FuelType fuel : FuelType.values()) {
            JsonNode value = row.get(fuel.name());
            if (value == null || value.isNull() || (value.isBoolean() && !value.asBoolean())) continue;
            BigDecimal price = number(value).setScale(3, RoundingMode.UNNECESSARY);
            if (price.signum() <= 0 || price.compareTo(new BigDecimal("999.999")) > 0) throw new IllegalArgumentException();
            // Closed station values are not treated as available current prices.
            if (open) prices.put(fuel, price);
        }
        return new StationSearchResult.Entry(station, open, distance, Map.copyOf(prices));
    }

    private String text(JsonNode row, String field, int maxLength, boolean required) {
        JsonNode value = row.get(field);
        if (value == null || value.isNull()) {
            if (required) throw new IllegalArgumentException();
            return null;
        }
        if (!value.isTextual()) throw new IllegalArgumentException();
        String text = value.asText().trim();
        if (text.length() > maxLength || (required && text.isEmpty())) throw new IllegalArgumentException();
        return text;
    }

    private BigDecimal number(JsonNode value) {
        if (value == null || !value.isNumber()) throw new IllegalArgumentException();
        try {
            return value.decimalValue();
        } catch (RuntimeException error) {
            throw new IllegalArgumentException();
        }
    }

    private String postalCode(JsonNode value) {
        if (value == null || value.isNull()) return null;
        String code;
        if (value.isIntegralNumber()) code = value.asText();
        else if (value.isTextual()) code = value.asText().trim();
        else throw new IllegalArgumentException();
        if (!code.matches("[0-9]{1,5}")) throw new IllegalArgumentException();
        return "0".repeat(5 - code.length()) + code;
    }
}
