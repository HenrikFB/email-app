# 📧 AI-Powered Email Analysis System

> A production-grade email analysis pipeline using **LangGraph** and **ReAct agents** for intelligent job discovery with iterative web research.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat&logo=langchain&logoColor=white)](https://js.langchain.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)

## 🎯 Overview

An intelligent email analysis system powered by **LangGraph StateGraph** and **ReAct research agents** that:

- 📨 **Fetches emails** from Microsoft Graph API
- 🧹 **Cleans & analyzes** HTML emails with chain-of-thought reasoning
- 🔍 **ReAct Research Agent** - Iteratively searches for public job descriptions when original URLs (LinkedIn) are blocked
- 🔄 **Re-evaluates matches** using full job descriptions for accuracy
- 📚 Manages document uploads (PDFs) with semantic search
- 🔍 **Hybrid search** combining semantic + keyword matching with RRF ranking
- 💬 **Global AI chat** for searching across all data sources

**Built for:** Job hunting automation with intelligent research, newsletter analysis, and knowledge management.

## ✨ Key Features

### **🔗 LangChain/LangGraph Integration** ⭐ NEW

- **LangGraph StateGraph** - Orchestrates multi-step workflow with conditional edges
- **ReAct Research Agent** - Iterative tool use (search, extract, validate)
- **Chain-of-Thought Prompting** - Explicit reasoning for match decisions
- **Few-shot Examples** - Guides LLM behavior with examples
- **Smart Context Management** - Truncates content to prevent token overflow
- **Early Stopping** - Stops research as soon as valid job found

### **🏗️ Architecture**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      LANGGRAPH EMAIL WORKFLOW                          │
│                                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────┐        │
│  │  Clean   │──▶│   Analyze    │──▶│ Research │──▶│Re-Evaluate│──▶END  │
│  │  Email   │   │    Email     │   │  (ReAct) │   │           │        │
│  └──────────┘   └──────────────┘   └──────────┘   └───────────┘        │
│       │               │                 │                │              │
│   HTML→Text    Jobs + Matches    Web Research      Verify Matches       │
└─────────────────────────────────────────────────────────────────────────┘
```

### **🤖 ReAct Research Agent**

The research agent iteratively reasons and acts:

1. **Think** - "I need to find the job at Danske Bank..."
2. **Act** - Use `smart_job_search` or `tavily_extract`
3. **Observe** - Check result, validate it's the correct job
4. **Repeat** - Until found or strategies exhausted

**Key behaviors:**
- Never gives up after first attempt
- Tries company career pages, job boards, alternative titles
- Validates: company match? position match? correct location? real posting?
- Avoids LinkedIn (requires auth)

### **📊 Debugging & Monitoring**

- **Debug logs** saved to `debug-langchain-runs/` for each email
- Full transparency into agent reasoning
- Per-job research logs with tool calls
- Processing time and iteration tracking

### **📚 Knowledge Base System**

- Upload documents (PDFs) with drag & drop interface
- Page-level extraction - "First X pages", "Last X pages", custom ranges
- RAG integration for semantic search across all documents
- Strategy pattern architecture for easy extensibility

### **🔍 Hybrid Search & AI Chat**

- **True Hybrid Search** - Combines semantic (vector) + full-text (keyword) with RRF
- **Global Chat Widget** - Search across KBs and emails from any page
- **Multi-Intent Queries** - AI generates parallel searches for complex queries

## 🚀 How It Works

### **5-Node LangGraph Pipeline**

```
START → cleanEmail → analyzeEmail → [conditional] → research → reEvaluate → END
                                  ↘ (no matches) → END
```

1. **Clean Email** - HTML → Plain text conversion
2. **Analyze Email** - Extract jobs, determine matches with chain-of-thought reasoning
3. **Research** - ReAct agent finds public job descriptions (parallel batches)
4. **Re-Evaluate** - Verify matches using full job descriptions
5. **Output** - Final job list with research results

### **Example: LinkedIn Job Email → ReAct Research**

```typescript
// Problem: LinkedIn URL requires authentication
Email contains: "Backend Developer at Danske Bank - København"
Original URL: linkedin.com/jobs/view/123456?otpToken=xyz (blocked!)

// Solution: ReAct Research Agent
Agent Thought: "LinkedIn is blocked, I'll search for the job on company career page"
Agent Action: smart_job_search({ company: "Danske Bank", position: "Backend Developer" })
Agent Observation: Found careers.danskebank.dk/job/backend-developer-123

Agent Thought: "Found a career page URL, let me extract the content"
Agent Action: tavily_extract({ url: "careers.danskebank.dk/job/..." })
Agent Observation: [Full job description extracted]

Agent Thought: "Validating... Company: ✅ Danske Bank, Position: ✅ Backend Developer, Location: ✅ København"
Agent Result: FOUND - Full job description with requirements, technologies, deadline
```

## 🛠️ Tech Stack

### **Core Framework**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety throughout
- **Server Actions** - For email analysis triggers

### **AI & LangChain**
- **LangGraph** - StateGraph for workflow orchestration
- **LangChain** - ReAct agents with tool use
- **OpenAI GPT-4o-mini** - Content analysis and reasoning
- **Tavily API** - Web search and content extraction

### **Database & Auth**
- **Supabase** - PostgreSQL with Row Level Security
- **Vector embeddings** - Semantic search with pgvector

### **External Services**
- **Microsoft Graph API** - Email fetching
- **Tavily** - Advanced web search & extraction

### **UI Components**
- **Shadcn UI** - Accessible component library
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Icon system

## 📁 Project Structure

```
lib/
├── langchain/                    # ⭐ NEW - LangGraph email workflow
│   ├── email-workflow.ts         # Main StateGraph definition
│   ├── types.ts                  # TypeScript interfaces
│   ├── index.ts                  # Exports
│   │
│   ├── nodes/                    # Workflow nodes
│   │   ├── clean-email.ts        # HTML → plain text
│   │   ├── analyze-email.ts      # Job extraction + matching
│   │   ├── research.ts           # Orchestrates research agent
│   │   ├── re-evaluate.ts        # Verify matches with full descriptions
│   │   └── aggregate.ts          # Finalize results
│   │
│   ├── agents/
│   │   └── research-agent.ts     # ReAct agent for web research
│   │
│   ├── tools/                    # Tavily tools
│   │   ├── tavily-search.ts      # Web search + smart job search
│   │   └── tavily-extract.ts     # Page extraction with truncation
│   │
│   ├── configs/
│   │   └── job-search-config.ts  # Match criteria, prompts, examples
│   │
│   └── utils/
│       ├── debug-logger.ts       # Debug file logging
│       └── content-trimmer.ts    # Smart content truncation
│
├── microsoft-graph/              # Email fetching
│   └── client.ts                 # Microsoft Graph API client
│
├── document-processing/          # Document upload & processing
│   ├── processor.ts              # Main orchestrator
│   └── strategies/               # PDF, Text strategies
│
├── embeddings/                   # OpenAI embeddings & hybrid search
├── auto-search/                  # Automated KB search
└── chat-search/                  # AI Chat system

components/
├── chat/                         # Global chat widget
│   ├── chat-provider.tsx         # React context for chat state
│   └── global-chat-widget.tsx    # Floating widget UI

app/
├── dashboard/
│   ├── components/               # Agent configuration UI
│   ├── emails/                   # Email browser & analysis trigger
│   │   └── actions.ts            # Server action for LangChain workflow
│   ├── knowledge-base/           # Document upload & management
│   └── results/                  # Analysis results with split-panel view
│       ├── page.tsx              # Resizable panels
│       └── components/
│           ├── result-card.tsx   # Job cards with details
│           ├── email-preview-panel.tsx  # Email content preview
│           └── debug-modal.tsx   # Raw data inspector

debug-langchain-runs/             # Debug logs for each analysis run
└── 2025-12-21T.../
    ├── _session.json
    ├── _summary.json
    ├── 01_workflow_start.json
    └── research_*.json           # Per-job research logs
```

## 🎨 Design Patterns

### **LangGraph StateGraph** (Workflow Orchestration)
```typescript
const workflow = new StateGraph(EmailWorkflowAnnotation)
  .addNode('cleanEmail', cleanEmailNode)
  .addNode('analyzeEmail', analyzeEmailNode)
  .addNode('research', researchNode)
  .addNode('reEvaluate', reEvaluateNode)
  .addEdge(START, 'cleanEmail')
  .addConditionalEdges('analyzeEmail', (state) => 
    state.hasMatches ? 'research' : END
  )
  .addEdge('research', 'reEvaluate')
  .addEdge('reEvaluate', END)
```

### **ReAct Agent** (Iterative Tool Use)
```typescript
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [smartJobSearchTool, tavilyExtractTool],
  messageModifier: researchSystemPrompt,
})

