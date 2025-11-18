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

### KB Documents (8 total)
Each document includes:
- Full text content
- Notes, optimization hints, extraction guidelines
- Context tags
- **Real embeddings** generated via OpenAI API

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
3. ✅ Creates 8 KB documents with content
4. ✅ Generates embeddings for all KB document chunks (via OpenAI)
5. ✅ Creates agent-KB assignments
6. ✅ Creates 1 email connection
7. ✅ Creates 5 analyzed emails with realistic data
8. ✅ Generates embeddings for all analyzed emails (extracted_data + scraped_urls)

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

## Next Steps

After seeding:
1. Explore the data in the UI
2. Test semantic search functionality
3. Try different search queries
4. Modify agent configs and see how it affects matching
5. Add your own KB documents and test search

