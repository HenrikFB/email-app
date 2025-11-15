-- Add button_text_pattern to agent_configurations
-- Used as a boost signal for AI link ranking, not a hard filter

ALTER TABLE public.agent_configurations
ADD COLUMN button_text_pattern TEXT;

COMMENT ON COLUMN public.agent_configurations.button_text_pattern IS 
  'Optional regex pattern to boost link ranking (e.g., "Se jobbet|Apply|View Job"). Used as ranking signal, not filter.';

