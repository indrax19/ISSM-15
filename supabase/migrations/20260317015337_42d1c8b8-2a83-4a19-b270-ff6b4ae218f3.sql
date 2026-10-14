
INSERT INTO storage.buckets (id, name, public) VALUES ('challan-documents', 'challan-documents', true);

CREATE POLICY "Allow public read access on challan-documents" ON storage.objects FOR SELECT USING (bucket_id = 'challan-documents');
CREATE POLICY "Allow public insert access on challan-documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'challan-documents');
CREATE POLICY "Allow public update access on challan-documents" ON storage.objects FOR UPDATE USING (bucket_id = 'challan-documents');
CREATE POLICY "Allow public delete access on challan-documents" ON storage.objects FOR DELETE USING (bucket_id = 'challan-documents');
