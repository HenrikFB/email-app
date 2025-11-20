-- ============================================
-- Add Scraped Content Storage
-- ============================================
-- Stores scraped markdown content from URLs for full content viewing

-- Add scraped_content to store markdown from scraped URLs
ALTER TABLE public.analyzed_emails
ADD COLUMN IF NOT EXISTS scraped_content JSONB;

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_scraped_content 
ON public.analyzed_emails USING GIN(scraped_content) 
WHERE scraped_content IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.analyzed_emails.scraped_content IS 
'Stores scraped markdown content from URLs, keyed by URL. Structure: { "url": { "markdown": "...", "title": "...", "scraped_at": "..." } }';

