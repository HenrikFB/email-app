-- ============================================
-- Add Unique Name to Agent Configurations
-- ============================================
-- Allows users to give agent configs user-friendly names for better UI selection
-- Name must be unique per user

-- Add name column to agent_configurations
ALTER TABLE public.agent_configurations
ADD COLUMN IF NOT EXISTS name TEXT;

-- Set default name from email_address for existing records
UPDATE public.agent_configurations
SET name = email_address
WHERE name IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE public.agent_configurations
ALTER COLUMN name SET NOT NULL;

-- Add unique constraint per user (user_id + name must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_configurations_user_name 
ON public.agent_configurations(user_id, name);

-- Comment
COMMENT ON COLUMN public.agent_configurations.name IS 
'User-friendly name for agent configuration (unique per user). Used for UI selection instead of email_address.';

