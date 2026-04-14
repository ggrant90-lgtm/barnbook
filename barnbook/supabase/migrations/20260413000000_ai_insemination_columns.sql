-- Add AI insemination tracking columns to pregnancies
-- These support the expanded Traditional Carry flow (live cover + AI)

ALTER TABLE pregnancies
  ADD COLUMN IF NOT EXISTS semen_source text,
  ADD COLUMN IF NOT EXISTS collection_date date,
  ADD COLUMN IF NOT EXISTS insemination_technique text,
  ADD COLUMN IF NOT EXISTS semen_volume_ml numeric,
  ADD COLUMN IF NOT EXISTS motility_percent numeric,
  ADD COLUMN IF NOT EXISTS semen_dose text;

-- Constrain insemination_technique to known values
ALTER TABLE pregnancies
  ADD CONSTRAINT chk_insemination_technique
  CHECK (insemination_technique IS NULL OR insemination_technique IN (
    'standard_uterine', 'deep_horn', 'hysteroscopic'
  ));

-- Constrain motility to 0-100 range
ALTER TABLE pregnancies
  ADD CONSTRAINT chk_motility_percent
  CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100));
