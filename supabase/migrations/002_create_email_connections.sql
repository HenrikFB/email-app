-- Create email_connections table for storing Aurinko OAuth tokens
CREATE TABLE IF NOT EXISTS public.email_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'Google', 'Microsoft', 'Yahoo', etc.
    aurinko_account_id TEXT NOT NULL UNIQUE,
    aurinko_access_token TEXT NOT NULL,
    aurinko_refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, email_address)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_email_connections_user_id 
ON public.email_connections(user_id);

-- Create index on aurinko_account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_connections_aurinko_account 
ON public.email_connections(aurinko_account_id);

-- Enable Row Level Security
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own email connections
CREATE POLICY "Users can view their own email connections"
ON public.email_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy: Users can insert their own email connections
CREATE POLICY "Users can create their own email connections"
ON public.email_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own email connections
CREATE POLICY "Users can update their own email connections"
ON public.email_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own email connections
CREATE POLICY "Users can delete their own email connections"
ON public.email_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_email_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for email_connections
CREATE TRIGGER set_email_connections_updated_at
    BEFORE UPDATE ON public.email_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_email_connections_updated_at();

-- Create analyzed_emails table for storing email analysis results
CREATE TABLE IF NOT EXISTS public.analyzed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_configuration_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
    email_connection_id UUID REFERENCES public.email_connections(id) ON DELETE SET NULL,
    
    -- Email metadata
    email_subject TEXT,
    email_from TEXT NOT NULL,
    email_to TEXT[],
    email_date TIMESTAMP WITH TIME ZONE,
    email_message_id TEXT NOT NULL,
    email_snippet TEXT,
    has_attachments BOOLEAN DEFAULT false,
    
    -- Analysis results
    extracted_data JSONB, -- The LLM extraction results in JSON format
    matched BOOLEAN DEFAULT false, -- Did it match the extraction criteria?
    analysis_status TEXT DEFAULT 'pending', -- 'pending', 'analyzing', 'completed', 'failed'
    error_message TEXT,
    
    -- Links scraped (if applicable)
    scraped_urls TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, email_message_id, agent_configuration_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_user_id 
ON public.analyzed_emails(user_id);

CREATE INDEX IF NOT EXISTS idx_analyzed_emails_agent_config 
ON public.analyzed_emails(agent_configuration_id);

CREATE INDEX IF NOT EXISTS idx_analyzed_emails_connection 
ON public.analyzed_emails(email_connection_id);

CREATE INDEX IF NOT EXISTS idx_analyzed_emails_matched 
ON public.analyzed_emails(matched) WHERE matched = true;

CREATE INDEX IF NOT EXISTS idx_analyzed_emails_status 
ON public.analyzed_emails(analysis_status);

CREATE INDEX IF NOT EXISTS idx_analyzed_emails_date 
ON public.analyzed_emails(email_date DESC);

-- Enable Row Level Security
ALTER TABLE public.analyzed_emails ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own analyzed emails
CREATE POLICY "Users can view their own analyzed emails"
ON public.analyzed_emails
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy: Users can insert their own analyzed emails
CREATE POLICY "Users can create their own analyzed emails"
ON public.analyzed_emails
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own analyzed emails
CREATE POLICY "Users can update their own analyzed emails"
ON public.analyzed_emails
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own analyzed emails
CREATE POLICY "Users can delete their own analyzed emails"
ON public.analyzed_emails
FOR DELETE
USING (auth.uid() = user_id);

