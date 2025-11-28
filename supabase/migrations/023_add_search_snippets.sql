-- ============================================
-- Migration: Add Search Snippets with Highlights
-- ============================================
-- Uses ts_headline() to generate snippets with matched terms highlighted
-- Returns context around the matched keywords for better UX
-- ============================================

-- ============================================
-- STEP 1: Update hybrid_search_knowledge_base to include snippets
-- ============================================
DROP FUNCTION IF EXISTS public.hybrid_search_knowledge_base(vector(1536), text, uuid, uuid[], double precision, integer, double precision, double precision, integer);

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
    snippet TEXT,  -- NEW: Highlighted snippet
    similarity FLOAT,
    chunk_index INTEGER,
    context_tags TEXT[],
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_query tsquery;
BEGIN
    -- Convert query text to tsquery using simple config (language-agnostic)
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
        -- Generate highlighted snippet using ts_headline
        -- Falls back to first 200 chars if no full-text match
        CASE 
            WHEN c.fts @@ search_query THEN
                ts_headline('simple', c.content, search_query, 
                    'StartSel=****, StopSel=****, MaxWords=60, MinWords=30, HighlightAll=false')
            ELSE
                LEFT(c.content, 200) || '...'
        END AS snippet,
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
'True hybrid search with snippets. Combines full-text and semantic search using RRF. Returns highlighted snippets showing matched terms.';

-- ============================================
-- STEP 2: Update search_analyzed_emails to include snippets
-- ============================================
DROP FUNCTION IF EXISTS public.search_analyzed_emails(vector(1536), uuid, double precision, integer, text, double precision, double precision, integer);

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
    snippet TEXT,  -- NEW: Highlighted snippet
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
        -- Generate highlighted snippet
        CASE 
            WHEN search_query IS NOT NULL AND emb.fts @@ search_query THEN
                ts_headline('simple', emb.embedded_text, search_query, 
                    'StartSel=****, StopSel=****, MaxWords=60, MinWords=30, HighlightAll=false')
            ELSE
                LEFT(emb.embedded_text, 200) || '...'
        END AS snippet,
        comb.match_type_val AS match_type
    FROM combined comb
    JOIN public.analyzed_email_embeddings emb ON comb.id = emb.id
    JOIN public.analyzed_emails ae ON emb.analyzed_email_id = ae.id
    ORDER BY comb.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_analyzed_emails(vector(1536), uuid, double precision, integer, text, double precision, double precision, integer) IS 
'Hybrid search for analyzed emails with snippets. Returns highlighted snippets showing matched terms.';

