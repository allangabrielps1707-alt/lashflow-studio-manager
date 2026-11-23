CREATE TABLE public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('confirmacao','hoje','agradecimento','manutencao','vespera')),
  done_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminder logs" ON public.reminder_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX reminder_logs_done_idx ON public.reminder_logs (user_id, done_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN msg_today text NOT NULL DEFAULT 'Bom dia, {nome}! ✨ Passando para lembrar do seu horário hoje às {hora} para {procedimento}. Te espero! 💛';