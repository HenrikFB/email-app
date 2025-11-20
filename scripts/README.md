# Database Seed Script

This script populates the database with realistic end-to-end data for testing and development.

## Overview

The seed script creates comprehensive test data for two use cases:

1. **Jobs Search** - Software development job applications
2. **Finance** - Investment opportunities and financial news

## What Gets Created

### Agent Configurations (2)
- **Jobs Config**: Matches software development positions (.NET, C#, Python, SQL, RPA)
- **Finance Config**: Matches investment opportunities (tech sector, equity, €500K-€5M)

### Knowledge Bases (4)
- **Old Job Descriptions** (Jobs) - 3 job description documents
- **Cover Letters Archive** (Jobs) - 2 cover letter examples
- **Investment History** (Finance) - 2 investment notes
- **Financial Reports** (Finance) - 1 financial report summary

### KB Documents (10 total)
- **8 Text Notes** - Manually created documents (no snapshots)
- **2 Saved Emails** - Saved from analyzed emails (with full snapshots)

Each document includes:
- Full text content
- Notes, optimization hints, extraction guidelines
- Context tags
- **Real embeddings** generated via OpenAI API

**Note on Snapshots:**
- Text notes have `NULL` for both `agent_config_snapshot` and `analyzed_email_snapshot`
- Saved emails have **both snapshots populated** with complete metadata (see "Snapshot Flow" section below)

### Analyzed Emails (5 total)
- **3 Job emails** (2 matched, 1 not matched)
- **2 Finance emails** (both matched)

Each email includes:
- Realistic HTML body
- Extracted data (technologies, domains, etc.)
- `data_by_source` with email + scraped URLs
- Reasoning and confidence scores
- **Real embeddings** for extracted_data and scraped URLs

### Agent-KB Assignments (4)
- Jobs config → Old Job Descriptions + Cover Letters
- Finance config → Investment History + Financial Reports

## Prerequisites

1. **Environment Variables** (set in `.env.local` or export):
   ```bash
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   # OR use:
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

2. **Dependencies**:
   ```bash
   npm install
   ```

## Usage

### Run the seed script:
```bash
npm run seed
```

Or directly:
```bash
npx tsx scripts/seed-database.ts
```

## What Happens

1. ✅ Creates 2 agent configurations
2. ✅ Creates 4 knowledge bases
3. ✅ Creates 8 KB documents (text notes) with content
4. ✅ Generates embeddings for all KB document chunks (via OpenAI)
5. ✅ Creates agent-KB assignments
6. ✅ Creates 1 email connection
7. ✅ Creates 5 analyzed emails with realistic data
8. ✅ Generates embeddings for all analyzed emails (extracted_data + scraped_urls)
9. ✅ **Simulates "Save to KB"** - Saves 2 analyzed emails to knowledge bases with full snapshots

**Note**: Generating embeddings uses the OpenAI API and may take a few minutes. Each embedding costs a small amount (text-embedding-3-small is very cheap).

## User ID

All data is created for user ID: `acfb6765-3f43-41d0-8647-887379341f57`

## Idempotency

The script uses fixed UUIDs for:
- Agent configurations
- Knowledge bases
- Email connection

These will be upserted (updated if they exist, created if they don't).

Documents and emails use random UUIDs, so running the script multiple times will create duplicates. To reset:
1. Delete existing data manually, or
2. Modify the script to check for existing data before inserting

## Example Data

### Job Email Example
- **Subject**: "Senior .NET Developer Position - Region Midtjylland"
- **Technologies**: .NET, C#, Python, SQL, UiPath
- **Domain**: Healthcare
- **Location**: Aarhus
- **Matched**: Yes (confidence: 92%)

### Finance Email Example
- **Subject**: "Q4 Investment Opportunities - Tech Sector"
- **Sector**: Technology
- **Investment Type**: Equity
- **Amount Range**: €500K-€2M
- **Matched**: Yes (confidence: 90%)

## Testing Search

After seeding, you can:

1. **View Agent Configs**: Go to Dashboard → Agent Configurations
2. **View Knowledge Bases**: Go to Dashboard → Knowledge Base
3. **View Analyzed Emails**: Go to Dashboard → Results
4. **Test Semantic Search**:
   - Select emails in Results page
   - Click "Find Similar"
   - Search should find matches in KBs and other analyzed emails

## Troubleshooting

### "Missing environment variables"
- Ensure all required env vars are set
- Check `.env.local` file exists and has correct values

### "OpenAI API error"
- Verify `OPENAI_API_KEY` is valid
- Check you have API credits
- Rate limits may apply (script includes delays)

### "Supabase connection error"
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` has proper permissions
- Ensure database migrations have been run

### "Duplicate key error"
- Some records use fixed UUIDs and will be upserted
- Documents/emails use random UUIDs - delete old ones if needed

## Cost Estimate

Using OpenAI `text-embedding-3-small`:
- ~8 KB documents × ~3 chunks each = ~24 embeddings
- ~5 analyzed emails × ~2 embeddings each = ~10 embeddings
- **Total**: ~34 embeddings
- **Cost**: ~$0.0001 per 1K tokens, very cheap (likely < $0.01 total)

## Snapshot Flow Explained

The seed script demonstrates **two different paths** for creating KB documents:

### Path 1: Manual Text Notes (8 documents - snapshots are NULL)

```
User manually creates a text note
    ↓
Goes directly into kb_documents
    ↓
agent_config_snapshot: NULL ❌
analyzed_email_snapshot: NULL ❌
```

**Examples from seed:**
- "Senior Backend Developer - Netcompany"
- "Cover Letter - Netcompany Position"
- "Tech Startup Investment - Q3 2024"
- etc.

These are **manually written** knowledge base documents. They never came from an analyzed email, so they have no snapshots.

---

### Path 2: Saved Analyzed Emails (2 documents - snapshots populated)

```
1. Email arrives → analyzed_emails table
    ↓
2. AI analyzes it → extracted_data, reasoning, confidence
    ↓
3. Uses agent_config → match_criteria, extraction_fields
    ↓
4. User clicks "Save to Knowledge Base" (or seed script simulates it)
    ↓
5. Creates kb_document with BOTH snapshots:
    ↓
    agent_config_snapshot: {
      name: "Jobs - Software Developer",
      email_address: "jobs@example.com",
      match_criteria: "...",
      extraction_fields: "...",
      analyze_attachments: false,
      follow_links: true,
      button_text_pattern: "..."
    } ✅
    ↓
    analyzed_email_snapshot: {
      email_subject: "Senior .NET Developer...",
      email_from: "jobs@regionmidtjylland.dk",
      email_date: "2024-12-15T10:00:00Z",
      reasoning: "Strong match: Requires .NET...",
      confidence: 0.92,
      matched: true,
      extracted_data: {...},
      data_by_source: [...],
      scraped_urls: [...]
    } ✅
```

**Examples from seed:**
- "Senior .NET Developer Position - Region Midtjylland" (saved from jobs agent)
- "Q4 Investment Opportunities - Tech Sector" (saved from finance agent)

---

### Why Snapshots Matter

The snapshots preserve **context** even if:
1. ❌ The original `analyzed_emails` record is deleted
2. ❌ The `agent_configurations` is modified or deleted

**What's Preserved:**
- **What the user wanted to achieve** (from agent config)
- **What the AI found** (from analyzed email)
- **Why it was relevant** (reasoning, confidence)
- **The extracted data** (technologies, domains, etc.)

This allows the system to understand the **intent and context** of saved documents for better RAG (Retrieval Augmented Generation) and future analysis, even if the original data sources change or are removed.

---

## Next Steps

After seeding:
1. Explore the data in the UI
2. Test semantic search functionality
3. Try different search queries
4. Modify agent configs and see how it affects matching
5. Add your own KB documents and test search
6. **Check `kb_documents` table** - See the 2 documents with populated snapshots vs. 8 with NULL snapshots

