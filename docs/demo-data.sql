-- Synthetic demonstration data only. No real station or market prices.
-- Run from the project root:
-- Get-Content docs/demo-data.sql -Raw | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U fuelanalytics -d fuelanalytics
BEGIN;

INSERT INTO station (id, name, brand, street, house_number, postal_code, place,
                     latitude, longitude, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111',
        'DEMO - Fiktive Tankstelle', 'SYNTHETISCH', 'Beispielstrasse', '1',
        '00000', 'Fiktiver Beispielort', 52.000000, 8.900000, '2026-10-16T12:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_observation (station_id, fuel_type, price, observed_at)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'e10', 1.759, '2026-10-16T08:00:00Z'),
    ('11111111-1111-4111-8111-111111111111', 'e10', 1.739, '2026-10-16T10:00:00Z'),
    ('11111111-1111-4111-8111-111111111111', 'e10', 1.769, '2026-10-16T12:00:00Z')
ON CONFLICT (station_id, fuel_type, observed_at) DO NOTHING;

COMMIT;
