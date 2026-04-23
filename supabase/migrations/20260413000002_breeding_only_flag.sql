-- Add breeding_only flag to horses.
-- When true, the horse is only visible in Breeders Pro (e.g. external
-- stallions at other farms). BarnBook's horse list filters them out.
-- Default false — horses appear in both BarnBook and Breeders Pro.

ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS breeding_only boolean NOT NULL DEFAULT false;
