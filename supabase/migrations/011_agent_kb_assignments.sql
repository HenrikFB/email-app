-- ============================================
-- Agent Knowledge Base Assignments
-- ============================================
-- This migration documents the KB assignment system
-- The actual table was created in migration 010

-- The agent_kb_assignments junction table (created in 010) enables:
-- 1. Many-to-many relationship between agent_configurations and knowledge_bases
-- 2. Each agent config can be assigned multiple KBs for RAG context
-- 3. Each KB can be used by multiple agent configs

-- No additional schema changes needed - using the junction table pattern

-- Verify the junction table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_kb_assignments'
    ) THEN
        RAISE EXCEPTION 'agent_kb_assignments table not found. Run migration 010 first.';
    END IF;
END $$;

-- Add helpful comment
COMMENT ON TABLE public.agent_kb_assignments IS 
'Junction table: Assigns knowledge bases to agent configurations for RAG-enhanced email analysis. When an agent config analyzes an email, it will search assigned KBs for relevant context examples.';

