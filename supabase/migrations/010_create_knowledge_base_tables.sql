-- ============================================
-- Knowledge Base System with pgvector embeddings
-- ============================================

-- ============================================
-- TABLE 1: Knowledge Bases (Collections)
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Metadata
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('manual', 'saved_emails', 'saved_scraped_urls')),
    
    -- For RAG prompts and optimization
    optimization_context TEXT,
    
    -- Flag for auto-created KBs (e.g., when saving from results)
    is_dynamic BOOLEAN DEFAULT false,
    
    -- Stats
    document_count INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for knowledge_bases
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own knowledge bases"
ON public.knowledge_bases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge bases"
ON public.knowledge_bases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge bases"
ON public.knowledge_bases FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge bases"
ON public.knowledge_bases FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_knowledge_bases_user_id ON public.knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_type ON public.knowledge_bases(type);

-- Comments
COMMENT ON TABLE public.knowledge_bases IS 'Collections of documents for semantic search and RAG';
COMMENT ON COLUMN public.knowledge_bases.type IS 'manual: user-created, saved_emails: auto-created from saved results, saved_scraped_urls: auto-created from saved URLs';
COMMENT ON COLUMN public.knowledge_bases.optimization_context IS 'Context used in RAG prompts to guide AI extraction';

-- ============================================
-- TABLE 2: KB Documents (Text notes, saved emails, saved URLs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    
    -- Document metadata
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text_note', 'saved_email', 'saved_url')),
    
    -- Content (for text notes or extracted content)
    content TEXT NOT NULL,
    
    -- References for saved emails/URLs
    analyzed_email_id UUID REFERENCES public.analyzed_emails(id) ON DELETE SET NULL,
    source_url TEXT,  -- For saved URLs
    
    -- Rich metadata fields (all optional)
    notes TEXT,  -- User's free-form notes
    optimization_hints TEXT,  -- Tips for better extraction
    extraction_guidelines TEXT,  -- How to extract from this type
    context_tags TEXT[],  -- Tags for filtering/categorization
    
    -- Stats
    chunk_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for kb_documents
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
ON public.kb_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
ON public.kb_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON public.kb_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON public.kb_documents FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_kb_documents_user_id ON public.kb_documents(user_id);
CREATE INDEX idx_kb_documents_kb_id ON public.kb_documents(knowledge_base_id);
CREATE INDEX idx_kb_documents_type ON public.kb_documents(type);
CREATE INDEX idx_kb_documents_analyzed_email_id ON public.kb_documents(analyzed_email_id) WHERE analyzed_email_id IS NOT NULL;
CREATE INDEX idx_kb_documents_tags ON public.kb_documents USING GIN(context_tags);

-- Comments
COMMENT ON TABLE public.kb_documents IS 'Documents within knowledge bases - text notes, saved emails, or saved scraped URLs';
COMMENT ON COLUMN public.kb_documents.optimization_hints IS 'User hints for optimizing extraction from similar documents';
COMMENT ON COLUMN public.kb_documents.extraction_guidelines IS 'Guidelines for extracting data from this type of document';

-- ============================================
-- TABLE 3: KB Chunks (Embeddings for semantic search)
-- ============================================
CREATE TABLE IF NOT EXISTS public.kb_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
    
    -- Chunk content
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,  -- Position in document (0, 1, 2, ...)
    char_count INTEGER NOT NULL,
    
    -- Embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for kb_chunks
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chunks"
ON public.kb_chunks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chunks"
ON public.kb_chunks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks"
ON public.kb_chunks FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for semantic search
CREATE INDEX idx_kb_chunks_user_id ON public.kb_chunks(user_id);
CREATE INDEX idx_kb_chunks_kb_id ON public.kb_chunks(knowledge_base_id);
CREATE INDEX idx_kb_chunks_document_id ON public.kb_chunks(document_id);

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
-- Using cosine distance for similarity
CREATE INDEX idx_kb_chunks_embedding ON public.kb_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Comments
COMMENT ON TABLE public.kb_chunks IS 'Text chunks with embeddings for semantic search';
COMMENT ON COLUMN public.kb_chunks.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';

-- ============================================
-- TABLE 4: Analyzed Email Embeddings (for saved emails)
-- ============================================
CREATE TABLE IF NOT EXISTS public.analyzed_email_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyzed_email_id UUID NOT NULL REFERENCES public.analyzed_emails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- What this embedding represents
    content_type TEXT NOT NULL CHECK (content_type IN ('extracted_data', 'scraped_url')),
    
    -- For scraped_url type
    source_url TEXT,
    source_index INTEGER,  -- Position in data_by_source array
    
    -- The content that was embedded
    embedded_text TEXT NOT NULL,
    
    -- Embedding
    embedding vector(1536),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.analyzed_email_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email embeddings"
ON public.analyzed_email_embeddings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email embeddings"
ON public.analyzed_email_embeddings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email embeddings"
ON public.analyzed_email_embeddings FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_email_embeddings_analyzed_email_id 
ON public.analyzed_email_embeddings(analyzed_email_id);

CREATE INDEX idx_email_embeddings_user_id 
ON public.analyzed_email_embeddings(user_id);

CREATE INDEX idx_email_embeddings_content_type 
ON public.analyzed_email_embeddings(content_type);

-- Vector similarity index
CREATE INDEX idx_email_embeddings_embedding 
ON public.analyzed_email_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Comments
COMMENT ON TABLE public.analyzed_email_embeddings IS 'Embeddings for saved analyzed emails and scraped URLs';

-- ============================================
-- TABLE 5: Agent KB Assignments (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_kb_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_configuration_id UUID NOT NULL REFERENCES public.agent_configurations(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Unique constraint: one assignment per agent-KB pair
    UNIQUE(agent_configuration_id, knowledge_base_id)
);

-- RLS
ALTER TABLE public.agent_kb_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agent KB assignments"
ON public.agent_kb_assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.agent_configurations
        WHERE id = agent_configuration_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create their agent KB assignments"
ON public.agent_kb_assignments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.agent_configurations
        WHERE id = agent_configuration_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their agent KB assignments"
ON public.agent_kb_assignments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.agent_configurations
        WHERE id = agent_configuration_id AND user_id = auth.uid()
    )
);

