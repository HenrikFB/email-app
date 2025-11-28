-- ============================================
-- Migration: Add Multi-Intent Search Support
-- ============================================
-- Adds columns to support intelligent multi-intent search
-- when automatically searching KBs on email match.
-- ============================================

-- Add search mode column
-- - 'single': One combined query (current/default behavior)
-- - 'multi_intent': Split array fields into separate searches
-- - 'ai_powered': Use LLM to generate optimal queries
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_mode TEXT DEFAULT 'single';

-- Add constraint for valid modes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agent_configurations_auto_search_mode_check'
  ) THEN
    ALTER TABLE public.agent_configurations
    ADD CONSTRAINT agent_configurations_auto_search_mode_check
    CHECK (auto_search_mode IN ('single', 'multi_intent', 'ai_powered'));
  END IF;
END $$;

-- Add instructions field for AI-powered search
-- This guides the LLM on how to generate queries
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_instructions TEXT;

-- Add field for specifying which extracted fields to use for multi-intent
-- JSON array like ["technologies", "skills", "location"]
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_split_fields TEXT[];

-- Add field for maximum number of parallel searches
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS auto_search_max_queries INTEGER DEFAULT 5;

-- Add constraint for max queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agent_configurations_auto_search_max_queries_check'
  ) THEN
    ALTER TABLE public.agent_configurations
    ADD CONSTRAINT agent_configurations_auto_search_max_queries_check
    CHECK (auto_search_max_queries >= 1 AND auto_search_max_queries <= 20);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.agent_configurations.auto_search_mode IS 
  'Search mode: single (one query), multi_intent (split by fields), ai_powered (LLM generates queries)';

COMMENT ON COLUMN public.agent_configurations.auto_search_instructions IS 
  'Instructions for AI when generating search queries in ai_powered mode';

COMMENT ON COLUMN public.agent_configurations.auto_search_split_fields IS 
  'Array of field names to split for multi_intent mode, e.g., {technologies, skills}';

COMMENT ON COLUMN public.agent_configurations.auto_search_max_queries IS 
  'Maximum number of parallel search queries to run (1-20)';

-- Create index for configurations with multi-intent enabled
CREATE INDEX IF NOT EXISTS idx_agent_configs_search_mode 
ON public.agent_configurations (auto_search_mode)
WHERE auto_search_kb_on_match = true;

