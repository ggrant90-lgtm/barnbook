-- Add Breeders Pro subscription flag to barns.
-- When true, the barn's users can access /breeders-pro/* routes.
-- Default false — must be explicitly enabled per barn.

ALTER TABLE barns
  ADD COLUMN IF NOT EXISTS has_breeders_pro boolean NOT NULL DEFAULT false;
