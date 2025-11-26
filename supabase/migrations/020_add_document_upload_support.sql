-- ============================================
-- Add Document Upload Support
-- ============================================
-- This migration adds support for uploading PDF and other document types
-- to knowledge bases with configurable processing and auto-save options

-- ============================================
-- 1. Alter kb_documents table
-- ============================================

-- Add uploaded_document type to existing constraint
ALTER TABLE public.kb_documents 
DROP CONSTRAINT IF EXISTS kb_documents_type_check;

ALTER TABLE public.kb_documents 
ADD CONSTRAINT kb_documents_type_check 
CHECK (type = ANY (ARRAY['text_note'::text, 'saved_email'::text, 'saved_url'::text, 'uploaded_document'::text]));

-- Add new columns for uploaded documents
ALTER TABLE public.kb_documents
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS processing_config JSONB,
ADD COLUMN IF NOT EXISTS processing_status TEXT,
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for processing_status
ALTER TABLE public.kb_documents
ADD CONSTRAINT kb_documents_processing_status_check 
CHECK (processing_status IS NULL OR processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'ready_for_review'::text]));

-- Create indexes for uploaded documents
CREATE INDEX IF NOT EXISTS idx_kb_documents_file_type 
ON public.kb_documents(file_type) 
WHERE file_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_documents_processing_status 
ON public.kb_documents(processing_status) 
WHERE processing_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_documents_file_path 
ON public.kb_documents(file_path) 
WHERE file_path IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.kb_documents.file_path IS 'Path to uploaded file in Supabase Storage (format: userId/kbId/documentId/filename)';
COMMENT ON COLUMN public.kb_documents.file_type IS 'MIME type or extension (pdf, docx, etc.)';
COMMENT ON COLUMN public.kb_documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.kb_documents.original_filename IS 'Original filename from user upload';
COMMENT ON COLUMN public.kb_documents.processing_config IS 'Document-specific processing settings (page ranges, OCR options, etc.)';
COMMENT ON COLUMN public.kb_documents.processing_status IS 'Status of document processing: pending, processing, completed, failed, ready_for_review';
COMMENT ON COLUMN public.kb_documents.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN public.kb_documents.processed_at IS 'Timestamp when processing completed';

-- ============================================
-- 2. Alter knowledge_bases table
-- ============================================

-- Add configuration columns
ALTER TABLE public.knowledge_bases
ADD COLUMN IF NOT EXISTS default_processing_config JSONB,
ADD COLUMN IF NOT EXISTS auto_save_uploads BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN public.knowledge_bases.default_processing_config IS 'Default processing settings for uploaded documents in this KB (page ranges, OCR, etc.)';
COMMENT ON COLUMN public.knowledge_bases.auto_save_uploads IS 'If true, automatically process and embed uploaded documents. If false, require manual review before saving.';

-- ============================================
-- 3. Create Storage Bucket (Manual Step Required)
-- ============================================
-- NOTE: The storage bucket must be created via the Supabase Dashboard or API
-- Cannot be created via SQL due to ownership restrictions
-- 
-- MANUAL STEP: Create bucket in Supabase Dashboard → Storage
--   Name: kb-documents
--   Public: false
--   File size limit: 10 MB
--   Allowed MIME types: application/pdf
--
-- Or use this API call (with service_role key):
-- curl -X POST "https://YOUR_PROJECT.supabase.co/storage/v1/bucket" \
--   -H "apiKey: YOUR_SERVICE_ROLE_KEY" \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"id":"kb-documents","name":"kb-documents","public":false,"file_size_limit":10485760,"allowed_mime_types":["application/pdf"]}'

-- ============================================
-- 4. Storage RLS Policies
-- ============================================
-- Note: Drop existing policies first to make this migration idempotent

-- Drop policies if they exist
DROP POLICY IF EXISTS "Users can upload to their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

-- Allow users to upload files to their own folders
CREATE POLICY "Users can upload to their own folders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kb-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kb-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kb-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files (for resumable uploads)
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'kb-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- Comments
-- ============================================
-- Note: Comments on storage.* tables require ownership and are skipped
-- Storage bucket 'kb-documents' stores uploaded PDF files with path format:
-- userId/kbId/documentId/filename

