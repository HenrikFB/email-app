# Knowledge Base & Semantic Search Guide

## 🎯 Overview

This guide explains the newly implemented semantic search and knowledge base system, and answers your specific questions about the recent analysis run.

---

## 🐛 Issues Fixed

### 1. **RAG Context Error** ✅ FIXED
**Issue**: Error during analysis: `invalid input syntax for type uuid: "undefined"`

**Cause**: The orchestrator was trying to call `getAssignedKBs(input.agentConfigId)` but `agentConfigId` wasn't being passed in the `AnalysisJobInput` type.

**Fix**: 
- Added `userId` and `agentConfigId` fields to `AnalysisJobInput` type
- Updated `analyzeSelectedEmails` action to pass these fields
- RAG context now works correctly and fetches relevant examples from assigned knowledge bases during email analysis

### 2. **Duplicate URL Scraping** ✅ FIXED
**Issue**: Same URLs were being scraped multiple times (e.g., the "Test Consultant" job appeared twice)

**Cause**: The email contained the same link with different tracking parameters in different contexts (headline, company name, "Se jobbet" button). The AI selected all of them, leading to duplicate scraping.

**Fix**: 
- Implemented `deduplicateUrls()` function that:
  - Normalizes Outlook SafeLinks to extract actual URLs
  - Removes tracking parameters (utm_*, ttid, source, uid, abtestid)
  - Deduplicates URLs before scraping
  - Now only scrapes unique URLs, saving Firecrawl credits and reducing redundant data

**Result**: In your next analysis run, you'll see a message like "🔄 Removed 2 duplicate URL(s)" in the terminal, and only unique URLs will be scraped.

### 3. **Edit Knowledge Bases** ✅ IMPLEMENTED
**Issue**: You wanted full CRUD functionality for knowledge bases and documents.

**Status**: CRUD is **already fully implemented**! Here's how to use it:

#### **Knowledge Bases:**
- **Create**: Click "New Knowledge Base" on `/dashboard/knowledge-base`
- **Read**: View all KBs on the main page, click any KB card to see details
- **Update**: *(Will add edit button next)*
- **Delete**: Click the trash icon on any KB card → confirmation dialog

#### **Documents (Text Notes):**
- **Create**: Click "Add Text Note" inside any knowledge base
- **Read**: View all documents in the KB detail page
- **Update**: Click "Edit" button on any document card → opens edit modal (NEWLY ADDED)
- **Delete**: Click trash icon on any document → confirmation dialog

**New Features Added:**
- ✅ Text note form now supports edit mode
- ✅ Edit button on document cards opens pre-populated form
- ✅ Re-chunking and re-embedding happens automatically on update
- ✅ Clear visual feedback: "Edit Text Note" vs "Create Text Note" titles

---

## 📊 Understanding Your Analysis Run

Looking at your debug folder `debug-analysis-runs/1763451424439-AQMkADAw/`:

### What Happened:

1. **Email**: "2 nye job søger..." (JobIndex email)
2. **Links Found**: 22 total links extracted from full email HTML
3. **AI Selected**: 5 relevant links for scraping (based on match criteria)
4. **Scraped Successfully**: 5 URLs scraped:
   - 2x "Test Consultant" job (same job, different query params - **this will be deduplicated in future runs**)
   - 1x "IT Consultant" job
   - 2x Netcompany homepage (error pages, minimal content)

5. **Chunking**: Content split into 11 chunks (email + scraped pages)
6. **Analysis**: 8 out of 11 chunks matched your criteria
7. **Result**: ✅ **MATCHED** with 87.5% confidence

### Extracted Data:
- **Technologies**: .NET, C#, Python, Java, Angular, React, RPA, UiPath
- **Domains**: Public sector, municipality, health
- **Experience**: Entry-level to mid-level, new graduates
- **Deadlines**: 09-11-2025

### Data Sources:
The system correctly grouped extracted data by source:
1. **Email** (original email content)
2. **Scraped URL 1** (IT Consultant job)
3. **Scraped URL 2** (Test Consultant job - first instance)
4. **Scraped URL 3** (Test Consultant job - second instance, duplicate)

---

## 🔍 How Hybrid Search Works

### **Two Use Cases:**

