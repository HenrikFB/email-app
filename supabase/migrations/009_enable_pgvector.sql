-- Enable pgvector extension for semantic search
-- This extension adds support for vector similarity search in PostgreSQL

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is enabled
COMMENT ON EXTENSION vector IS 'Vector similarity search for PostgreSQL';

