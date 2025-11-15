# Environment Variables Setup

This file explains how to set up your environment variables for the Email Agent Configuration App.

## Required Environment Variables

Create a `.env.local` file in the root directory of the project with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft/callback

# OpenAI API Configuration (for email analysis)
OPENAI_API_KEY=sk-your-openai-api-key

# Firecrawl API Configuration (for web scraping)
FIRECRAWL_API_KEY=fc-your-firecrawl-api-key
```

## How to Get These Values

### 1. NEXT_PUBLIC_SUPABASE_URL

1. Go to your Supabase project dashboard at [https://app.supabase.com](https://app.supabase.com)
2. Navigate to **Settings** > **API**
3. Find the **Project URL** section
4. Copy the URL (it should look like: `https://xxxxxxxxxxxxx.supabase.co`)

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY

1. In the same **Settings** > **API** page
2. Find the **Project API keys** section
3. Copy the **anon** / **public** key (it's a long string of characters)

### 3. MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: Your app name (e.g., "Email Agent Config")
   - **Supported account types**: Select "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: `http://localhost:3000/api/microsoft/callback` (Web platform)
5. Click **Register**
6. After registration:
   - Copy the **Application (client) ID** → This is your `MICROSOFT_CLIENT_ID`
   - Go to **Certificates & secrets** > **New client secret**
   - Add description and expiration, click **Add**
   - **Copy the secret value immediately** → This is your `MICROSOFT_CLIENT_SECRET` (you won't see it again!)
7. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
8. Add these permissions:
   - `Mail.Read`
   - `offline_access`
   - `openid`
   - `profile`
   - `email`
9. Click **Add permissions**
10. **Important**: No admin consent needed for personal Microsoft accounts!

### 4. OPENAI_API_KEY

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to **API keys** section (click on your profile icon → "View API keys")
4. Click **Create new secret key**
5. Give it a name (e.g., "Email Agent Config")
6. **Copy the API key immediately** → This is your `OPENAI_API_KEY` (you won't see it again!)
7. Note: You'll need to add billing information to use the API
   - GPT-4o-mini (used in this app) is very affordable (~$0.15 per 1M input tokens)

### 5. FIRECRAWL_API_KEY

1. Go to [Firecrawl](https://www.firecrawl.dev/)
2. Sign up for an account
3. Navigate to your dashboard
4. Go to **API Keys** section
5. Copy your API key → This is your `FIRECRAWL_API_KEY`
6. Note: Firecrawl offers a free tier with 500 credits/month
   - Each scrape typically costs 1-5 credits depending on the site complexity
   - The app uses "auto" proxy mode (uses stealth if basic fails)

## Example .env.local File

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMDQ0ODQwNSwiZXhwIjoxOTQ2MDI0NDA1fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Microsoft Graph
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=abc~def~ghi~jkl~mno~pqr~stu~vwx~yz
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft/callback

# OpenAI
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890

# Firecrawl
FIRECRAWL_API_KEY=fc-1234567890abcdefghijklmnop
```

## Important Notes

- Never commit your `.env.local` file to version control
- The `.env.local` file is already listed in `.gitignore`
- These are **public** keys safe to use in the browser (they start with `NEXT_PUBLIC_`)
- The actual security is handled by Supabase Row Level Security (RLS) policies

## Troubleshooting

If you see errors like "Invalid API key" or connection issues:
1. Double-check that you copied the correct values
2. Make sure there are no extra spaces or quotes around the values
3. Restart your development server after creating or modifying `.env.local`
4. Verify your Supabase project is active and running

### 6. EMAIL_ANALYSIS_DEBUG (Optional)

Enable debug mode to create detailed logs for each email analysis run:

```bash
EMAIL_ANALYSIS_DEBUG=true
```

**What it does:**
- Creates a debug folder for each analysis run
- Logs every step (email fetching, link extraction, AI decisions, scraping, chunking, analysis)
- Stores raw data (email HTML, plain text, links, scraped content)
- Generates human-readable summary (SUMMARY.md)
- Keeps last 10 runs, auto-cleans older ones

**Debug folder location:** `debug-analysis-runs/{timestamp}-{emailId}/`

**Files created:**
- `SUMMARY.md` - Human-readable analysis summary
- `00-metadata.json` - Run information
- `01-email-plain-text.txt` - Plain text email content
- `01-email-html.html` - Full HTML email content
- `02-links-extracted.json` - All links found
- `03-ai-link-prioritization.json` - AI's link selection reasoning
- `04-scraping-complete.json` - Scraping results
- `05-chunking-complete.json` - Content chunks
- `06-chunk-analysis-complete.json` - Analysis of each chunk
- `07-aggregation-complete.json` - Final aggregated results

**Note:** Debug folders are automatically added to `.gitignore`

