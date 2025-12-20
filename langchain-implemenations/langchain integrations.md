My current worksflow i had tried is not good enought because i need each steps to better at reasoning and iterative solving each task/steps. So it need to be better to iterative using tools like a ReAct Agent patterns. So therefor I am thinking about using langchain/langgraph but i want to start simple because my deep agents vibe coding didnt works( at lib/deep-agent but they also using file system) 


So can we with this implementations focus on:
1: Langchain and Langgraph integreation and setup with typescript and NextjS app? Otherwise i need to try another frameworks with like mastra, or openai, or claude for typescript and nextjs?


2. The most important thing is that we can make a steps with iterative tools use for solving a task with reasoning. So just on langchain/clanggraph node maybe with chat with iterative tools? 

Specific take the email and cleaned text and find relevant informations based on user agent_configuration. So insert variables with agent_configurations for building system prompts forreasoning: (match_criteria, extraction_fields, user_intent).I

3. Show the input and output to next graph/node/agents where we doing the below "step 2: (Web)Research" if there a match.

____________________
OveraLL goal/plan:
________________



Steps 0: agent_configurations for building system prompts for each steps and reasoning: (match_criteria, extraction_fields, user_intent, KB assignments)
  "config": {
    "matchCriteria": "Software developer with less than 5 years experience. \n\nIn classic Java,.NET, node.js backend and Javascript/typescript frameworks like Next.js/React and Angular.. \n\nOr RPA and automation with RPA with Power platform and UiPath. Or python\n\nAvoid PLC/scada and hardware descriptions like electronic/mechanic engineering.\n\nI know Deep learning, AI Engineering, Iot & Cloud computing. \n\nI also know something about informations and cyber security and compliance. ",
    "extractionFields": "deadline, technologies, competencies, experience level, company domains, location, work type",
    "userIntent": "Like what i wrote in the interested in. I want to automatic find relevant jobs. Rigt now i get super many emails where i need to open each and read the job descriptions.  \n\nSoftware developer with less than 5 years experience. \n\nIn classic Java,.NET, node.js backend and Javascript/typescript frameworks like Next.js/React and Angular.. \n\nOr RPA and automation with RPA with Power platform and UiPath. Or Python.\n\nAvoid PLC/scada and hardware descriptions like electronic/mechanic engineering.\n\nI know Deep learning, AI Engineering, Iot & Cloud computing. \n\nI also know something about informations and cyber security and compliance. ",
    "draftGenerationEnabled": true,
    "draftInstructions": "Draft a new cover letter to this job because it is matched where you find inspiration from your search and finding from the knowlegde base.\nAnd Mention relevant data and senctence from my knowledge base so i can quickly find my previous cover letter that is similiar. \n",
    "knowledgeBaseIds": [
      "55bed571-f9a3-40c1-bcbf-eff326bb9c01",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    ]



Step 1: Email analysis
-html to plain text see lib/microsoft-graph/client.ts or lib/utils/html-to-text.ts so we dont have any noisy longs emails but just emails plain text. Maybe step 0 or here. 
-Find relevants context/data based on agent configurations/User intentions. For example make queries for each relevant job like {company} {position} {location}. It will be pased to next steps. 

step 2: (Web)Research
-see langchain-implemenations/tavilysearch.md. 
-Need search and extract. https://docs.tavily.com/documentation/best-practices/best-practices-extract 


Step 3: KB Search
-Multi-intent search benefits from reasoning
-I had tried some reasoning but not good enough here with openai chat completions: lib/chat-search/service.ts . It need to better reasoning and iterative so therefor langchaiN/langgraph. 

Step 4: Draft generation


_________________________
#Maybe usefull ressources:
_________________

https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs

https://docs.langchain.com/oss/javascript/langgraph/workflows-agents 

https://docs.langchain.com/oss/javascript/langchain/multi-agent


____
Very specific job examples but it should be generic and also about finance and job agents with properties if i looking for a new house. 
_____

1)analyse emails plain text from job agents in email(difference jobs)

2)Build search quieries for each relevant job

3)for each job so make a research where i try to find the real job descriptions. From public urls in public job portal or internal carreresites and extract the real job descriptions. LinkedIN Url in email is under authentication so i need to find the specific job description somewhere else on the internet.
-if match(based on what i want to find) so extract technologies, task, and deadlines. 

