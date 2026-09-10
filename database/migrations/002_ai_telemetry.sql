-- ASCENDRA Database Migration: 002_ai_telemetry.sql
-- Table for tracking AI puzzle generation telemetry, latencies, and validation metrics

CREATE TABLE IF NOT EXISTS ai_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id VARCHAR(64),
  topic VARCHAR(64) NOT NULL DEFAULT 'general',
  difficulty VARCHAR(32) NOT NULL DEFAULT 'easy',
  status VARCHAR(32) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'validation_failed', 'service_error', 'fallback_used')),
  latency_ms INT NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for administrative analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_status ON ai_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created_at ON ai_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_topic ON ai_telemetry(topic);
