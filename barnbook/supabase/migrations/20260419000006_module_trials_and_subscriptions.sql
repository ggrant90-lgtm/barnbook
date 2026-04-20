-- ==========================================================================
-- Premium-module 30-day trial system for Breeders Pro + Business Pro.
-- ==========================================================================
-- Three tables:
--   1. module_trials          — one active 30-day trial per user per module.
--   2. module_subscriptions   — active (unbilled, no Stripe yet) subscriptions.
--   3. data_export_requests   — stub for the grey-out "Export my data" button.
--
-- Access model: a user has access to a module if ANY of these is true:
--   - profiles.has_<module> is true (admin flag / legacy).
--   - an active module_subscriptions row exists.
--   - a module_trials row exists with status='active' AND expires_at > now().
--
-- The trial and subscription server actions flip the profile flag for
-- back-compat with all the existing check sites. When a trial expires
-- lazily (on next ModuleGate render), the flag is flipped off too so the
-- existing server-action gates close.
--
-- RLS is inlined (auth.uid() = user_id) to avoid depending on the
-- SECURITY DEFINER helpers — same defensive pattern as 20260419000003
-- and 20260419000005.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE,
-- CREATE INDEX IF NOT EXISTS.
-- ==========================================================================


-- ── 1. module_trials ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_trials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module       text NOT NULL CHECK (module IN ('breeders_pro','business_pro')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  converted_at timestamptz,
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','expired','converted')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_module_trials_user
  ON public.module_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_module_trials_active
  ON public.module_trials(user_id, module)
  WHERE status = 'active';

ALTER TABLE public.module_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_trials_select ON public.module_trials;
CREATE POLICY module_trials_select ON public.module_trials
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS module_trials_insert ON public.module_trials;
CREATE POLICY module_trials_insert ON public.module_trials
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- No UPDATE/DELETE policy — mutation goes through server actions with the
-- admin client (trial expiration + conversion).


-- ── 2. module_subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module        text NOT NULL CHECK (module IN ('breeders_pro','business_pro')),
  price_cents   integer NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','cancelled','past_due')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_module_subs_user
  ON public.module_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_subs_active
  ON public.module_subscriptions(user_id, module)
  WHERE status = 'active';

ALTER TABLE public.module_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_subscriptions_select ON public.module_subscriptions;
CREATE POLICY module_subscriptions_select ON public.module_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE go through the admin-client server action (no Stripe yet
-- means there's no secure client-side path to create a subscription).


-- ── 3. data_export_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module        text NOT NULL CHECK (module IN ('breeders_pro','business_pro')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  fulfilled_at  timestamptz,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_pending
  ON public.data_export_requests(requested_at DESC)
  WHERE fulfilled_at IS NULL;

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_export_requests_select ON public.data_export_requests;
CREATE POLICY data_export_requests_select ON public.data_export_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS data_export_requests_insert ON public.data_export_requests;
CREATE POLICY data_export_requests_insert ON public.data_export_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