4) For each relelvant job match so make a supabase hybrid serch for each technolgoes. For example :
-if there are .NET then =>search in supabase hybrid search for snippet i using .NET or backend with
-if Azure/cloud => find earlier snippets with Azure/cloud. 
-If React or Angular => find snippets with React or frontends

5) draft a cover letter with the relevant cover lettere snippets i had used earlier. So i know my tone and cover letter styles. 
 


_______
Importantant Implementation notes
_____
It is very important it is good software arhictecture with generic interfaces and file/project structures. Like dont repeat your self(DRY), maybe strategy or factory pattern if nessarcy. But it is fine just one workflow file right now like https://github.com/langchain-ai/lca-langgraph-essentials/blob/main/js/src/L2/email-workflow-complete.ts . 


__________
Current Database schema. Please fell free to make better new database schema for this agent workflows. Try to extend then delete. 
___________
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agent_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  match_criteria text,
  analyze_attachments boolean DEFAULT false,
  follow_links boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  extraction_fields text,
  button_text_pattern text,
  name text NOT NULL,
  user_intent text,
  link_selection_guidance text,
  max_links_to_scrape integer DEFAULT 10,
  content_retrieval_strategy text DEFAULT 'scrape_only'::text CHECK (content_retrieval_strategy = ANY (ARRAY['scrape_only'::text, 'scrape_and_search'::text, 'search_only'::text, 'intelligent_discovery'::text, 'deep_agent'::text])),
  extraction_examples text,
  analysis_feedback text,
  auto_search_kb_on_match boolean DEFAULT false,
  auto_save_matches_to_kb_id uuid,
  auto_save_confidence_threshold numeric DEFAULT 0.8 CHECK (auto_save_confidence_threshold >= 0::numeric AND auto_save_confidence_threshold <= 1::numeric),
  auto_search_query_template text,
  auto_search_mode text DEFAULT 'single'::text CHECK (auto_search_mode = ANY (ARRAY['single'::text, 'multi_intent'::text, 'ai_powered'::text])),
  auto_search_instructions text,
  auto_search_split_fields ARRAY,
  auto_search_max_queries integer DEFAULT 5 CHECK (auto_search_max_queries >= 1 AND auto_search_max_queries <= 20),
  draft_generation_enabled boolean DEFAULT false,
  draft_instructions text,
  CONSTRAINT agent_configurations_pkey PRIMARY KEY (id),
  CONSTRAINT agent_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT agent_configurations_auto_save_matches_to_kb_id_fkey FOREIGN KEY (auto_save_matches_to_kb_id) REFERENCES public.knowledge_bases(id)
);
CREATE TABLE public.agent_kb_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_configuration_id uuid NOT NULL,
  knowledge_base_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agent_kb_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT agent_kb_assignments_agent_configuration_id_fkey FOREIGN KEY (agent_configuration_id) REFERENCES public.agent_configurations(id),
  CONSTRAINT agent_kb_assignments_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id)
);
CREATE TABLE public.analyzed_email_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  analyzed_email_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['extracted_data'::text, 'scraped_url'::text])),
  source_url text,
  source_index integer,
  embedded_text text NOT NULL,
  embedding USER-DEFINED,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  fts tsvector DEFAULT to_tsvector('simple'::regconfig, embedded_text),
  CONSTRAINT analyzed_email_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT analyzed_email_embeddings_analyzed_email_id_fkey FOREIGN KEY (analyzed_email_id) REFERENCES public.analyzed_emails(id),
  CONSTRAINT analyzed_email_embeddings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.analyzed_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_configuration_id uuid,
  email_connection_id uuid,
  email_subject text,
  email_from text NOT NULL,
  email_to ARRAY,
  email_date timestamp with time zone,
  email_message_id text NOT NULL,
  email_snippet text,
  has_attachments boolean DEFAULT false,
  extracted_data jsonb,
  matched boolean DEFAULT false,
  analysis_status text DEFAULT 'pending'::text,
  error_message text,
  scraped_urls ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  analyzed_at timestamp with time zone,
  graph_message_id text,
  email_html_body text,
  reasoning text,
  confidence numeric,
  all_links_found ARRAY,
  data_by_source jsonb,
  scraped_content jsonb,
  original_urls jsonb,
  kb_search_results jsonb,
  kb_search_performed_at timestamp with time zone,
  auto_saved_to_kb_id uuid,
  CONSTRAINT analyzed_emails_pkey PRIMARY KEY (id),
  CONSTRAINT analyzed_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT analyzed_emails_agent_configuration_id_fkey FOREIGN KEY (agent_configuration_id) REFERENCES public.agent_configurations(id),
  CONSTRAINT analyzed_emails_email_connection_id_fkey FOREIGN KEY (email_connection_id) REFERENCES public.email_connections(id),
  CONSTRAINT analyzed_emails_auto_saved_to_kb_id_fkey FOREIGN KEY (auto_saved_to_kb_id) REFERENCES public.knowledge_bases(id)
);
CREATE TABLE public.email_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  provider text NOT NULL,
  account_id text NOT NULL UNIQUE,
  aurinko_access_token text NOT NULL,
  aurinko_refresh_token text,
  token_expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT email_connections_pkey PRIMARY KEY (id),
  CONSTRAINT email_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.generated_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analyzed_email_id uuid,
  agent_configuration_id uuid,
  draft_content text NOT NULL,
  kb_sources_used jsonb DEFAULT '[]'::jsonb,
  generation_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT generated_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT generated_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT generated_drafts_analyzed_email_id_fkey FOREIGN KEY (analyzed_email_id) REFERENCES public.analyzed_emails(id),
  CONSTRAINT generated_drafts_agent_configuration_id_fkey FOREIGN KEY (agent_configuration_id) REFERENCES public.agent_configurations(id)
);
CREATE TABLE public.kb_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  knowledge_base_id uuid NOT NULL,
  document_id uuid NOT NULL,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  char_count integer NOT NULL,
  embedding USER-DEFINED,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  fts tsvector DEFAULT to_tsvector('simple'::regconfig, content),
  CONSTRAINT kb_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT kb_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT kb_chunks_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id),
  CONSTRAINT kb_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.kb_documents(id)
);
CREATE TABLE public.kb_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  knowledge_base_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['text_note'::text, 'saved_email'::text, 'saved_url'::text, 'uploaded_document'::text])),
  content text NOT NULL,
  analyzed_email_id uuid,
  source_url text,
  notes text,
  optimization_hints text,
  extraction_guidelines text,
  context_tags ARRAY,
  chunk_count integer DEFAULT 0,
  char_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  source_agent_config_id uuid,
  agent_config_snapshot jsonb,
  analyzed_email_snapshot jsonb,
  file_path text,
  file_type text,
  file_size bigint,
  original_filename text,
  processing_config jsonb,
  processing_status text CHECK (processing_status IS NULL OR (processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'ready_for_review'::text]))),
  processing_error text,
  processed_at timestamp with time zone,
  CONSTRAINT kb_documents_pkey PRIMARY KEY (id),
  CONSTRAINT kb_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT kb_documents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id),
  CONSTRAINT kb_documents_analyzed_email_id_fkey FOREIGN KEY (analyzed_email_id) REFERENCES public.analyzed_emails(id),
  CONSTRAINT kb_documents_source_agent_config_id_fkey FOREIGN KEY (source_agent_config_id) REFERENCES public.agent_configurations(id)
);
CREATE TABLE public.knowledge_bases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type = ANY (ARRAY['manual'::text, 'saved_emails'::text, 'saved_scraped_urls'::text])),
  optimization_context text,
  is_dynamic boolean DEFAULT false,
  document_count integer DEFAULT 0,
  total_chunks integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  default_processing_config jsonb,
  auto_save_uploads boolean DEFAULT true,
  CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_bases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  analyzed_email_id uuid NOT NULL,
  user_id uuid NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type = ANY (ARRAY['correct_match'::text, 'missed_match'::text, 'false_positive'::text, 'extraction_error'::text])),
  feedback_text text,
  suggested_improvements text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT user_feedback_analyzed_email_id_fkey FOREIGN KEY (analyzed_email_id) REFERENCES public.analyzed_emails(id),
  CONSTRAINT user_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
