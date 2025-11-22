-- ============================================
-- Add Original URLs Tracking
-- ============================================
-- Stores the original SafeLinks URLs before redirect resolution
-- This helps users understand which links from the email were actually scraped

-- Add original_urls array to track SafeLinks URLs
ALTER TABLE public.analyzed_emails
ADD COLUMN IF NOT EXISTS original_urls JSONB;

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_original_urls 
ON public.analyzed_emails USING GIN(original_urls) 
WHERE original_urls IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.analyzed_emails.original_urls IS 
'Maps actual URLs to their original SafeLinks URLs. Structure: [{ "original": "safelinks...", "actual": "real-url..." }]';

