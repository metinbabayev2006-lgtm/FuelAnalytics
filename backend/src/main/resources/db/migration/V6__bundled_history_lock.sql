-- Serializes first-start installers, including two backends sharing one database.
CREATE TABLE bundled_history_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    archive_sha256 VARCHAR(64),
    monthly_sha256 VARCHAR(64),
    installed_at TIMESTAMP WITH TIME ZONE
);
INSERT INTO bundled_history_state (id) VALUES (1);