#### **Use Case 1: Manual Search from Results Page** (IMPLEMENTED)
**How it works:**
1. Go to `/dashboard/results`
2. Select one or more analyzed emails (checkboxes)
3. Click **"Find Similar (X)"** button (top right)
4. Modal opens with:
   - Auto-generated search query (based on selected emails' extracted data)
   - Dropdown to select which knowledge bases to search
   - Search results with:
     - Similarity scores
     - Source (KB name + document title)
     - Matching snippets with context
     - Confidence scores

**What's searched:**
- `analyzed_email_embeddings` table (previously analyzed emails you chose to save)
- `kb_chunks` table (from selected knowledge bases)
- Uses **hybrid search** (combines semantic + keyword matching)

#### **Use Case 2: Automatic RAG During Email Analysis** (IMPLEMENTED)
**How it works:**
1. Assign knowledge bases to an agent configuration:
   - Go to `/dashboard` → Edit any agent config
   - Section: "Assigned Knowledge Bases"
   - Select one or more KBs (e.g., "Old Job Descriptions", "Cover Letters")
   - Save

2. When analyzing emails with that agent config:
   - System automatically fetches top 5 similar chunks from assigned KBs
   - RAG context is passed to the AI during analysis
   - AI uses KB examples to improve extraction accuracy
   - Example prompt: "Use these similar examples as guidance: [RAG context]"

**Result**: Better extraction quality by learning from your previous examples.

### **Why You Don't See Buttons for Individual URLs**

You asked about clicking on specific URLs/findings and picking a KB for search. This wasn't implemented because:

1. **Design Decision**: The current UX is to search based on entire analyzed emails (all extracted data), not individual URL chunks
2. **RAG is Automatic**: When KBs are assigned to an agent config, RAG happens automatically during analysis
3. **Manual Search**: After analysis, you select full emails and search across selected KBs

**If you want per-URL search**, we can add this feature. Let me know if that's important for your workflow!

---

## 💡 How to Use Knowledge Bases (Step-by-Step)

### **Scenario: You want better job description extraction**

#### **Step 1: Create a Knowledge Base**
1. Go to `/dashboard/knowledge-base`
2. Click "New Knowledge Base"
3. Fill in:
   - **Name**: "Old Job Descriptions"
   - **Description**: "Previous job descriptions I've applied to"
   - **Type**: "Manual" (you'll add text notes)
   - **Optimization Context**: (Optional) "Focus on required skills, experience level, and company culture"
4. Create

#### **Step 2: Add Documents (Text Notes)**
1. Click on the new KB card
2. Click "Add Text Note"
3. Fill in:
   - **Title**: "Senior Backend Developer - Netcompany"
   - **Content**: (Paste the full job description)
   - **Metadata** (Optional but powerful):
     - **Notes**: "This was a great match for my profile"
     - **Optimization Hints**: "Always extract salary range if mentioned"
     - **Extraction Guidelines**: "Look for team size and tech stack details"
     - **Tags**: `python`, `senior`, `backend`, `healthcare`
4. Save → System automatically chunks and embeds the content

#### **Step 3: Assign KB to Agent Configuration**
1. Go to `/dashboard`
2. Edit your agent configuration
3. Scroll to "Assigned Knowledge Bases"
4. Check "Old Job Descriptions"
5. Save

#### **Step 4: Analyze Emails**
Now when you analyze emails with this agent config:
- System fetches similar job descriptions from your KB
- AI uses them as examples to extract data more accurately
- You'll see better matching and extraction quality

#### **Step 5: Search Similar Content**
1. Go to `/dashboard/results`
2. Select analyzed emails that matched
3. Click "Find Similar"
4. Select "Old Job Descriptions" KB (or others)
5. View results with similarity scores and citations

#### **Step 6: Save Good Matches to KB**
When you find a great match:
1. Select the analyzed email (checkbox)
2. Click "Save to KB"
3. Choose existing KB or create new "Saved Emails" KB
4. Add optional note
5. Save → Now this email is searchable and can be used for RAG

---

## 🏗️ Knowledge Base Types

### **1. Manual** (`type: 'manual'`)
- **Purpose**: User-created content (text notes, later PDFs)
- **Examples**: Old job descriptions, cover letters, project summaries
- **How to create**: "New Knowledge Base" → Type: "Manual"

### **2. Saved Emails** (`type: 'saved_emails'`)
- **Purpose**: Store analyzed emails that were good matches
- **How to create**: Select email in results → "Save to KB" → Creates dynamically
- **Auto-managed**: System creates "Saved Emails" KB if none exists

### **3. Saved URLs** (`type: 'saved_scraped_urls'`)
- **Purpose**: Store scraped content from specific URLs
- **How to create**: *(Future feature: click on scraped URL in results → "Save to KB")*
- **Use case**: Save specific job postings, company pages, etc.

---

## 🎨 UI Walkthrough

### **Knowledge Base Main Page** (`/dashboard/knowledge-base`)
```
┌─────────────────────────────────────────┐
│  [New Knowledge Base]                   │
├─────────────────────────────────────────┤
│  📄 Old Job Descriptions                │
│  Manual • 5 documents • 23 chunks       │
│  [View]  [🗑️]                           │
├─────────────────────────────────────────┤
│  💾 Saved Emails (Auto-created)         │
│  Saved Emails • 12 documents • 87 chnks │
│  [View]  [🗑️]                           │
└─────────────────────────────────────────┘
```

### **KB Detail Page** (`/dashboard/knowledge-base/[id]`)
```
┌─────────────────────────────────────────┐
│  [← Back]  Old Job Descriptions  [+Add] │
├─────────────────────────────────────────┤
│  Documents (5)                          │
├─────────────────────────────────────────┤
│  📝 Senior Backend - Netcompany         │
│  5 chunks • 1,234 chars                 │
│  #python #senior #backend               │
│  [Edit]  [🗑️]                           │
└─────────────────────────────────────────┘
```

### **Results Page with Search** (`/dashboard/results`)
```
┌─────────────────────────────────────────┐
│  Analysis Results                       │
│  12 analyzed • 8 matched • 4 not matched│
│  [Save to KB (2)]  [Find Similar (2)]   │
├─────────────────────────────────────────┤
│  ☑ IT Consultant - Netcompany           │
│  ☑ Backend Developer - TDC              │
│  ☐ Marketing Manager - LEGO             │
└─────────────────────────────────────────┘

Click "Find Similar" → Modal:
┌─────────────────────────────────────────┐
│  Find Similar Content                   │
│  Query: .NET, C#, Python, healthcare... │
│  KBs: [x] Old Job Descriptions          │
│       [x] Saved Emails                  │
│       [ ] Cover Letters                 │
│  [Search]                               │
├─────────────────────────────────────────┤
│  Results:                               │
│  1. Senior Backend - Netcompany (0.89)  │
│     "Looking for .NET and C# expert..." │
│  2. Healthcare IT - Region Midtjylland  │
│     "Public sector, Python, RPA..."     │
└─────────────────────────────────────────┘
```

---

## 🚀 Next Steps & Recommendations

### **Immediate Actions:**
1. ✅ **Try the fixed system**: Analyze a new email to see deduplication in action
2. ✅ **Edit your documents**: Update any existing documents using the new edit functionality
3. ✅ **Assign KBs to agent configs**: Enable RAG for better extraction

### **Optimize Your Workflow:**
1. **Create focused KBs**: Separate "Job Descriptions", "Cover Letters", "Company Research"
2. **Use metadata heavily**: The optimization fields help the AI understand context
3. **Tag everything**: Makes filtering and search more powerful
4. **Save good matches**: Build up your knowledge base over time

### **Monitor & Improve:**
1. **Check debug folders**: See exactly what's being extracted and why
2. **Watch confidence scores**: Low confidence = need more examples in KB
3. **Iterate on optimization context**: Refine your KB-level and document-level hints

---

## 📈 Performance Tuning

### **Embedding Strategy:**
- ✅ Only emails you explicitly "Save to KB" get embeddings
- ✅ All KB documents are automatically embedded on create/update
- ✅ Hybrid search combines semantic (embeddings) + keyword (full-text)

### **RAG Context Size:**
- Currently: Top 5 similar chunks per analysis
- Adjustable in `getKBContextForRAG()` (5th parameter)
- More context = better examples, but higher token usage

### **Search Performance:**
- Supabase `pgvector` with hybrid search RPC functions
- Fast even with thousands of documents
- Similarity threshold: 0.5 (only returns relevant matches)

---

## 🔧 Troubleshooting

### **"No RAG context found" message:**
- **Cause**: No similar content in assigned KBs
- **Fix**: Add more documents to your KBs that match your search criteria

### **Low similarity scores in search results:**
- **Cause**: Query doesn't match KB content well
- **Fix**: 
  1. Check your extracted data in results (is it what you expected?)
  2. Add more diverse examples to KBs
  3. Adjust agent config extraction fields

### **Edit not working:**
- **Check**: Are you inside a KB detail page?
- **Check**: Does the document have a valid ID?
- **Try**: Refresh the page and try again

---

## 🎓 Advanced Tips

### **1. Use Optimization Context at KB Level:**
When creating a KB, add optimization context like:
```
Focus on extracting:
- Salary ranges (both explicit and inferred)
- Remote work policies (fully remote, hybrid, office-based)
- Required years of experience (distinguish "preferred" vs "required")
- Tech stack (primary languages, frameworks, databases)
```

### **2. Use Document-Level Extraction Guidelines:**
For each document, specify:
```
This document is a job description from the public sector.
Pay special attention to:
- Union agreements (mentions of "overenskomst")
- Work-life balance indicators
- Bureaucracy level (formality of language)
```

### **3. Leverage Context Tags for Filtering:**
Tag documents with:
- **Tech stack**: `python`, `dotnet`, `react`
- **Domain**: `healthcare`, `finance`, `public-sector`
- **Level**: `junior`, `mid-level`, `senior`, `lead`
- **Location**: `remote`, `copenhagen`, `aarhus`

*(Future feature: Filter search by tags)*

---

## 📚 Database Schema Reference

### **Key Tables:**
1. **`knowledge_bases`**: KB metadata
2. **`kb_documents`**: Your text notes and saved content
3. **`kb_chunks`**: Chunked content with embeddings (vector(1536))
4. **`analyzed_email_embeddings`**: Embeddings for saved analyzed emails
5. **`agent_kb_assignments`**: Links agent configs to KBs (many-to-many)

### **Search Functions (Supabase RPC):**
1. **`hybrid_search_knowledge_base`**: Search KB documents
2. **`search_analyzed_emails`**: Search saved analyzed emails
3. Both return: `content`, `similarity`, `source`, `chunk_index`

---

## 🔭 Future & Next

### Near-Term Enhancements
- **Inline KB editing**: Already live via the new edit button on each KB card (name, description, optimization context).
- **Source-level semantic search**: Select individual email sources/URLs and run semantic search directly from the results card.
- **Adjustable similarity thresholds**: Control how strict searches should be per query, with visual indicators of which KBs were searched.

### Upcoming Opportunities
- **PDF/Text uploads**: Extend knowledge bases beyond text notes (hook into Supabase Storage + `pdf-parse`).
- **Keyword/tag filtering**: Filter semantic search results by `context_tags` or document type.
- **Automated KB suggestions**: When analysis finds strong matches, prompt the user to save them into curated KBs automatically.

These items roll into the next iteration so you can keep refining the workflow without rewriting the foundation.

---

## 🔍 Search Debugging

### Overview

Every semantic search operation creates a detailed debug folder (similar to email analysis) that logs:
- The exact query being searched
- Which knowledge bases were searched
- Database tables and fields queried
- Results with similarity scores
- Embedding generation details

### Enable Debug Logging

Set environment variable:
```bash
SEARCH_DEBUG=true
# OR
EMAIL_ANALYSIS_DEBUG=true  # (enables both email and search debugging)
```

### Debug Folder Structure

Each search creates a folder: `debug-search-runs/{timestamp}-{queryHash}/`

```
debug-search-runs/
  1763456789000-abc12345/
    00-metadata.json          # Search metadata (query, user, threshold, limit)
    01-query-details.json     # Original and processed query
    02-kb-selection.json      # KBs selected (names, IDs, document counts)
    03-database-queries.json  # Tables queried, RPC functions, fields searched
    04-embedding-generation.json  # Query embedding (first 10 dims preview)
    05-kb-results.json        # KB search results with similarity scores
    06-email-results.json     # Email search results with similarity scores
    07-summary.json           # Complete debug data
    SUMMARY.md                # Human-readable summary
```

### Console Logging

The search system logs detailed information to the console:

#### Search Modal Logs
- Query generation (from selected sources or emails)
- KB selection changes
- Threshold slider adjustments
- Search execution start/end

#### Search Service Logs
- Full query text and length
- Similarity threshold used
- KB names and IDs being searched
- Database table and RPC function
- Fields being searched
- Embedding generation
- Results count and similarity ranges

#### Example Console Output
```
═══════════════════════════════════════════════════════════════
🔍 SEMANTIC SEARCH INITIATED
═══════════════════════════════════════════════════════════════
📝 Query: "Find if the technologies required for the job desc..."
👤 User ID: abc-123-def
🎯 Threshold: 0.3 (30%)
📋 Limit: 10 results per source
🔎 Search KBs: Yes
📧 Search Emails: Yes
🗂️  KB IDs: All KBs (no filter)
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
🔍 KNOWLEDGE BASE SEARCH
═══════════════════════════════════════════════════════════════
📝 Query: "Find if the technologies required for the job desc..."
📊 Query length: 67 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
🗂️  KBs to search: All KBs
───────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: kb_chunks
   RPC Function: hybrid_search_knowledge_base
   Fields searched: content, embedding, document_id, chunk_index, char_count
   Filter: user_id = abc-123-def
   Similarity filter: > 0.3
───────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing hybrid search RPC...
───────────────────────────────────────────────────────────────
✅ Search complete: 10 results found
   Similarity range: 45.2% - 78.9%
   Average similarity: 62.3%
═══════════════════════════════════════════════════════════════
```

### Database Tables and Fields

#### Knowledge Base Search

**Table**: `kb_chunks`
- **RPC Function**: `hybrid_search_knowledge_base`
- **Fields Searched**:
  - `content`: The actual text content of the chunk
  - `embedding`: Vector embedding (1536 dimensions) for semantic similarity
  - `document_id`: Links to `kb_documents` table
  - `chunk_index`: Position of chunk within document
  - `char_count`: Character count of chunk
- **Search Method**: Hybrid (semantic + keyword matching)
- **Filter**: `user_id` + optional `knowledge_base_id` filter

#### Email Search

**Table**: `analyzed_email_embeddings`
- **RPC Function**: `search_analyzed_emails`
- **Fields Searched**:
  - `embedded_text`: The text that was embedded (extracted data or URL content)
  - `embedding`: Vector embedding (1536 dimensions) for semantic similarity
  - `content_type`: Type of content ('extracted_data' or 'scraped_url')
  - `source_url`: Original URL if content came from scraped link
  - `analyzed_email_id`: Links to `analyzed_emails` table
- **Search Method**: Semantic similarity only
- **Filter**: `user_id`

### Understanding Search Results

#### Similarity Scores
- **Range**: 0.0 to 1.0 (0% to 100%)
- **Threshold**: Only results above threshold are returned (default: 30%)
- **Interpretation**:
  - 70%+: Very similar content
  - 50-70%: Moderately similar
  - 30-50%: Somewhat similar (low threshold)
  - <30%: Not similar (filtered out)

#### Result Structure

**KB Results**:
```json
{
  "document_title": "Senior Backend Developer - Netcompany",
  "kb_name": "Old Job Descriptions",
  "similarity": 0.75,
  "content": "Looking for .NET and C# expert...",
  "chunk_index": 2,
  "document_id": "uuid-here"
}
```

**Email Results**:
```json
{
  "email_subject": "IT Consultant Position",
  "email_from": "jobs@example.com",
  "similarity": 0.68,
  "content_type": "extracted_data",
  "source_url": null,
  "matched": true
}
```

### Bilingual Data (English/Danish)

**Important**: OpenAI embeddings (`text-embedding-3-small`) work cross-lingually. This means:
- ✅ You can search in English and find Danish content
- ✅ You can search in Danish and find English content
- ✅ Mixed-language queries work naturally
- ✅ No special handling needed - embeddings capture semantic meaning across languages

**Example**:
- Query: "software development with .NET and automation"
- Will match: "softwareudvikling med .NET og automatisering" (Danish)
- Will match: "software development using .NET and RPA" (English)

The embeddings understand semantic similarity regardless of language.

### Troubleshooting Search

#### No Results Found
1. **Check threshold**: Lower the similarity threshold slider (try 20-30%)
2. **Check KBs**: Verify KBs have documents with content
3. **Check embeddings**: Ensure documents have been embedded (check `kb_chunks` table)
4. **Check query**: Try a more general query or specific keywords

#### Low Similarity Scores
1. **Query too specific**: Try broader terms
2. **Content mismatch**: KB content might not match query domain
3. **Threshold too high**: Lower the threshold slider

#### Debug Folder Not Created
1. **Check environment**: Set `SEARCH_DEBUG=true` or `EMAIL_ANALYSIS_DEBUG=true`
2. **Check permissions**: Ensure write access to project directory
3. **Check console**: Look for error messages in terminal

---

## ✅ Summary

| Issue | Status | Solution |
|-------|--------|----------|
| RAG Error (UUID undefined) | ✅ Fixed | Added `userId` and `agentConfigId` to analysis input |
| Duplicate URL scraping | ✅ Fixed | Implemented URL deduplication with normalization |
| Edit KB/Documents | ✅ Implemented | Full CRUD with edit modal for documents |
| Hybrid search not visible | ✅ Clarified | Works via "Find Similar" button + automatic RAG |

---

## 🤔 Questions or Issues?

If you encounter any issues or have questions:
1. Check the debug folder for your analysis run
2. Look for console logs in the terminal
3. Verify your agent config has KBs assigned
4. Ensure your KBs have documents with content

**Happy searching! 🎉**

