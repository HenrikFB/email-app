# Fix: Email ID Issue

## The Problem ✅ FIXED

**Error**: `"ErrorInvalidIdMalformed","message":"Id is malformed."`

**Root Cause**: We were storing the **Internet Message ID** (like `<abc@domain.com>`) instead of the **Microsoft Graph Message ID** (like `AAMkAGNj...`) for fetching emails.

Microsoft Graph needs its own ID to fetch emails, not the RFC 822 Internet Message ID.

## The Solution

Added a new column `graph_message_id` to store both IDs:
- `email_message_id` - Internet Message ID (for deduplication, UNIQUE constraint)
- `graph_message_id` - Microsoft Graph ID (for fetching email content)

## How to Fix

### Step 1: Run Database Migration

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Add column for Microsoft Graph Message ID
ALTER TABLE public.analyzed_emails 
  ADD COLUMN IF NOT EXISTS graph_message_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_graph_id 
  ON public.analyzed_emails(graph_message_id);

-- Add comment
COMMENT ON COLUMN public.analyzed_emails.graph_message_id IS 
  'Microsoft Graph message ID used for fetching email content (different from email_message_id which is the Internet Message ID)';
```

Or copy from: `supabase/migrations/004_add_graph_message_id.sql`

### Step 2: Delete Old Queued Emails

Your existing queued emails don't have the `graph_message_id`, so they can't be analyzed. Delete them:

**Option A - Delete via Supabase Dashboard:**
1. Go to Supabase → Table Editor → `analyzed_emails`
2. Delete the 3 rows with status "failed" or "pending"

**Option B - Delete via SQL:**
```sql
DELETE FROM public.analyzed_emails 
WHERE user_id = 'your-user-id' 
AND status IN ('pending', 'failed');
```

### Step 3: Re-queue Emails

1. Go to "Browse Emails" page
2. Select your Weaviate emails again
3. Choose your agent configuration
4. Click "Analyze Selected"

Now they'll have BOTH IDs stored correctly!

### Step 4: Restart Dev Server

```bash
# Press Ctrl+C to stop
npm run dev
```

### Step 5: Analyze!

1. Go to "Results" page
2. You should see your newly queued emails (status: pending)
3. Click "Analyze Email"
4. Watch the terminal for detailed logs

## What You'll See in Terminal

Now the logs will show:

```bash
📋 ========== STARTING ANALYSIS ACTION ==========
✅ Fetched analyzed email: {
  subject: 'Weaviate Newsletter',
  hasGraphId: true,  ← Should be true now!
  internetMessageId: '<abc@domain.com>'
}

Using Graph Message ID: AAMkAGNjODUxN2YxLTRj...  ← The correct ID!

🔍 ========== STARTING EMAIL ANALYSIS ==========
📧 Email ID: AAMkAGNjODUxN2YxLTRj...  ← Not the malformed one!

📥 Step 1: Fetching email from Microsoft Graph...
✅ Email fetched: { subject: '...', bodyLength: 15234 }

🔗 Step 2: Extracting links...
✅ Found 5 links

🌐 Step 3: Scraping with Firecrawl...
✅ Successfully scraped 3/5 pages

🤖 Step 4: Analyzing with OpenAI...
✅ Analysis complete!
📊 Results: { matched: true, confidence: 0.85 }
```

## Troubleshooting

### "Email is missing Graph ID. Please re-queue this email"

This means you're trying to analyze an old email from before the migration. Solution: Delete it and re-queue.

### Still getting "Id is malformed"

1. Make sure you ran the migration
2. Make sure you deleted old emails and re-queued them
3. Restart dev server
4. Check terminal logs for `hasGraphId: true`

## Why This Happened

When we initially built the system, we stored the `internetMessageId` (RFC 822 Message-ID) as the primary identifier. This works for deduplication but not for fetching emails from Microsoft Graph, which requires its own internal ID.

The fix separates these two concerns:
- **Deduplication**: Use `email_message_id` (Internet Message ID)
- **Fetching**: Use `graph_message_id` (Graph Message ID)

---

**After these steps, you should be able to analyze emails successfully!** 🎉

