-- ============================================
-- Migration: Implement True Hybrid Search
-- ============================================
-- Combines full-text search (keyword) with semantic search (vector)
-- using Reciprocal Rank Fusion (RRF) for proper result ranking.
-- 
-- Uses 'simple' text search config for multilingual support (English + Danish)
-- ============================================

-- ============================================
-- STEP 0: Drop old function versions to avoid signature conflicts
-- ============================================
-- Drop old hybrid_search_knowledge_base (original 6-parameter version)
DROP FUNCTION IF EXISTS public.hybrid_search_knowledge_base(vector(1536), text, uuid, uuid[], double precision, integer);
DROP FUNCTION IF EXISTS public.hybrid_search_knowledge_base(vector(1536), text, uuid, uuid[], float, integer);

-- Drop old search_analyzed_emails (original 4-parameter version)  
DROP FUNCTION IF EXISTS public.search_analyzed_emails(vector(1536), uuid, double precision, integer);
DROP FUNCTION IF EXISTS public.search_analyzed_emails(vector(1536), uuid, float, integer);

-- ============================================
-- STEP 1: Add full-text search column to kb_chunks
-- ============================================
-- Using 'simple' config for language-agnostic search (works with English, Danish, etc.)
ALTER TABLE public.kb_chunks 
ADD COLUMN IF NOT EXISTS fts tsvector 
GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_kb_chunks_fts 
ON public.kb_chunks USING gin(fts);

-- ============================================
-- STEP 2: Add full-text search column to analyzed_email_embeddings
-- ============================================
ALTER TABLE public.analyzed_email_embeddings 
ADD COLUMN IF NOT EXISTS fts tsvector 
GENERATED ALWAYS AS (to_tsvector('simple', embedded_text)) STORED;

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_analyzed_email_embeddings_fts 
ON public.analyzed_email_embeddings USING gin(fts);

