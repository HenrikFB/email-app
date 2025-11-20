-- ============================================
-- Add Analyzed Email Metadata to KB Documents
-- ============================================
-- Stores snapshot of analyzed email data when KB documents are created
-- This preserves email context even if analyzed emails are deleted

-- Add analyzed_email_snapshot column to kb_documents
ALTER TABLE public.kb_documents
ADD COLUMN IF NOT EXISTS analyzed_email_snapshot JSONB;

-- Add GIN index for JSONB queries on snapshot
CREATE INDEX IF NOT EXISTS idx_kb_documents_analyzed_email_snapshot 
ON public.kb_documents USING GIN(analyzed_email_snapshot) 
WHERE analyzed_email_snapshot IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.kb_documents.analyzed_email_snapshot IS 
'Complete snapshot of analyzed email at creation time: {email_subject, email_from, email_date, reasoning, confidence, matched, extracted_data, data_by_source, scraped_urls}';

