-- Split extraction_criteria into match_criteria and extraction_fields
-- This makes the system fully generic - users define what to match and what to extract separately

-- Rename extraction_criteria to match_criteria
ALTER TABLE public.agent_configurations 
  RENAME COLUMN extraction_criteria TO match_criteria;

-- Add new extraction_fields column
ALTER TABLE public.agent_configurations 
  ADD COLUMN extraction_fields TEXT;

-- Update the column comment for clarity
COMMENT ON COLUMN public.agent_configurations.match_criteria IS 
  'What the user is interested in - criteria to match/filter emails (e.g., "Software developer jobs with <5 years experience")';

COMMENT ON COLUMN public.agent_configurations.extraction_fields IS 
  'What to extract if the email matches - fields to extract (e.g., "deadline, technologies, competencies, experience level")';

