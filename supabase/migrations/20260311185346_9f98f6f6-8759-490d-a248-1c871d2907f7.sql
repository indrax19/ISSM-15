
-- Create status enum for inventory items
CREATE TYPE public.item_status AS ENUM ('in', 'out');

-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('addition', 'removal');

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  barcode TEXT,
  name TEXT,
  status public.item_status NOT NULL DEFAULT 'in',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, serial_number)
);

-- Create inventory_transactions table (audit log)
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  recipient_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category_id);
CREATE INDEX idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX idx_inventory_items_barcode ON public.inventory_items(barcode);
CREATE INDEX idx_inventory_items_serial ON public.inventory_items(serial_number);
CREATE INDEX idx_transactions_item ON public.inventory_transactions(item_id);
CREATE INDEX idx_transactions_type ON public.inventory_transactions(type);
CREATE INDEX idx_transactions_created ON public.inventory_transactions(created_at);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies (no auth in v1 - using anon access)
CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inventory_transactions" ON public.inventory_transactions FOR ALL USING (true) WITH CHECK (true);
