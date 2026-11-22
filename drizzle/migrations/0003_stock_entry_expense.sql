ALTER TABLE public.stock_movements
  ADD COLUMN total_cost numeric,
  ADD COLUMN transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.stock_movements.unit_cost IS 'DEPRECATED: replaced by total_cost';

CREATE OR REPLACE FUNCTION public.stock_movement_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pname text;
  tx_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'entrada' AND COALESCE(NEW.total_cost, 0) > 0 THEN
      SELECT name INTO pname FROM public.products WHERE id = NEW.product_id;
      INSERT INTO public.transactions (user_id, type, category, description, amount, occurred_on)
      VALUES (NEW.user_id, 'despesa', 'Material', 'Estoque: ' || COALESCE(pname, 'produto') || ' (' || NEW.quantity || ')', NEW.total_cost, NEW.occurred_on)
      RETURNING id INTO tx_id;
      NEW.transaction_id := tx_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_id IS NOT NULL THEN
      DELETE FROM public.transactions WHERE id = OLD.transaction_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER stock_movements_expense_insert
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_expense();
CREATE TRIGGER stock_movements_expense_delete
  AFTER DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_expense();