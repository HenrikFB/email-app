-- Migration 005: Enhance analyzed_emails table for automated analysis
-- Adds columns for storing reasoning, confidence, original HTML, and all links found

-- Add new columns for enhanced analysis data
ALTER TABLE public.analyzed_emails 
  ADD COLUMN IF NOT EXISTS email_html_body TEXT,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS all_links_found TEXT[];

-- Add comments for clarity
COMMENT ON COLUMN public.analyzed_emails.email_html_body IS 'Original email HTML body for debugging and future reference';
COMMENT ON COLUMN public.analyzed_emails.reasoning IS 'AI reasoning explaining why email matched or did not match criteria';
COMMENT ON COLUMN public.analyzed_emails.confidence IS 'AI confidence score (0.00-1.00) for the match decision';
COMMENT ON COLUMN public.analyzed_emails.all_links_found IS 'All URLs found in the email (both scraped and not scraped)';

-- Create index on confidence for sorting by confidence
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_confidence 
  ON public.analyzed_emails(confidence DESC);

-- Create index on matched for filtering
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_matched 
  ON public.analyzed_emails(matched);

