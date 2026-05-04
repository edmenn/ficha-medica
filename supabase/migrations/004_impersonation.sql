ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impersonation_started';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impersonation_ended';

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id),
  target_user_id uuid NOT NULL REFERENCES public.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT no_self_impersonation CHECK (admin_id != target_user_id)
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON public.impersonation_sessions(id)
  WHERE ended_at IS NULL;
