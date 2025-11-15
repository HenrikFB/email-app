# Debugging Guide - Phase 3 Analysis

## What Was Fixed

### 1. Database Query Error ✅
**Problem**: Results page was querying the old `extraction_criteria` column that we renamed to `match_criteria`.

**Fixed in**: `app/dashboard/results/page.tsx`
- Now queries both `match_criteria` and `extraction_fields`

### 2. Added Comprehensive Logging ✅

Now you'll see detailed logs in your terminal showing:
- What's being analyzed
- Each step of the process
- What data is being extracted
- Database updates

## How to Use the Logs

### Terminal Log Format

When you click "Analyze Email", you'll see:

```
📋 ========== STARTING ANALYSIS ACTION ==========
🆔 Analyzed Email ID: 1286bcdb-42ef-...
✅ Fetched analyzed email: {
  subject: 'Weaviate Weekly Newsletter',
  from: 'weaviate@mail.beehiiv.com',
  status: 'pending',
  agentConfig: 'weaviate@mail.beehiiv.com'
}

🚀 Running analysis orchestrator...

🔍 ========== STARTING EMAIL ANALYSIS ==========
📧 Email ID: AAMkAGNjODUxN2Yx...
🎯 Match Criteria: How to build agents and RAG with weaviate. And products features
📋 Extraction Fields: Documentation and features and demos
🔗 Follow Links: true

📥 Step 1: Fetching email from Microsoft Graph...
✅ Email fetched: {
  subject: 'Weaviate Weekly Newsletter',
  from: 'weaviate@mail.beehiiv.com',
  hasBody: true,
  bodyLength: 15234
}

🔗 Step 2: Extracting links from email HTML...
✅ Found 5 links:
  1. Read more → https://weaviate.io/blog/agent-rag-tutorial...
  2. Documentation → https://weaviate.io/developers/weaviate...
  3. Watch demo → https://www.youtube.com/watch?v=abc123...

🌐 Step 3: Scraping links with Firecrawl...
✅ Successfully scraped 3/5 pages
  1. Building RAG Agents with Weaviate (8234 chars)
  2. Weaviate Documentation (12456 chars)

🤖 Step 4: Analyzing with OpenAI...
Sending to GPT-4o-mini: {
  emailLength: 15234,
  scrapedPages: 3,
  totalContent: 35924
}

✅ Analysis complete!
📊 Results: {
  matched: true,
  confidence: 0.85,
  extractedFields: ['documentation', 'features', 'demos'],
  reasoning: 'Email contains information about building RAG agents with Weaviate...'
}
========== EMAIL ANALYSIS COMPLETE ==========

💾 Updating database with results...
Result to save: {
  success: true,
  matched: true,
  extractedDataKeys: ['documentation', 'features', 'demos'],
  scrapedUrls: 3,
  hasError: false
}

✅ Database updated successfully!
========== ANALYSIS ACTION COMPLETE ==========
```

### Results Page Logs

When you visit the Results page:

```
✅ Fetched analyzed emails: 3
📧 Email 1: {
  subject: 'Weaviate Weekly Newsletter',
  from: 'weaviate@mail.beehiiv.com',
  status: 'completed',
  matched: true,
  agentConfig: 'weaviate@mail.beehiiv.com',
  extractedData: ['documentation', 'features', 'demos']
}
```

## Testing Your Example

Based on your agent configuration:

**From**: `weaviate@mail.beehiiv.com`  
**Match Criteria**: "How to build agents and RAG with weaviate. And products features"  
**Extraction Fields**: "Documentation and features and demos"  
**Firecrawl**: ✅ Enabled

### What Should Happen:

1. **Email Fetching** (Step 1):
   - Fetches the full HTML email from Microsoft Graph
   - Should show email body length

2. **Link Extraction** (Step 2):
   - Finds all links in the email HTML
   - Should show 3-10 links typically

3. **Web Scraping** (Step 3):
   - Scrapes up to 5 links with Firecrawl
   - Converts to markdown
   - Shows which pages were successfully scraped

4. **AI Analysis** (Step 4):
   - Sends email + scraped content to GPT-4o-mini
   - Checks if it matches your criteria
   - Extracts: documentation URLs, features mentioned, demo links

5. **Database Update**:
   - Saves extracted data to `analyzed_emails` table
   - Status changes from "pending" → "completed"

### Expected Extracted Data Format:

```json
{
  "matched": true,
  "extractedData": {
    "documentation": [
      "https://weaviate.io/developers/weaviate/...",
      "https://weaviate.io/blog/agent-tutorial"
    ],
    "features": [
      "Vector search",
      "Hybrid search",
      "RAG integration",
      "GraphQL API"
    ],
    "demos": [
      "https://www.youtube.com/watch?v=abc123",
      "https://weaviate.io/demos/agent-example"
    ]
  },
  "reasoning": "Email discusses building RAG agents with Weaviate, including documentation links and feature descriptions.",
  "confidence": 0.85
}
```

## Troubleshooting

### No Logs Appearing

1. Make sure dev server is running: `npm run dev`
2. Check you're looking at the correct terminal window
3. Logs appear when you click "Analyze Email" button

### Analysis Stays "Pending"

1. Check for errors in terminal
2. Verify API keys are set in `.env.local`:
   - `OPENAI_API_KEY`
   - `FIRECRAWL_API_KEY`
3. Check if you have OpenAI credits remaining

### "OPENAI_API_KEY is not set"

Add to `.env.local`:
```env
OPENAI_API_KEY=sk-proj-your-key-here
FIRECRAWL_API_KEY=fc-your-key-here
```

Then restart: `npm run dev`

### Analysis Fails with Firecrawl Error

- Check Firecrawl credits: https://www.firecrawl.dev/dashboard
- Free tier: 500 credits/month
- Each scrape uses 1-5 credits depending on complexity
- Some sites block scraping (expected behavior)

### "Column extraction_criteria does not exist"

This means you haven't run the migration yet:
1. Go to Supabase → SQL Editor
2. Copy from: `supabase/migrations/003_update_agent_configurations_for_generic_analysis.sql`
3. Run it

## Next Steps After Testing

Once you see the logs and confirm it's working:

1. **Check extracted data** matches your expectations
2. **Adjust your criteria** if needed:
   - Make match criteria more specific
   - Add/remove extraction fields
3. **Test with different emails** to see patterns
4. **Monitor costs** (should be <$0.01 per email)

## Cost Monitoring

Based on your example (Weaviate newsletter):
- **Email content**: ~15KB
- **3 scraped pages**: ~35KB total markdown
- **Total tokens**: ~12,000 input + 1,000 output
- **Cost**: ~$0.002 (0.2 cents per email)

Very affordable! 🎉

---

**Happy analyzing! Watch your terminal for the detailed logs.**

