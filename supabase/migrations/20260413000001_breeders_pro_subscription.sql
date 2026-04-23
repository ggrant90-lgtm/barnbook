-- Add Breeders Pro subscription flag to profiles.
-- When true, the user can access /breeders-pro/* routes.
-- Default false — must be explicitly enabled per user.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_breeders_pro boolean NOT NULL DEFAULT false;
