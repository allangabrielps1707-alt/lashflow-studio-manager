-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  business_name text,
  phone text,
  msg_confirmation text NOT NULL DEFAULT 'Olá {nome}! ✨ Passando para confirmar seu horário de {procedimento} no dia {data} às {hora}. Posso confirmar?',
  msg_reminder text NOT NULL DEFAULT 'Oi {nome}! Lembrete do seu horário amanhã, {data} às {hora}, para {procedimento}. Te espero! 💛',
  msg_maintenance text NOT NULL DEFAULT 'Oi {nome}! Já está na hora da manutenção dos seus cílios ✨ Vamos agendar? Me diga o melhor dia para você.',
  msg_thanks text NOT NULL DEFAULT 'Obrigada pela visita, {nome}! Espero que tenha amado o resultado 💛 Qualquer dúvida sobre os cuidados, me chame.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  phone text,
  email text,
  birthday date,
  allergies text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_user_idx ON public.clients(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients" ON public.clients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Procedures
CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'aplicacao',
  lash_model text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 120,
  maintenance_days integer,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX procedures_user_idx ON public.procedures(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own procedures" ON public.procedures FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER procedures_touch BEFORE UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  procedure_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 120,
  price numeric(10,2) NOT NULL DEFAULT 0,
  deposit numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  status text NOT NULL DEFAULT 'agendado',
  notes text,
  cancel_reason text,
  reschedule_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_user_start_idx ON public.appointments(user_id, starts_at);
CREATE INDEX appointments_client_idx ON public.appointments(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appointments" ON public.appointments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER appointments_touch BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Appointment events (history of status changes / reschedules)
CREATE TABLE public.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_starts_at timestamptz,
  to_starts_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointment_events_appt_idx ON public.appointment_events(appointment_id);
GRANT SELECT, INSERT, DELETE ON public.appointment_events TO authenticated;
GRANT ALL ON public.appointment_events TO service_role;
ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.appointment_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('receita','despesa')),
  category text NOT NULL DEFAULT 'Outros',
  description text,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  occurred_on date NOT NULL DEFAULT current_date,
  payment_method text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_date_idx ON public.transactions(user_id, occurred_on);
CREATE INDEX transactions_appt_idx ON public.transactions(appointment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recalc_appointment_paid(_appt uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.appointments a SET amount_paid = COALESCE((
    SELECT SUM(CASE WHEN t.type = 'receita' THEN t.amount ELSE -t.amount END)
    FROM public.transactions t WHERE t.appointment_id = _appt
  ), 0)
  WHERE a.id = _appt;
$$;

CREATE OR REPLACE FUNCTION public.transactions_sync_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.appointment_id IS NOT NULL THEN
    PERFORM public.recalc_appointment_paid(OLD.appointment_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.appointment_id IS NOT NULL THEN
    PERFORM public.recalc_appointment_paid(NEW.appointment_id);
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER transactions_paid_sync AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_sync_paid();
REVOKE EXECUTE ON FUNCTION public.recalc_appointment_paid(uuid) FROM PUBLIC, anon, authenticated;

-- Client photos
CREATE TABLE public.client_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'depois',
  caption text,
  taken_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_photos_client_idx ON public.client_photos(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_photos TO authenticated;
GRANT ALL ON public.client_photos TO service_role;
ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own photos" ON public.client_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage policies: files live under {user_id}/...
CREATE POLICY "own photo files select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own photo files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own photo files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-photos' AND (storage.foldername(name))[1] = auth.uid()::text);