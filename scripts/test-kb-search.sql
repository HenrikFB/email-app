-- Test 1: Direct text search (should find .NET)
SELECT 
  c.id,
  d.title as document_title,
  LEFT(c.content, 100) as content_preview,
  c.char_count
FROM kb_chunks c
JOIN kb_documents d ON c.document_id = d.id
WHERE c.content ILIKE '%.NET%'
LIMIT 5;

-- Test 2: Check if embeddings exist and their dimensions
SELECT 
  c.id,
  d.title,
  CASE WHEN c.embedding IS NULL THEN 'NO EMBEDDING' ELSE 'HAS EMBEDDING' END as embedding_status,
  array_length(c.embedding::real[], 1) as embedding_dimensions
FROM kb_chunks c
JOIN kb_documents d ON c.document_id = d.id
LIMIT 5;