// Agent iteratively thinks and acts
const result = await agent.invoke({
  messages: [new HumanMessage(`Find job: ${job.position} at ${job.company}`)]
})
```

### **Configuration-Driven Prompts**
```typescript
// All prompts configured in job-search-config.ts
export const JOB_SEARCH_CONFIG = {
  matchCriteria: "...",      // What jobs to match
  extractionFields: "...",   // What data to extract
  research: {
    maxIterations: 8,        // Max agent iterations
    preferredDomains: [...], // jobindex.dk, karriere.dk
    avoidDomains: [...],     // linkedin.com (blocked)
  }
}
```

## 📖 Documentation

### **[🔗 LangChain Email Analysis Workflow](Important%20documentation/6%20.%20LangChain%20Email%20Analysis%20Workflow.md)** ⭐ NEW

Comprehensive LangGraph documentation:
- Full workflow architecture with diagrams
- ReAct research agent explanation
- Tool definitions and usage
- Context management strategies
- Debug logging system
- Future improvements and comparison with deep agents

### **[📚 Knowledge Base Document Upload System](Important%20documentation/3%20.%20Knowledge%20Base%20Document%20Upload%20System.md)**

Document processing architecture:
- Strategy Pattern implementation for extensibility
- Page-level PDF extraction (First X, Last X, custom ranges)
- Batch upload with drag & drop interface
- Configuration system and workflow options
- Database schema and security policies
- Technical decisions and future roadmap

### **[🔍 Hybrid Search & Chat System](Important%20documentation/4%20.%20Hybrid%20Search%20&%20Chat%20System.md)** ⭐ NEW

Search and chat architecture:
- True Hybrid Search with Reciprocal Rank Fusion (RRF)
- Global chat widget implementation
- Automated KB search pipeline (Step 8)
- Multi-intent query strategies (single, multi_intent, ai_powered)
- PostgreSQL full-text search + vector similarity
- Tool pattern for chat search capabilities

### **[🚀 Future Architecture & Deep Research](Important%20documentation/5%20.%20Future%20Architecture%20&%20Deep%20Research.md)** ⭐ NEW

Vision and roadmap:
- Multi-agent architecture patterns
- Deep research with sub-agents
- Tool-based AI systems (LangChain concepts)
- Configuration optimization with presets
- Draft generation from KB documents
- Implementation priorities and timeline

## 🔧 Setup

### **Prerequisites**
- Node.js 18+
- Supabase account
- API keys for: OpenAI, Tavily, Microsoft Graph

### **Environment Variables**

Create `.env.local` with:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI & LangChain
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key

# Microsoft Graph (for email access)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id

# Debug (saves workflow logs to debug-langchain-runs/)
EMAIL_ANALYSIS_DEBUG=true
```

