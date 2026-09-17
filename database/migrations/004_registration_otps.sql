-- ASCENDRA Database Migration: 004_registration_otps.sql
-- Table for verifying real-world Gmail existence before creating player account

CREATE TABLE IF NOT EXISTS registration_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5,
  resend_available_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_registration_otps_email ON registration_otps(email);
CREATE INDEX IF NOT EXISTS idx_registration_otps_created_at ON registration_otps(created_at DESC);
