-- Add 'intelligent_discovery' strategy to agent_configurations
-- This strategy intelligently discovers alternative public URLs when original is inaccessible

-- Drop existing constraint
ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_content_retrieval_strategy_check;

-- Add new constraint with intelligent_discovery option
ALTER TABLE public.agent_configurations
ADD CONSTRAINT agent_configurations_content_retrieval_strategy_check 
CHECK (content_retrieval_strategy IN ('scrape_only', 'scrape_and_search', 'search_only', 'intelligent_discovery'));

-- Update column comment to include new strategy
COMMENT ON COLUMN public.agent_configurations.content_retrieval_strategy IS 
'Strategy for retrieving link content: scrape_only (Firecrawl only), scrape_and_search (both Firecrawl + web search), search_only (web search snippets only), intelligent_discovery (AI-driven discovery of alternative public URLs via web search + scraping)';

