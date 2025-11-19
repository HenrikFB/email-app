# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Create Supabase Project
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Name it "email-agent-config" and create a password
4. Wait for it to finish setting up (~2 minutes)

### Step 2: Run Database Migration
1. In Supabase, go to **SQL Editor**
2. Copy the SQL from `supabase/migrations/001_create_agent_configurations.sql`
3. Paste and click "Run"
4. You should see "Success. No rows returned"

### Step 3: Get Your API Keys
1. Go to **Settings** > **API**
2. Copy your:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 4: Configure Environment
1. Create `.env.local` in the project root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Run the App
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## ✅ What You'll See

1. **Login/Signup Page**: Create an account with any email/password
2. **Dashboard**: Your personal dashboard with:
   - Form to create new agent configurations
   - List of your existing configurations
   - Edit/Delete buttons for each configuration

## 🎯 Try It Out

Create your first agent configuration:
- **Email**: `jobs@example.com`
- **Extraction Criteria**: 
  ```
  Extract software developer jobs requiring:
  - Less than 5 years experience
  - TypeScript or .NET skills
  - Remote or hybrid work
  ```
- Check "Analyze email attachments" ✓
- Check "Follow links with Firecrawl" ✓
- Click "Create Configuration"

## 📝 Field Explanations

- **Email Address to Monitor**: The incoming email address you want to trigger on (e.g., job alerts, finance emails)
- **Extraction Criteria**: Natural language description of what you want to extract or analyze from the emails
- **Analyze email attachments**: Include PDFs and other attachments in the analysis
- **Follow links with Firecrawl**: Open and scrape links found in the email content

## 🔧 Troubleshooting

**"Invalid API key"**: Check your `.env.local` file has the correct values

**Can't see configurations**: Make sure you're logged in with the same account

**Need to disable email confirmation?**: 
- Go to Supabase **Authentication** > **Providers** > **Email**
- Toggle off "Confirm email" (for development only)

## 📚 Next Steps

- Read the full [README.md](README.md) for deployment instructions
- Check [ENV_SETUP.md](ENV_SETUP.md) for detailed environment variable info
- Explore the code structure in the main README

## 🎨 Features

✅ Email/password authentication  
✅ Create, read, update, delete configurations  
✅ Row Level Security (your data is private)  
✅ Beautiful, responsive UI with shadcn-ui  
✅ Real-time updates  
✅ Loading states and error handling  

Enjoy building your email agent configurations! 🎉

