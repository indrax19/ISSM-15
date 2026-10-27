
-- Create sub_categories table
CREATE TABLE public.sub_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_no TEXT,
  supplier_name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching existing pattern)
CREATE POLICY "Allow all access to sub_categories"
ON public.sub_categories FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Add subcategory_id to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN subcategory_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL;