-- Indexes
CREATE INDEX idx_agent_kb_assignments_agent_id 
ON public.agent_kb_assignments(agent_configuration_id);

CREATE INDEX idx_agent_kb_assignments_kb_id 
ON public.agent_kb_assignments(knowledge_base_id);

-- Comments
COMMENT ON TABLE public.agent_kb_assignments IS 'Many-to-many relationship between agent configurations and knowledge bases';

-- ============================================
-- FUNCTION: Hybrid Search Knowledge Base
-- ============================================
CREATE OR REPLACE FUNCTION public.hybrid_search_knowledge_base(
    query_embedding vector(1536),
    query_text TEXT,
    search_user_id UUID,
    kb_ids UUID[] DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
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
    context_tags TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        d.type AS document_type,
        c.knowledge_base_id,
        kb.name AS kb_name,
        kb.type AS kb_type,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.chunk_index,
        d.context_tags
    FROM public.kb_chunks c
    JOIN public.kb_documents d ON c.document_id = d.id
    JOIN public.knowledge_bases kb ON c.knowledge_base_id = kb.id
    WHERE c.user_id = search_user_id
        AND (kb_ids IS NULL OR c.knowledge_base_id = ANY(kb_ids))
        AND (1 - (c.embedding <=> query_embedding)) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_knowledge_base IS 'Semantic search across knowledge base chunks using vector similarity';

-- ============================================
-- FUNCTION: Search Analyzed Emails
-- ============================================
CREATE OR REPLACE FUNCTION public.search_analyzed_emails(
    query_embedding vector(1536),
    search_user_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
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
    embedded_text TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.id AS email_id,
        ae.email_subject,
        ae.email_from,
        ae.matched,
        ae.extracted_data,
        ae.data_by_source,
        1 - (emb.embedding <=> query_embedding) AS similarity,
        emb.content_type,
        emb.source_url,
        emb.embedded_text
    FROM public.analyzed_email_embeddings emb
    JOIN public.analyzed_emails ae ON emb.analyzed_email_id = ae.id
    WHERE emb.user_id = search_user_id
        AND (1 - (emb.embedding <=> query_embedding)) > match_threshold
    ORDER BY emb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_analyzed_emails IS 'Semantic search across saved analyzed emails using vector similarity';

-- ============================================
-- TRIGGER: Update knowledge_bases.updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_knowledge_bases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_knowledge_bases_updated_at
    BEFORE UPDATE ON public.knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_knowledge_bases_updated_at();

-- ============================================
-- TRIGGER: Update document count in knowledge_bases
-- ============================================
CREATE OR REPLACE FUNCTION public.update_kb_document_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.knowledge_bases
        SET document_count = document_count + 1
        WHERE id = NEW.knowledge_base_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.knowledge_bases
        SET document_count = GREATEST(document_count - 1, 0)
        WHERE id = OLD.knowledge_base_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kb_document_count_on_insert
    AFTER INSERT ON public.kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_kb_document_count();

CREATE TRIGGER update_kb_document_count_on_delete
    AFTER DELETE ON public.kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_kb_document_count();

-- ============================================
-- TRIGGER: Update chunk count in knowledge_bases
-- ============================================
CREATE OR REPLACE FUNCTION public.update_kb_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.knowledge_bases
        SET total_chunks = total_chunks + 1
        WHERE id = NEW.knowledge_base_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.knowledge_bases
        SET total_chunks = GREATEST(total_chunks - 1, 0)
        WHERE id = OLD.knowledge_base_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kb_chunk_count_on_insert
    AFTER INSERT ON public.kb_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_kb_chunk_count();

CREATE TRIGGER update_kb_chunk_count_on_delete
    AFTER DELETE ON public.kb_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_kb_chunk_count();