-- ============================================
-- STEP 3: Update hybrid_search_knowledge_base function
-- ============================================
-- Now implements TRUE hybrid search with RRF
CREATE OR REPLACE FUNCTION public.hybrid_search_knowledge_base(
    query_embedding vector(1536),
    query_text TEXT,
    search_user_id UUID,
    kb_ids UUID[] DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10,
    full_text_weight FLOAT DEFAULT 1.0,
    semantic_weight FLOAT DEFAULT 1.0,
    rrf_k INT DEFAULT 50
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    document_title TEXT,
    document_type TEXT,
    knowledge_base_id UUID,
    kb_name TEXT,
    kb_type TEXT,
    content TEXT,
    similarity FLOAT,
    chunk_index INTEGER,
    context_tags TEXT[],
    match_type TEXT  -- 'semantic', 'fulltext', or 'hybrid'
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_query tsquery;
BEGIN
    -- Convert query text to tsquery using simple config (language-agnostic)
    -- plainto_tsquery handles special characters better than websearch_to_tsquery
    search_query := plainto_tsquery('simple', query_text);
    
    RETURN QUERY
    WITH 
    -- Full-text search results with ranking
    full_text AS (
        SELECT
            c.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.fts, search_query) DESC) AS rank_ix
        FROM public.kb_chunks c
        WHERE c.user_id = search_user_id
            AND (kb_ids IS NULL OR c.knowledge_base_id = ANY(kb_ids))
            AND c.fts @@ search_query
        ORDER BY ts_rank_cd(c.fts, search_query) DESC
        LIMIT LEAST(match_count, 30) * 2
    ),
    -- Semantic search results with ranking
    semantic AS (
        SELECT
            c.id,
            1 - (c.embedding <=> query_embedding) AS semantic_similarity,
            ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank_ix
        FROM public.kb_chunks c
        WHERE c.user_id = search_user_id
            AND (kb_ids IS NULL OR c.knowledge_base_id = ANY(kb_ids))
            AND c.embedding IS NOT NULL
            AND (1 - (c.embedding <=> query_embedding)) > match_threshold
        ORDER BY c.embedding <=> query_embedding
        LIMIT LEAST(match_count, 30) * 2
    ),
    -- Combine using Reciprocal Rank Fusion (RRF)
    combined AS (
        SELECT
            COALESCE(ft.id, sem.id) AS id,
            COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight AS ft_score,
            COALESCE(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight AS sem_score,
            COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
            COALESCE(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight AS combined_score,
            sem.semantic_similarity,
            CASE 
                WHEN ft.id IS NOT NULL AND sem.id IS NOT NULL THEN 'hybrid'
                WHEN ft.id IS NOT NULL THEN 'fulltext'
                ELSE 'semantic'
            END AS match_type_val
        FROM full_text ft
        FULL OUTER JOIN semantic sem ON ft.id = sem.id
    )
    SELECT 
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        d.type AS document_type,
        c.knowledge_base_id,
        kb.name AS kb_name,
        kb.type AS kb_type,
        c.content,
        -- Use semantic similarity if available, otherwise estimate from RRF score
        COALESCE(comb.semantic_similarity, comb.combined_score * 2)::FLOAT AS similarity,
        c.chunk_index,
        d.context_tags,
        comb.match_type_val AS match_type
    FROM combined comb
    JOIN public.kb_chunks c ON comb.id = c.id
    JOIN public.kb_documents d ON c.document_id = d.id
    JOIN public.knowledge_bases kb ON c.knowledge_base_id = kb.id
    ORDER BY comb.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_knowledge_base(vector(1536), text, uuid, uuid[], double precision, integer, double precision, double precision, integer) IS 
'True hybrid search combining full-text (keyword) and semantic (vector) search using Reciprocal Rank Fusion. Supports multilingual content (English, Danish, etc.) via simple text search config.';

-- ============================================
-- STEP 4: Update search_analyzed_emails function
-- ============================================
CREATE OR REPLACE FUNCTION public.search_analyzed_emails(
    query_embedding vector(1536),
    search_user_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10,
    query_text TEXT DEFAULT NULL,
    full_text_weight FLOAT DEFAULT 1.0,
    semantic_weight FLOAT DEFAULT 1.0,
    rrf_k INT DEFAULT 50
)
RETURNS TABLE (
    email_id UUID,
    email_subject TEXT,
    email_from TEXT,
    matched BOOLEAN,
    extracted_data JSONB,
    data_by_source JSONB,
    similarity FLOAT,
    content_type TEXT,
    source_url TEXT,
    embedded_text TEXT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_query tsquery;
BEGIN
    -- Convert query text to tsquery if provided
    IF query_text IS NOT NULL AND query_text != '' THEN
        search_query := plainto_tsquery('simple', query_text);
    ELSE
        search_query := NULL;
    END IF;
    
    RETURN QUERY
    WITH 
    -- Full-text search results (only if query_text provided)
    full_text AS (
        SELECT
            emb.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(emb.fts, search_query) DESC) AS rank_ix
        FROM public.analyzed_email_embeddings emb
        WHERE emb.user_id = search_user_id
            AND search_query IS NOT NULL
            AND emb.fts @@ search_query
        ORDER BY ts_rank_cd(emb.fts, search_query) DESC
        LIMIT LEAST(match_count, 30) * 2
    ),
    -- Semantic search results
    semantic AS (
        SELECT
            emb.id,
            1 - (emb.embedding <=> query_embedding) AS semantic_similarity,
            ROW_NUMBER() OVER (ORDER BY emb.embedding <=> query_embedding) AS rank_ix
        FROM public.analyzed_email_embeddings emb
        WHERE emb.user_id = search_user_id
            AND emb.embedding IS NOT NULL
            AND (1 - (emb.embedding <=> query_embedding)) > match_threshold
        ORDER BY emb.embedding <=> query_embedding
        LIMIT LEAST(match_count, 30) * 2
    ),
    -- Combine using RRF
    combined AS (
        SELECT
            COALESCE(ft.id, sem.id) AS id,
            COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight AS ft_score,
            COALESCE(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight AS sem_score,
            COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
            COALESCE(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight AS combined_score,
            sem.semantic_similarity,
            CASE 
                WHEN ft.id IS NOT NULL AND sem.id IS NOT NULL THEN 'hybrid'
                WHEN ft.id IS NOT NULL THEN 'fulltext'
                ELSE 'semantic'
            END AS match_type_val
        FROM full_text ft
        FULL OUTER JOIN semantic sem ON ft.id = sem.id
    )
    SELECT 
        ae.id AS email_id,
        ae.email_subject,
        ae.email_from,
        ae.matched,
        ae.extracted_data,
        ae.data_by_source,
        COALESCE(comb.semantic_similarity, comb.combined_score * 2)::FLOAT AS similarity,
        emb.content_type,
        emb.source_url,
        emb.embedded_text,
        comb.match_type_val AS match_type
    FROM combined comb
    JOIN public.analyzed_email_embeddings emb ON comb.id = emb.id
    JOIN public.analyzed_emails ae ON emb.analyzed_email_id = ae.id
    ORDER BY comb.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_analyzed_emails(vector(1536), uuid, double precision, integer, text, double precision, double precision, integer) IS 
'Hybrid search for analyzed emails combining full-text and semantic search with RRF ranking. Supports multilingual content.';

-- ============================================
-- STEP 5: Create helper function for keyword-only search
-- ============================================
-- Useful when user explicitly wants exact matches
CREATE OR REPLACE FUNCTION public.keyword_search_knowledge_base(
    query_text TEXT,
    search_user_id UUID,
    kb_ids UUID[] DEFAULT NULL,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    document_title TEXT,
    document_type TEXT,
    knowledge_base_id UUID,
    kb_name TEXT,
    content TEXT,
    rank FLOAT,
    chunk_index INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_query tsquery;
BEGIN
    search_query := plainto_tsquery('simple', query_text);
    
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        d.type AS document_type,
        c.knowledge_base_id,
        kb.name AS kb_name,
        c.content,
        ts_rank_cd(c.fts, search_query)::FLOAT AS rank,
        c.chunk_index
    FROM public.kb_chunks c
    JOIN public.kb_documents d ON c.document_id = d.id
    JOIN public.knowledge_bases kb ON c.knowledge_base_id = kb.id
    WHERE c.user_id = search_user_id
        AND (kb_ids IS NULL OR c.knowledge_base_id = ANY(kb_ids))
        AND c.fts @@ search_query
    ORDER BY ts_rank_cd(c.fts, search_query) DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.keyword_search_knowledge_base IS 
'Pure keyword search for exact text matching. Useful for specific technology names, company names, etc.';

