# Database Update Instructions

## ⚠️ IMPORTANT: You must run this migration before using Phase 3

The database schema has been updated to support the new generic analysis system.

## What Changed

The `agent_configurations` table now has:
- **`match_criteria`** (renamed from `extraction_criteria`) - What you're interested in
- **`extraction_fields`** (new) - What to extract if matched

## How to Update Your Database

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://app.supabase.com
2. Click on your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy the contents of the migration file below
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. You should see "Success. No rows returned"

### Migration SQL

```sql
-- Split extraction_criteria into match_criteria and extraction_fields
-- This makes the system fully generic - users define what to match and what to extract separately

-- Rename extraction_criteria to match_criteria
ALTER TABLE public.agent_configurations 
  RENAME COLUMN extraction_criteria TO match_criteria;

-- Add new extraction_fields column
ALTER TABLE public.agent_configurations 
  ADD COLUMN extraction_fields TEXT;

-- Update the column comment for clarity
COMMENT ON COLUMN public.agent_configurations.match_criteria IS 
  'What the user is interested in - criteria to match/filter emails (e.g., "Software developer jobs with <5 years experience")';

COMMENT ON COLUMN public.agent_configurations.extraction_fields IS 
  'What to extract if the email matches - fields to extract (e.g., "deadline, technologies, competencies, experience level")';
```

### Option 2: Using the Migration File

If you have local Supabase CLI set up:

```bash
cd email-app
supabase db push
```

This will apply the migration from `supabase/migrations/003_update_agent_configurations_for_generic_analysis.sql`

## Verification

After running the migration, verify it worked:

1. Go to **Table Editor** in Supabase
2. Select `agent_configurations` table
3. You should see columns:
   - `id`
   - `user_id`
   - `email_address`
   - `match_criteria` ← (renamed)
   - `extraction_fields` ← (new)
   - `analyze_attachments`
   - `follow_links`
   - `created_at`
   - `updated_at`

## Updating Existing Configurations

If you have existing agent configurations:

1. The old `extraction_criteria` content is now in `match_criteria`
2. The `extraction_fields` will be `NULL` for existing rows
3. You should edit your configurations to add extraction fields:
   - Go to Dashboard
   - Click "Edit" on each configuration
   - Fill in both textareas:
     - "What are you interested in?" (match criteria)
     - "What to extract if matched?" (extraction fields)
   - Save

## Troubleshooting

### Error: "column extraction_criteria does not exist"

This means the migration ran successfully! The column was renamed to `match_criteria`.

### Error: "column already exists"

The migration was already run. You can safely ignore this.

### Error: "permission denied"

You need to be the database owner. Make sure you're logged in with the correct account.

## Need Help?

If you encounter issues:
1. Check the Supabase dashboard for error details
2. Verify you're on the correct project
3. Make sure you have the necessary permissions
4. Try refreshing the Supabase dashboard

---

**After updating the database, add your API keys to `.env.local` and restart your dev server!**

