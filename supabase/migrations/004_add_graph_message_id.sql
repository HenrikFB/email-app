-- Add column for Microsoft Graph Message ID
-- We need both the Internet Message ID (for deduplication) and the Graph ID (for fetching)

ALTER TABLE public.analyzed_emails 
  ADD COLUMN IF NOT EXISTS graph_message_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_graph_id 
  ON public.analyzed_emails(graph_message_id);

-- Add comment
COMMENT ON COLUMN public.analyzed_emails.graph_message_id IS 
  'Microsoft Graph message ID used for fetching email content (different from email_message_id which is the Internet Message ID)';

