# Email Agent Configuration App

A Next.js 15 + Supabase B2C application for managing email monitoring and analysis configurations. Built with TypeScript, Tailwind CSS, and shadcn-ui components.

## Features

- 🔐 **Authentication**: Email/password authentication with Supabase Auth
- 📧 **Agent Configurations**: Create, read, update, and delete email monitoring configurations
- 🎨 **Modern UI**: Beautiful interface built with shadcn-ui components
- 🔒 **Row Level Security**: Database-level security ensuring users can only access their own data
- ⚡ **Server Actions**: Fast, secure mutations using Next.js Server Actions
- 📱 **Responsive**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn-ui
- **Backend**: Supabase (Auth + PostgreSQL)
- **Authentication**: Supabase Auth with email/password
- **Database**: PostgreSQL with Row Level Security (RLS)

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 20.9 or later
- npm, yarn, or pnpm

## Getting Started

### 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details:
   - **Name**: Choose a project name (e.g., "email-agent-config")
   - **Database Password**: Create a strong password
   - **Region**: Select the region closest to you
4. Click "Create new project" and wait for the setup to complete

### 2. Set Up the Database

1. In your Supabase project dashboard, go to the **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_create_agent_configurations.sql` from this repository
4. Paste it into the SQL Editor and click "Run"
5. This will create:
   - The `agent_configurations` table
   - Row Level Security (RLS) policies
   - Necessary indexes and triggers

### 3. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Find your:
   - **Project URL** (under "Project URL")
   - **Anon/Public Key** (under "Project API keys")

### 4. Configure Environment Variables

1. Create a `.env.local` file in the root of the project:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace `your-project-url` and `your-anon-key` with the values from step 3.

### 5. Configure Authentication Settings (Optional)

By default, Supabase requires email confirmation. To disable this for development:

1. Go to **Authentication** > **Providers** > **Email**
2. Under "Email Settings", toggle off "Confirm email"
3. Click "Save"

For production, keep email confirmation enabled and configure your email templates.

### 6. Install Dependencies

```bash
npm install
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
email-app/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts          # Auth callback handler
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── config-card.tsx   # Configuration display card
│   │   │   └── config-form.tsx   # Configuration form
│   │   ├── actions.ts            # Server actions for CRUD
│   │   ├── layout.tsx            # Protected dashboard layout
│   │   └── page.tsx              # Dashboard page
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── signup/
│   │   └── page.tsx              # Signup page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (redirects)
├── components/
│   └── ui/                       # shadcn-ui components
├── lib/
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       ├── middleware.ts         # Auth middleware
│       └── server.ts             # Server Supabase client
├── supabase/
│   └── migrations/
│       └── 001_create_agent_configurations.sql
├── middleware.ts                 # Next.js middleware
└── README.md
```

## Usage

### Creating an Account

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. Click "Sign up"
3. Enter your email and password (at least 6 characters)
4. Click "Create account"
5. You'll be automatically logged in and redirected to the dashboard

### Creating an Agent Configuration

1. On the dashboard, fill out the form:
   - **Email Address to Monitor**: The email address you want to analyze
   - **Extraction Criteria**: Describe what you want to extract or trigger from emails
   - **Analyze email attachments**: Check to include attachment analysis
   - **Follow links with Firecrawl**: Check to scrape and analyze linked pages
2. Click "Create Configuration"
3. Your configuration will appear in the list below

### Editing a Configuration

1. Find the configuration you want to edit
2. Click the "Edit" button
3. Modify the fields as needed
4. Click "Update Configuration"

### Deleting a Configuration

1. Find the configuration you want to delete
2. Click the "Delete" button
3. Confirm the deletion

### Signing Out

Click the "Sign out" button in the header.

## Database Schema

### `agent_configurations` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `email_address` | TEXT | Email address to monitor |
| `extraction_criteria` | TEXT | What to extract from emails |
| `analyze_attachments` | BOOLEAN | Whether to analyze attachments |
| `follow_links` | BOOLEAN | Whether to follow links with Firecrawl |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### Row Level Security (RLS)

The table has RLS enabled with policies ensuring:
- Users can only view their own configurations
- Users can only create configurations for themselves
- Users can only update their own configurations
- Users can only delete their own configurations

## Deployment

### Deploy to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project"
4. Import your repository
5. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"

### Update Supabase Auth Settings

After deploying, update your Supabase authentication settings:

1. Go to **Authentication** > **URL Configuration**
2. Add your production URL to "Site URL" (e.g., `https://your-app.vercel.app`)
3. Add your production URL to "Redirect URLs" (e.g., `https://your-app.vercel.app/auth/callback`)

## Troubleshooting

### "Not authenticated" errors

Make sure:
1. Your `.env.local` file has the correct Supabase credentials
2. You're logged in to the application
3. Your session hasn't expired (refresh the page)

### Database errors

If you see database errors:
1. Verify the SQL migration ran successfully in Supabase SQL Editor
2. Check that RLS policies are enabled
3. Ensure your user is authenticated

### Email confirmation issues

If you're not receiving confirmation emails:
1. Check Supabase **Authentication** > **Providers** > **Email** settings
2. For development, consider disabling email confirmation
3. For production, configure SMTP settings in Supabase

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the [Supabase documentation](https://supabase.com/docs)
2. Check the [Next.js documentation](https://nextjs.org/docs)
3. Review the [shadcn-ui documentation](https://ui.shadcn.com)
