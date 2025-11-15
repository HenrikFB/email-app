-- Create user_feedback table for rich feedback (not just boolean)
-- Allows users to provide detailed feedback on analysis quality

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzed_email_id UUID NOT NULL REFERENCES public.analyzed_emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rich feedback types
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correct_match', 'missed_match', 'false_positive', 'extraction_error')),
  
  -- User's reasoning and suggestions
  feedback_text TEXT,
  suggested_improvements TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_user_feedback_email ON public.user_feedback(analyzed_email_id);
CREATE INDEX idx_user_feedback_user ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_type ON public.user_feedback(feedback_type);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own feedback"
ON public.user_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
ON public.user_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.user_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.user_feedback FOR DELETE
USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.user_feedback IS 'Rich user feedback on email analysis quality';
COMMENT ON COLUMN public.user_feedback.feedback_type IS 'Type of feedback: correct_match, missed_match, false_positive, extraction_error';
COMMENT ON COLUMN public.user_feedback.feedback_text IS 'User''s explanation of the feedback';
COMMENT ON COLUMN public.user_feedback.suggested_improvements IS 'User''s suggestions for improving the analysis';