### **Installation**

```bash
# Install dependencies
npm install

# Run database migrations
npx supabase migration up

# Start development server
npm run dev
```

## 🎯 Use Cases

### **1. Job Hunting Automation** ⭐ Primary Use Case

- Analyze job agent emails (JobIndex, LinkedIn, IT-Jobbank)
- **ReAct agent** finds public job descriptions even when LinkedIn URLs are blocked
- Match jobs against your criteria (technologies, experience level, location)
- Re-evaluate matches using full job descriptions
- Extract: technologies, requirements, deadlines, salary, work type
- **Result:** Find relevant jobs with full descriptions, without manual clicking

### **2. Newsletter Analysis**
- Extract key points from tech newsletters
- Track topics of interest
- Build knowledge base from articles
- **Result:** Stay informed without reading everything

### **3. Content Extraction**
- Extract structured data from any email type
- Custom extraction fields per agent
- **Result:** Turn unstructured emails into structured data

## 📊 Performance

### **LangChain Workflow Performance**

| Metric | Typical Value | Notes |
|--------|---------------|-------|
| Total workflow time | 30-90 seconds | Depends on job count |
| Jobs per email | 1-65 | Job board emails can be large |
| Research per job | 5-15 seconds | 2-8 agent iterations |
| Context tokens | 80k-120k | Managed with smart truncation |

### **Scalability**
- Parallel job research (3 concurrent)
- Smart content truncation prevents token overflow
- Early stopping reduces unnecessary iterations
- Debug logging for monitoring and optimization

## 🚧 Future Enhancements

### **LangChain Email Analysis**
- [x] ✅ LangGraph StateGraph orchestration
- [x] ✅ ReAct research agent with iterative tool use
- [x] ✅ Chain-of-thought prompting with few-shot examples
- [x] ✅ Smart content truncation (keep start + end)
- [x] ✅ Re-evaluation with full job descriptions
- [x] ✅ LLM-based job validation (no hardcoding)
- [x] ✅ Comprehensive debug logging
- [ ] Result caching for repeated jobs
- [ ] LangChain middleware for automatic context management
- [ ] User feedback loop for prompt improvement
- [ ] Streaming UI updates during workflow

### **Deep Agents (Future Consideration)**
- [ ] Multi-agent architecture (supervisor + sub-agents)
- [ ] Specialized agents for different research strategies
- [ ] Automatic agent orchestration for complex tasks
- [ ] Tool use learning from feedback

### **Knowledge Base System**
- [x] ✅ PDF upload with page-level extraction
- [x] ✅ Batch processing with drag & drop
- [x] ✅ RAG integration for semantic search
- [ ] Draft cover letter generator (from KB + job match)
- [ ] DOCX support
- [ ] OCR for scanned PDFs and images

### **Search & Chat System**
- [x] ✅ True hybrid search (RRF combining semantic + keyword)
- [x] ✅ Global chat widget accessible from any page
- [x] ✅ Multi-intent query strategies
- [ ] Draft generation from matched jobs + KB
- [ ] User preference learning from feedback

## 📝 License

This project is for portfolio/CV purposes.

## 🤝 Contact

Built by **Henrik Fogbunzel**

For questions or collaboration opportunities, please reach out via [GitHub](https://github.com/henrikfogbunzel).

---

⭐ If you find this project interesting, please star it on GitHub!
