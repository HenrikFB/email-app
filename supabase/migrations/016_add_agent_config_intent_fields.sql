-- Add optional intent fields to agent_configurations
-- These fields help the AI understand user's intent and improve link selection

-- Add user_intent field (why the user wants this data)
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS user_intent TEXT;

-- Add link_selection_guidance field (user feedback/examples for link selection)
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS link_selection_guidance TEXT;

-- Add max_links_to_scrape field (cost/speed control)
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS max_links_to_scrape INTEGER DEFAULT 10;

-- Add comments
COMMENT ON COLUMN public.agent_configurations.user_intent IS 
'Optional: User''s explanation of their goal (e.g., "I want to track .NET developer jobs in healthcare"). Helps AI understand the end goal for better reasoning.';

COMMENT ON COLUMN public.agent_configurations.link_selection_guidance IS 
'Optional: User feedback or examples to guide link selection (e.g., "Include generic job titles - specifics are inside"). Helps improve link prioritization accuracy.';

COMMENT ON COLUMN public.agent_configurations.max_links_to_scrape IS 
'Optional: Maximum number of links to scrape per email (default: 10). Controls cost and processing time. Set to NULL for no limit.';

