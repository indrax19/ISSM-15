
-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- Allow public read access
CREATE POLICY "Public read access for company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated and anonymous uploads
CREATE POLICY "Allow uploads to company logos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-logos');

-- Allow deletes
CREATE POLICY "Allow deletes from company logos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'company-logos');
