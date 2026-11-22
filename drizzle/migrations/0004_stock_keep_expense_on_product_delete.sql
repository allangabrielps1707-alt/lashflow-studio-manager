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
    -- Only an entry removed on its own takes its expense along; deleting the whole product keeps past expenses.
    IF OLD.transaction_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id) THEN
      DELETE FROM public.transactions WHERE id = OLD.transaction_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;