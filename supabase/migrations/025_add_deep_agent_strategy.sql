-- Migration: Add Deep Agent Strategy
-- Description: Adds 'deep_agent' content retrieval strategy and draft generation support

-- ============================================
-- 1. Update content_retrieval_strategy constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE public.agent_configurations
DROP CONSTRAINT IF EXISTS agent_configurations_content_retrieval_strategy_check;

-- Add updated constraint with deep_agent option
ALTER TABLE public.agent_configurations
ADD CONSTRAINT agent_configurations_content_retrieval_strategy_check
CHECK (content_retrieval_strategy = ANY (ARRAY[
  'scrape_only'::text,
  'scrape_and_search'::text,
  'search_only'::text,
  'intelligent_discovery'::text,
  'deep_agent'::text
]));

COMMENT ON COLUMN public.agent_configurations.content_retrieval_strategy IS
  'Content retrieval strategy: scrape_only, scrape_and_search, search_only, intelligent_discovery, deep_agent';

-- ============================================
-- 2. Add draft generation fields to agent_configurations
-- ============================================

-- Enable/disable draft generation
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS draft_generation_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.agent_configurations.draft_generation_enabled IS
  'Enable automatic draft generation (cover letters, summaries, etc.) when using deep_agent strategy';

-- Free-form instructions for draft generation
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS draft_instructions TEXT;

COMMENT ON COLUMN public.agent_configurations.draft_instructions IS
  'Free-form AI instructions describing what to draft, the format, tone, and any specific requirements';

-- ============================================
-- 3. Create generated_drafts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.generated_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analyzed_email_id UUID,
  agent_configuration_id UUID,
  
  -- Draft content
  draft_content TEXT NOT NULL,
  
  -- Sources used from knowledge base
  kb_sources_used JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata about the generation process
  generation_metadata JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "reasoning": "Generated based on 3 KB documents matching .NET experience",
  --   "iterations": 2,
  --   "search_queries": [".NET developer experience", "Azure cloud projects"],
  --   "confidence": 0.85,
  --   "model_used": "gpt-4o",
  --   "processing_time_ms": 5230,
  --   "web_sources_searched": ["company-website.com/careers"]
  -- }
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Constraints
  CONSTRAINT generated_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT generated_drafts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT generated_drafts_analyzed_email_id_fkey 
    FOREIGN KEY (analyzed_email_id) REFERENCES public.analyzed_emails(id) ON DELETE SET NULL,
  CONSTRAINT generated_drafts_agent_configuration_id_fkey 
    FOREIGN KEY (agent_configuration_id) REFERENCES public.agent_configurations(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_generated_drafts_user_id 
  ON public.generated_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_generated_drafts_analyzed_email_id 
  ON public.generated_drafts(analyzed_email_id);

CREATE INDEX IF NOT EXISTS idx_generated_drafts_agent_config_id 
  ON public.generated_drafts(agent_configuration_id);

CREATE INDEX IF NOT EXISTS idx_generated_drafts_created_at 
  ON public.generated_drafts(created_at DESC);

-- Enable RLS
ALTER TABLE public.generated_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own drafts"
  ON public.generated_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
  ON public.generated_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.generated_drafts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.generated_drafts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_generated_drafts_updated_at
  BEFORE UPDATE ON public.generated_drafts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- 4. Add index for deep_agent strategy lookups
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_configs_deep_agent
  ON public.agent_configurations(content_retrieval_strategy)
  WHERE content_retrieval_strategy = 'deep_agent';

