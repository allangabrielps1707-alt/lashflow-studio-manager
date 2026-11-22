CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Outros',
  unit text NOT NULL DEFAULT 'un',
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  expires_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada','saida')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  unit_cost numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock movements" ON public.stock_movements FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX stock_movements_product_idx ON public.stock_movements (product_id, occurred_on DESC);

-- Keeps products.quantity in step with its movements; runs as the caller so RLS still applies.
CREATE OR REPLACE FUNCTION public.stock_apply_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  delta numeric;
  new_qty numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE WHEN NEW.type = 'entrada' THEN NEW.quantity ELSE -NEW.quantity END;
    UPDATE public.products SET quantity = quantity + delta
      WHERE id = NEW.product_id RETURNING quantity INTO new_qty;
    IF new_qty IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF new_qty < 0 THEN
      RAISE EXCEPTION 'Saída maior que o estoque disponível';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE WHEN OLD.type = 'entrada' THEN -OLD.quantity ELSE OLD.quantity END;
    UPDATE public.products SET quantity = GREATEST(quantity + delta, 0)
      WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER stock_movements_apply
  AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_apply_movement();