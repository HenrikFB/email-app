# Environment Variables Setup

This file explains how to set up your environment variables for the Email Agent Configuration App.

## Required Environment Variables

Create a `.env.local` file in the root directory of the project with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Aurinko Email API Configuration
AURINKO_CLIENT_ID=your-aurinko-client-id
AURINKO_CLIENT_SECRET=your-aurinko-client-secret
AURINKO_REDIRECT_URI=http://localhost:3000/api/aurinko/callback
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

## Example .env.local File

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMDQ0ODQwNSwiZXhwIjoxOTQ2MDI0NDA1fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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

