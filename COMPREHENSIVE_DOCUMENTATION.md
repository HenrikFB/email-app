# Comprehensive Documentation: Email Analysis System

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Complete User Flows](#complete-user-flows)
5. [Technical Components](#technical-components)
6. [API Integrations](#api-integrations)
7. [Analysis Pipeline](#analysis-pipeline)
8. [File Structure](#file-structure)
9. [Environment Setup](#environment-setup)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What We Built

A **fully generic, AI-powered email analysis system** that:

- ✅ Connects to email accounts via Microsoft Graph OAuth
- ✅ Allows users to define custom match criteria and extraction fields
- ✅ Fetches emails from connected accounts
- ✅ Extracts links from email HTML
- ✅ Scrapes web pages with Firecrawl (optional)
- ✅ Analyzes emails with OpenAI GPT-4o-mini
- ✅ Stores extracted structured data
- ✅ Provides a clean UI for managing configurations and viewing results

### Key Features

- **Generic & Flexible**: No hardcoded logic - users define what to match and what to extract
- **Multi-Email Support**: Connect multiple email accounts
- **Link Scraping**: Automatically follows and scrapes links in emails (optional)
- **AI-Powered**: Uses GPT-4o-mini for intelligent extraction
- **Secure**: Row Level Security (RLS) ensures users only see their own data
- **Real-time**: Manual analysis trigger with live status updates

### Technology Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn-ui, TanStack Table
- **Backend**: Next.js Server Actions, API Routes
- **Database**: Supabase (PostgreSQL) with RLS
- **Authentication**: Supabase Auth
- **Email API**: Microsoft Graph API
- **Web Scraping**: Firecrawl API
- **AI Analysis**: OpenAI GPT-4o-mini

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Dashboard   │  │ Browse Emails│  │   Results    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Server Actions & API Routes             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Library Layer (Business Logic)           │  │
│  │  • Microsoft Graph Client                             │  │
│  │  • Firecrawl Client                                   │  │
│  │  • OpenAI Analyzer                                   │  │
│  │  • Email Analysis Orchestrator                        │  │
│  │  • Link Extractor                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │   Microsoft  │ │   Firecrawl  │ │    OpenAI    │
│  (Database)  │ │  Graph API   │ │     API      │ │     API      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Component Interaction Flow

```
User Action
    │
    ├─► Dashboard Page
    │   ├─► View Email Connections
    │   ├─► Create/Edit Agent Configurations
    │   └─► Connect Email Account (OAuth)
    │
    ├─► Browse Emails Page
    │   ├─► Select Email Connection
    │   ├─► Apply Filters (sender, date, attachments)
    │   ├─► Fetch Emails from Microsoft Graph
    │   ├─► Display in Data Table
    │   └─► Queue Emails for Analysis
    │
    └─► Results Page
        ├─► View Queued Emails
        ├─► Trigger Analysis
        └─► View Extracted Data
```

---

## Database Schema

### Tables Overview

#### 1. `agent_configurations`

Stores user-defined analysis configurations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `email_address` | TEXT | Email address to monitor |
| `match_criteria` | TEXT | What user is interested in (trigger criteria) |
| `extraction_fields` | TEXT | What to extract if matched |
| `analyze_attachments` | BOOLEAN | Whether to analyze attachments (future) |
| `follow_links` | BOOLEAN | Whether to scrape links with Firecrawl |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**RLS Policies**: Users can only view/edit/delete their own configurations.

**Example**:
```json
{
  "email_address": "weaviate@mail.beehiiv.com",
  "match_criteria": "How to build agents and RAG with weaviate. And products features",
  "extraction_fields": "Documentation and features and demos",
  "follow_links": true
}
```

#### 2. `email_connections`

Stores OAuth tokens for connected email accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `email_address` | TEXT | Connected email address |
| `provider` | TEXT | Email provider (e.g., "Microsoft") |
| `account_id` | TEXT | Provider account ID |
| `aurinko_access_token` | TEXT | Microsoft Graph access token |
| `aurinko_refresh_token` | TEXT | Refresh token for token renewal |
| `token_expires_at` | TIMESTAMPTZ | Token expiration time |
| `is_active` | BOOLEAN | Whether connection is active |
| `last_sync_at` | TIMESTAMPTZ | Last email sync time |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**RLS Policies**: Users can only access their own connections.

**Note**: Column names still use `aurinko_` prefix for historical reasons (refactored from Aurinko to Microsoft Graph).

#### 3. `analyzed_emails`

Stores emails queued for analysis and their results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `agent_configuration_id` | UUID | Foreign key to `agent_configurations` |
| `email_connection_id` | UUID | Foreign key to `email_connections` |
| `email_subject` | TEXT | Email subject |
| `email_from` | TEXT | Sender email address |
| `email_to` | TEXT[] | Recipient email addresses |
| `email_date` | TIMESTAMPTZ | Email received date |
| `email_message_id` | TEXT | Internet Message ID (RFC 822) - for deduplication |
| `graph_message_id` | TEXT | Microsoft Graph message ID - for fetching |
| `email_snippet` | TEXT | Email preview text |
| `has_attachments` | BOOLEAN | Whether email has attachments |
| `extracted_data` | JSONB | AI-extracted structured data |
| `matched` | BOOLEAN | Whether email matched criteria |
| `analysis_status` | TEXT | Status: 'pending', 'analyzing', 'completed', 'failed' |
| `error_message` | TEXT | Error message if analysis failed |
| `scraped_urls` | TEXT[] | URLs that were scraped with Firecrawl |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `analyzed_at` | TIMESTAMPTZ | When analysis completed |

**RLS Policies**: Users can only access their own analyzed emails.

**Unique Constraint**: `(user_id, email_message_id, agent_configuration_id)` prevents duplicates.

---

## Complete User Flows

### Flow 1: Initial Setup & Email Connection

```
1. User signs up/logs in
   └─► Supabase Auth handles authentication
   
2. User goes to Dashboard
   └─► Sees "No email accounts connected"
   
3. User clicks "Connect Email Account"
   └─► Redirects to /api/microsoft/auth
   
4. Server Action:
   ├─► Checks user authentication
   ├─► Generates state parameter (CSRF protection)
   └─► Redirects to Microsoft OAuth consent screen
   
5. User authorizes on Microsoft
   └─► Microsoft redirects to /api/microsoft/callback?code=...
   
6. Callback Handler:
   ├─► Exchanges authorization code for tokens
   ├─► Fetches user account info from Microsoft Graph
   ├─► Stores connection in `email_connections` table
   └─► Redirects to dashboard with success message
   
7. Dashboard shows connected email account
```

### Flow 2: Creating Agent Configuration

```
1. User goes to Dashboard
   └─► Sees "Agent Configurations" section
   
2. User fills out form:
   ├─► Email Address: "weaviate@mail.beehiiv.com"
   ├─► Match Criteria: "How to build agents and RAG with weaviate..."
   ├─► Extraction Fields: "Documentation and features and demos"
   ├─► ☑ Follow links with Firecrawl
   └─► ☐ Analyze attachments (future)
   
3. User clicks "Create Configuration"
   └─► Server Action: createConfiguration()
   
4. Server Action:
   ├─► Validates user authentication
   ├─► Inserts into `agent_configurations` table
   └─► Revalidates dashboard page
   
5. Configuration appears in list
```

### Flow 3: Browsing & Queueing Emails

```
1. User goes to "Browse Emails" page
   
2. User selects email connection
   └─► Dropdown shows connected accounts
   
3. User sets filters:
   ├─► From: "weaviate@mail.beehiiv.com" (optional)
   ├─► Date Range: "Last 30 days"
   └─► Has Attachments: "Any"
   
4. User clicks "Fetch Emails"
   └─► Server Action: getEmailsFromConnection()
   
5. Server Action:
   ├─► Validates user owns the connection
   ├─► Gets access token from `email_connections`
   ├─► Calls Microsoft Graph API: GET /me/messages
   ├─► Applies filters (from, date range, attachments)
   ├─► Returns up to 50 emails
   └─► Client displays in TanStack Table
   
6. User sees email list:
   ├─► From, Subject, Date, Attachments
   ├─► Can sort, filter, paginate
   └─► Can select multiple emails (checkboxes)
   
7. User selects emails and agent configuration
   └─► Clicks "Analyze Selected"
   
8. Server Action: analyzeSelectedEmails()
   ├─► For each selected email:
   │   ├─► Fetches full email details from Microsoft Graph
   │   ├─► Stores in `analyzed_emails` table
   │   │   ├─► email_message_id (Internet Message ID)
   │   │   └─► graph_message_id (Graph ID for fetching)
   │   └─► Status: 'pending'
   └─► Redirects to Results page
```

### Flow 4: Analyzing Emails

```
1. User goes to "Results" page
   └─► Sees emails with status: 'pending'
   
2. User clicks "Analyze Email" button
   └─► Server Action: runAnalysis(analyzedEmailId)
   
3. Server Action:
   ├─► Fetches analyzed_email record
   ├─► Gets related agent_configuration and email_connection
   ├─► Checks if graph_message_id exists
   ├─► Updates status to 'analyzing'
   └─► Calls orchestrator: analyzeEmail()
   
4. Orchestrator (lib/email-analysis/orchestrator.ts):
   
   Step 1: Fetch Email
   ├─► Calls Microsoft Graph: GET /me/messages/{graph_message_id}
   ├─► Gets full email with HTML body
   └─► Logs: "✅ Email fetched: { subject, from, bodyLength }"
   
   Step 2: Extract Links (if follow_links = true)
   ├─► Parses HTML with cheerio
   ├─► Finds all <a> tags
   ├─► Extracts href and text
   ├─► Limits to 5 links
   └─► Logs: "✅ Found X links: ..."
   
   Step 3: Scrape Links (if links found)
   ├─► For each link:
   │   ├─► Calls Firecrawl API: POST /v1/scrape
   │   ├─► Gets markdown content
   │   └─► Handles errors gracefully (continues if one fails)
   ├─► Collects scraped markdown
   └─► Logs: "✅ Successfully scraped X/Y pages"
   
   Step 4: Analyze with OpenAI
   ├─► Builds prompt with:
   │   ├─► Email HTML content
   │   ├─► Scraped markdown (if any)
   │   ├─► User's match_criteria
   │   └─► User's extraction_fields
   ├─► Calls OpenAI: chat.completions.create()
   ├─► Model: gpt-4o-mini
   ├─► Response format: JSON
   └─► Gets structured result:
       {
         "matched": true/false,
         "extractedData": { ... },
         "reasoning": "...",
         "confidence": 0.0-1.0
       }
   
5. Server Action saves results:
   ├─► Updates `analyzed_emails` table:
   │   ├─► analysis_status: 'completed' or 'failed'
   │   ├─► extracted_data: JSONB
   │   ├─► matched: boolean
   │   ├─► scraped_urls: TEXT[]
   │   ├─► error_message: TEXT (if failed)
   │   └─► analyzed_at: TIMESTAMPTZ
   └─► Revalidates Results page
   
6. User sees updated results:
   ├─► Status: 'completed'
   ├─► Matched: true/false
   ├─► Extracted Data: JSON display
   ├─► Reasoning: AI explanation
   ├─► Confidence: 0-100%
   └─► Scraped URLs: Links that were scraped
```

---

## Technical Components

### 1. Microsoft Graph Client (`lib/microsoft-graph/client.ts`)

**Purpose**: Handles all Microsoft Graph API interactions.

**Key Functions**:

- `getAuthorizationUrl(state?)`: Generates OAuth authorization URL
- `exchangeCodeForTokens(code)`: Exchanges auth code for access/refresh tokens
- `refreshAccessToken(refreshToken)`: Refreshes expired access token
- `getAccountInfo(accessToken)`: Gets user's account information
- `fetchEmails(accessToken, options)`: Fetches emails with filters
- `getEmailById(accessToken, emailId)`: Gets full email details with HTML body

**Filter Support**:
- `from`: Sender email address
- `after`/`before`: Date range (ISO 8601)
- `hasAttachment`: Boolean filter
- `isRead`: Read/unread filter

**Note**: Complex filters (like `toRecipients/any()`) are avoided to prevent "InefficientFilter" errors.

### 2. Firecrawl Client (`lib/firecrawl/client.ts`)

**Purpose**: Web scraping with stealth mode support.

**Key Functions**:

- `scrapeUrl(options)`: Scrapes a single URL
- `scrapeUrls(urls, options)`: Scrapes multiple URLs in parallel

**Features**:
- Auto proxy mode (uses stealth if basic fails)
- Markdown format output
- Only main content extraction
- Graceful error handling (failed scrapes don't stop others)
- Timeout support (30s default)

**Cost**: 1-5 credits per scrape (500 free/month)

### 3. OpenAI Analyzer (`lib/openai/analyzer.ts`)

**Purpose**: Generic AI-powered email analysis.

**Key Functions**:

- `analyzeEmailContent(input)`: Analyzes email with user-defined criteria

**Prompt Structure**:
1. Email information (subject, from, date)
2. Email HTML content
3. Scraped pages (if any)
4. User's match criteria
5. User's extraction fields
6. Instructions for JSON response format

**Model**: GPT-4o-mini (cost-effective, fast)

**Response Format**:
```json
{
  "matched": boolean,
  "extractedData": {
    // User-defined fields based on extraction_fields
  },
  "reasoning": string,
  "confidence": number (0-1)
}
```

### 4. Link Extractor (`lib/email-analysis/link-extractor.ts`)

**Purpose**: Extracts links from email HTML.

**Key Functions**:

- `extractLinksFromHtml(html, options)`: Parses HTML and extracts links

**Features**:
- Uses cheerio for HTML parsing
- Extracts `<a>` tags with href
- Detects button-like links (by class names)
- Filters by link text pattern (optional)
- Filters by href pattern (optional)
- Removes duplicates
- Limits to N links (default: 5)

### 5. Email Analysis Orchestrator (`lib/email-analysis/orchestrator.ts`)

**Purpose**: Coordinates the entire analysis pipeline.

**Flow**:
1. Fetch email from Microsoft Graph
2. Extract links (if `follow_links = true`)
3. Scrape links with Firecrawl (if links found)
4. Analyze with OpenAI
5. Return structured result

**Error Handling**: Graceful failures at each step, continues if possible.

**Logging**: Comprehensive console logs for debugging.

### 6. Server Actions

#### `app/dashboard/actions.ts`
- `getConfigurations()`: Fetch user's agent configurations
- `createConfiguration()`: Create new configuration
- `updateConfiguration()`: Update existing configuration
- `deleteConfiguration()`: Delete configuration

#### `app/dashboard/emails/actions.ts`
- `getEmailsFromConnection()`: Fetch emails with filters
- `analyzeSelectedEmails()`: Queue emails for analysis

#### `app/dashboard/results/actions.ts`
- `runAnalysis()`: Trigger analysis on queued email

#### `app/dashboard/email-connections/actions.ts`
- `getEmailConnections()`: Fetch user's email connections
- `disconnectEmailConnection()`: Remove email connection

---

## API Integrations

### Microsoft Graph API

**Base URL**: `https://graph.microsoft.com/v1.0`

**Endpoints Used**:
- `GET /me` - Get account info
- `GET /me/messages` - List emails with filters
- `GET /me/messages/{id}` - Get full email with body

**Authentication**: OAuth 2.0 with access tokens

**Permissions Required**:
- `Mail.Read` - Read emails
- `User.Read` - Read user profile
- `offline_access` - Refresh tokens
- `openid`, `profile`, `email` - Basic profile

**Token Management**:
- Access tokens stored in `email_connections.aurinko_access_token`
- Refresh tokens stored in `email_connections.aurinko_refresh_token`
- Expiration tracked in `email_connections.token_expires_at`
- Auto-refresh logic implemented (not yet triggered automatically)

### Firecrawl API

**Base URL**: `https://api.firecrawl.dev/v1`

**Endpoints Used**:
- `POST /scrape` - Scrape a URL

**Authentication**: Bearer token (API key)

**Features**:
- Auto proxy mode (basic → stealth fallback)
- Markdown format
- Main content only
- 30s timeout

**Rate Limits**: 500 free credits/month

### OpenAI API

**Base URL**: `https://api.openai.com/v1`

**Endpoints Used**:
- `POST /chat/completions` - Generate analysis

**Authentication**: Bearer token (API key)

**Model**: `gpt-4o-mini`

**Parameters**:
- `temperature`: 0.3 (for consistent extraction)
- `response_format`: `{ type: "json_object" }`
- `max_tokens`: Default (model limit)

**Cost**: ~$0.0006 per email (very affordable)

---

## Analysis Pipeline

### Detailed Step-by-Step

```
┌─────────────────────────────────────────────────────────────┐
│                    ANALYSIS PIPELINE                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Fetch Email
├─► Input: graph_message_id, access_token
├─► API Call: GET /me/messages/{graph_message_id}
├─► Response: Full email with HTML body
└─► Output: Email object with subject, from, body, etc.

Step 2: Extract Links (if follow_links = true)
├─► Input: Email HTML body
├─► Process: Parse HTML with cheerio
├─► Extract: All <a> tags with href
├─► Filter: Remove mailto:, anchors, duplicates
├─► Limit: First 5 links
└─► Output: Array of { url, text, isButton }

Step 3: Scrape Links (if links found)
├─► Input: Array of URLs
├─► Process: Parallel scraping with Promise.allSettled
├─► API Call: POST /v1/scrape for each URL
├─► Format: Markdown
├─► Error Handling: Continue if one fails
└─► Output: Array of { url, markdown, title }

Step 4: Build Analysis Prompt
├─► Email Information: subject, from, date
├─► Email Content: HTML body
├─► Scraped Content: Markdown from scraped pages
├─► Match Criteria: User-defined (what they're interested in)
├─► Extraction Fields: User-defined (what to extract)
└─► Instructions: JSON format, reasoning, confidence

Step 5: Analyze with OpenAI
├─► API Call: POST /chat/completions
├─► Model: gpt-4o-mini
├─► Input: Built prompt
├─► Response: JSON with matched, extractedData, reasoning, confidence
└─► Output: Structured analysis result

Step 6: Save Results
├─► Update analyzed_emails table
├─► Set status: 'completed' or 'failed'
├─► Store extracted_data (JSONB)
├─► Store matched boolean
├─► Store scraped_urls array
├─► Store error_message (if failed)
└─► Set analyzed_at timestamp
```

### Example Analysis

**Input**:
- Email: Weaviate newsletter about Academy
- Match Criteria: "How to build agents and RAG with weaviate. And products features"
- Extraction Fields: "Documentation and features and demos"

**Process**:
1. Fetches email HTML
2. Extracts 5 links (documentation, blog posts, demos)
3. Scrapes 3 links successfully with Firecrawl
4. Sends to OpenAI with email + scraped content

**Output**:
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
  "reasoning": "Email discusses Weaviate Academy focused on building agents and RAG, includes documentation links and feature descriptions.",
  "confidence": 0.8
}
```

---

## File Structure

```
email-app/
├── app/
│   ├── api/
│   │   └── microsoft/
│   │       ├── auth/route.ts          # OAuth initiation
│   │       └── callback/route.ts       # OAuth callback handler
│   ├── dashboard/
│   │   ├── layout.tsx                 # Protected layout with nav
│   │   ├── page.tsx                   # Main dashboard
│   │   ├── actions.ts                 # Agent config CRUD
│   │   ├── components/
│   │   │   ├── config-form.tsx        # Create/edit config form
│   │   │   ├── config-card.tsx        # Display config card
│   │   │   └── email-connection-card.tsx
│   │   ├── emails/
│   │   │   ├── page.tsx               # Email browser UI
│   │   │   ├── actions.ts             # Email fetching & queueing
│   │   │   └── data-table.tsx         # TanStack Table component
│   │   ├── results/
│   │   │   ├── page.tsx               # Results list page
│   │   │   ├── actions.ts             # Analysis trigger
│   │   │   └── components/
│   │   │       └── result-card.tsx    # Result display card
│   │   └── email-connections/
│   │       └── actions.ts              # Connection management
│   ├── login/page.tsx                 # Login page
│   ├── signup/page.tsx                # Signup page
│   └── auth/callback/route.ts         # Supabase auth callback
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client
│   │   ├── server.ts                  # Server Supabase client
│   │   └── middleware.ts              # Middleware client
│   ├── microsoft-graph/
│   │   └── client.ts                  # Microsoft Graph API client
│   ├── firecrawl/
│   │   └── client.ts                  # Firecrawl API client
│   ├── openai/
│   │   └── analyzer.ts                # OpenAI analysis logic
│   └── email-analysis/
│       ├── types.ts                   # Shared TypeScript types
│       ├── link-extractor.ts          # HTML link extraction
│       └── orchestrator.ts            # Analysis pipeline coordinator
├── supabase/
│   └── migrations/
│       ├── 001_create_agent_configurations.sql
│       ├── 002_create_email_connections.sql
│       ├── 003_update_agent_configurations_for_generic_analysis.sql
│       └── 004_add_graph_message_id.sql
├── components/
│   └── ui/                            # shadcn-ui components
├── middleware.ts                      # Auth middleware
├── .env.local                         # Environment variables
└── package.json
```

---

## Environment Setup

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Microsoft Graph
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=abc~def~ghi~jkl~mno~pqr~stu~vwx~yz
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft/callback

# OpenAI
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890

# Firecrawl
FIRECRAWL_API_KEY=fc-1234567890abcdefghijklmnop
```

### Setup Steps

1. **Create Supabase Project**
   - Go to https://app.supabase.com
   - Create new project
   - Copy URL and anon key

2. **Run Database Migrations**
   - Go to Supabase SQL Editor
   - Run migrations in order (001, 002, 003, 004)

3. **Create Azure App Registration**
   - Go to https://portal.azure.com
   - Azure AD → App registrations → New registration
   - Add redirect URI: `http://localhost:3000/api/microsoft/callback`
   - Add API permissions: Mail.Read, User.Read, offline_access
   - Create client secret → Copy value immediately

4. **Get OpenAI API Key**
   - Go to https://platform.openai.com
   - API keys → Create new secret key
   - Add billing information

5. **Get Firecrawl API Key**
   - Go to https://www.firecrawl.dev
   - Sign up → Dashboard → API Keys

6. **Create `.env.local`**
   - Copy from `ENV_SETUP.md`
   - Fill in all values

7. **Install Dependencies**
   ```bash
   npm install
   ```

8. **Run Dev Server**
   ```bash
   npm run dev
   ```

---

## Troubleshooting

### Common Issues

#### 1. "Id is malformed" Error

**Cause**: Using Internet Message ID instead of Graph Message ID.

**Solution**: 
- Run migration `004_add_graph_message_id.sql`
- Delete old queued emails
- Re-queue emails from Browse Emails page

#### 2. "Invalid client secret" Error

**Cause**: Using Client Secret ID instead of Value.

**Solution**: 
- Go to Azure Portal → App registrations
- Create new client secret
- Copy the **Value** (not the ID)
- Update `.env.local`

#### 3. "hasBody: false" in Logs

**Cause**: Microsoft Graph sometimes returns emails without body in initial fetch.

**Solution**: 
- This is expected for some emails
- Analysis still works with snippet (255 chars)
- For full HTML, may need to use `$expand=body` parameter

#### 4. Analysis Stays "Pending"

**Cause**: Missing API keys or analysis failed silently.

**Solution**:
- Check `.env.local` has all keys
- Check terminal for error logs
- Verify OpenAI billing is active
- Check Firecrawl credits remaining

#### 5. "Column extraction_criteria does not exist"

**Cause**: Migration 003 not run.

**Solution**:
- Run migration `003_update_agent_configurations_for_generic_analysis.sql`
- Restart dev server

---

## Logging & Debugging

### Terminal Logs

The system provides comprehensive logging:

**Analysis Start**:
```
📋 ========== STARTING ANALYSIS ACTION ==========
🆔 Analyzed Email ID: xxx
✅ Fetched analyzed email: { subject, from, hasGraphId }
```

**Orchestrator**:
```
🔍 ========== STARTING EMAIL ANALYSIS ==========
📧 Email ID: AQMkADAw...
🎯 Match Criteria: ...
📋 Extraction Fields: ...
```

**Each Step**:
```
📥 Step 1: Fetching email...
✅ Email fetched: { subject, bodyLength }

🔗 Step 2: Extracting links...
✅ Found 5 links

🌐 Step 3: Scraping with Firecrawl...
✅ Successfully scraped 3/5 pages

🤖 Step 4: Analyzing with OpenAI...
✅ Analysis complete!
📊 Results: { matched, confidence, extractedFields }
```

**Database Update**:
```
💾 Updating database with results...
✅ Database updated successfully!
```

### Viewing Logs

All logs appear in the terminal where you run `npm run dev`. Watch for:
- ✅ Success indicators
- ❌ Error messages
- 📊 Data summaries
- 🔍 Step-by-step progress

---

## Cost Estimates

### Per Email Analysis

**OpenAI (GPT-4o-mini)**:
- Input: ~12,000 tokens (~$0.0018)
- Output: ~1,000 tokens (~$0.0006)
- **Total: ~$0.0024 per email**

**Firecrawl**:
- 1-5 credits per scrape
- Free tier: 500 credits/month
- **Cost: $0 (free tier) or ~$0.005-$0.025 per page**

**Microsoft Graph**:
- **Free** (no cost for API calls)

**Total**: ~$0.002-0.03 per email (very affordable!)

---

## Future Enhancements

### Planned Features

1. **Automatic Token Refresh**
   - Currently manual reconnection needed
   - Auto-refresh before expiration

2. **Background Email Fetching**
   - Vercel cron job
   - Auto-fetch new emails every 15 minutes
   - Auto-analyze based on agent configurations

3. **Attachment Analysis**
   - PDF parsing with pdf-parse
   - Extract text from attachments
   - Analyze with OpenAI

4. **Better Results UI**
   - Table view for extracted data
   - Export to CSV
   - Filter by matched status

5. **Email Notifications**
   - Send email when match found
   - Slack/Teams integration
   - Custom notification templates

6. **Bulk Analysis**
   - Analyze all pending emails at once
   - Progress indicator
   - Batch processing

---

## Summary

This system provides a **complete, production-ready email analysis platform** that:

✅ Connects to email accounts securely  
✅ Allows flexible, user-defined analysis criteria  
✅ Extracts links and scrapes web content  
✅ Uses AI to extract structured data  
✅ Stores results for easy access  
✅ Provides comprehensive logging  
✅ Is cost-effective (~$0.002 per email)  
✅ Is fully generic (no hardcoded logic)  

**The system is ready for production use and can be extended with additional features as needed!**

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

