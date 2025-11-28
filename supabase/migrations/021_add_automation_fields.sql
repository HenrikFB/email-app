-- ============================================
-- Migration: Add Automation Fields
-- Date: 2025-11-27
-- Description: 
--   - Add auto-search KB on match fields to agent_configurations
--   - Add KB search results storage to analyzed_emails
-- ============================================

-- ============================================
-- PART 1: Agent Configuration Automation Fields
-- ============================================

-- Enable auto KB search when email matches
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_kb_on_match BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.agent_configurations.auto_search_kb_on_match IS 
'When true, automatically search assigned KBs when an email matches';

-- KB to auto-save matching emails to
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_save_matches_to_kb_id UUID REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agent_configurations.auto_save_matches_to_kb_id IS 
'Optional: KB to automatically save matched emails to';

-- Confidence threshold for auto-save
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_save_confidence_threshold NUMERIC DEFAULT 0.8 
CHECK (auto_save_confidence_threshold >= 0 AND auto_save_confidence_threshold <= 1);

COMMENT ON COLUMN public.agent_configurations.auto_save_confidence_threshold IS 
'Minimum confidence (0-1) required to auto-save matched emails';

-- Custom query template for auto KB search
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_query_template TEXT;

COMMENT ON COLUMN public.agent_configurations.auto_search_query_template IS 
'Optional template for generating KB search queries. Uses {{field}} placeholders from extracted_data';

-- ============================================
-- PART 2: Analyzed Emails KB Search Results
-- ============================================

-- Store KB search results when auto-search is performed
ALTER TABLE public.analyzed_emails
ADD COLUMN IF NOT EXISTS kb_search_results JSONB;

COMMENT ON COLUMN public.analyzed_emails.kb_search_results IS 
'Stores KB search results from auto-search on match. Contains array of matches with similarity scores';

-- Track when KB search was performed
ALTER TABLE public.analyzed_emails
ADD COLUMN IF NOT EXISTS kb_search_performed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.analyzed_emails.kb_search_performed_at IS 
'Timestamp when KB search was automatically performed';

-- Track if email was auto-saved to KB
ALTER TABLE public.analyzed_emails
ADD COLUMN IF NOT EXISTS auto_saved_to_kb_id UUID REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.analyzed_emails.auto_saved_to_kb_id IS 
'KB ID if this email was automatically saved based on match + confidence';

-- ============================================
-- PART 3: Indexes
-- ============================================

-- Index for finding agent configs with auto-search enabled
CREATE INDEX IF NOT EXISTS idx_agent_configs_auto_search 
ON public.agent_configurations(auto_search_kb_on_match) 
WHERE auto_search_kb_on_match = true;

-- Index for finding emails with KB search results
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_kb_search 
ON public.analyzed_emails(kb_search_performed_at) 
WHERE kb_search_performed_at IS NOT NULL;

-- Index for finding auto-saved emails
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_auto_saved 
ON public.analyzed_emails(auto_saved_to_kb_id) 
WHERE auto_saved_to_kb_id IS NOT NULL;

