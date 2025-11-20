-- ============================================
-- Add KB Metadata for Agent Configuration Context
-- ============================================
-- Stores complete snapshot of agent configuration when KB documents are created
-- This preserves context even if agent configs are deleted or changed

-- Add metadata columns to kb_documents
ALTER TABLE public.kb_documents
ADD COLUMN IF NOT EXISTS source_agent_config_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS agent_config_snapshot JSONB;

-- Add index for querying by agent config
CREATE INDEX IF NOT EXISTS idx_kb_documents_agent_config_id 
ON public.kb_documents(source_agent_config_id) 
WHERE source_agent_config_id IS NOT NULL;

-- Add GIN index for JSONB queries on snapshot
CREATE INDEX IF NOT EXISTS idx_kb_documents_agent_config_snapshot 
ON public.kb_documents USING GIN(agent_config_snapshot) 
WHERE agent_config_snapshot IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.kb_documents.source_agent_config_id IS 
'Reference to agent configuration (nullable, for when config still exists)';

COMMENT ON COLUMN public.kb_documents.agent_config_snapshot IS 
'Complete snapshot of agent configuration at creation time: {name, email_address, match_criteria, extraction_fields, analyze_attachments, follow_links, button_text_pattern}';

