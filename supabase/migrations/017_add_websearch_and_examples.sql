-- Add web search and user feedback fields to agent_configurations

-- Content retrieval strategy: How to get content from links
-- 'scrape_only': Use Firecrawl only (default, for public URLs)
-- 'scrape_and_search': Try Firecrawl + web search (most thorough, higher cost)
-- 'search_only': Skip Firecrawl, use web search to find alternative public URLs (for auth-required content like LinkedIn)
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS content_retrieval_strategy TEXT DEFAULT 'scrape_only'
  CHECK (content_retrieval_strategy IN ('scrape_only', 'scrape_and_search', 'search_only'));

-- User-provided extraction examples (JSON or natural language)
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS extraction_examples TEXT;

-- User feedback/notes about what works/fails
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS analysis_feedback TEXT;

-- Add comments
COMMENT ON COLUMN public.agent_configurations.content_retrieval_strategy IS 
'Strategy for retrieving link content: scrape_only (Firecrawl only), scrape_and_search (both Firecrawl + web search), search_only (find alternative public URLs via web search, for auth-required content like LinkedIn)';

COMMENT ON COLUMN public.agent_configurations.extraction_examples IS 
'User-provided examples for extraction (JSON or natural language). Helps AI understand expected format and values.';

COMMENT ON COLUMN public.agent_configurations.analysis_feedback IS 
'User feedback/notes about what works or fails for this configuration. Helps improve accuracy over time.';

