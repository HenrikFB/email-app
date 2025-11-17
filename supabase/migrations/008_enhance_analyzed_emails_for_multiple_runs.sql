-- Allow multiple analysis runs for same email + config
-- Remove unique constraint and add data_by_source column

-- Drop existing unique constraint
ALTER TABLE public.analyzed_emails 
DROP CONSTRAINT IF EXISTS analyzed_emails_user_id_email_message_id_agent_configuration_i_key;

-- Add data_by_source column (JSONB array)
ALTER TABLE public.analyzed_emails 
ADD COLUMN IF NOT EXISTS data_by_source JSONB;

-- Create new index for querying (without unique constraint)
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_lookup 
ON public.analyzed_emails(user_id, email_message_id, agent_configuration_id, analyzed_at DESC);

-- Comment
COMMENT ON COLUMN public.analyzed_emails.data_by_source IS 
  'Array of extracted data grouped by source (email + each scraped URL). Format: [{source: string, data: object, reasoning: string, confidence: number}]';

