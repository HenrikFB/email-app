-- Create agent_configurations table
CREATE TABLE IF NOT EXISTS public.agent_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    extraction_criteria TEXT,
    analyze_attachments BOOLEAN DEFAULT false,
    follow_links BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_agent_configurations_user_id 
ON public.agent_configurations(user_id);

-- Enable Row Level Security
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own configurations
CREATE POLICY "Users can view their own agent configurations"
ON public.agent_configurations
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy: Users can insert their own configurations
CREATE POLICY "Users can create their own agent configurations"
ON public.agent_configurations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own configurations
CREATE POLICY "Users can update their own agent configurations"
ON public.agent_configurations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own configurations
CREATE POLICY "Users can delete their own agent configurations"
ON public.agent_configurations
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before update
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.agent_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

