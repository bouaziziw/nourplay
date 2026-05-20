-- Création de la base de test (utilisée par le CI)
CREATE DATABASE nourplay_test;
GRANT ALL PRIVILEGES ON DATABASE nourplay_test TO nourplay;

-- Extension UUID
\c nourplay;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c nourplay_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
