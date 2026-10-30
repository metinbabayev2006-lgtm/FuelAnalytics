-- Separate country-level prices from actual station observations.
CREATE TABLE national_lpg_snapshot (
    source_fetched_at TIMESTAMP WITH TIME ZONE PRIMARY KEY,
    price NUMERIC(9, 6) NOT NULL CHECK (price > 0),
    retrieved_at TIMESTAMP WITH TIME ZONE NOT NULL
);
