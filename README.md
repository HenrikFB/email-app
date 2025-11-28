# 📧 AI-Powered Email Analysis System

> A production-grade email analysis pipeline that extracts structured data from emails using AI, web scraping, and intelligent content discovery.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)

## 🎯 Overview

An intelligent email analysis system with AI-powered knowledge base that automatically:
- 📨 Fetches and analyzes emails from Microsoft Graph API
- 🔗 Extracts and prioritizes links using AI
- 🌐 Retrieves content via multiple strategies (scraping, web search, intelligent discovery)
- 🧠 Extracts structured data matching user-defined criteria
- 📊 Provides source attribution and confidence scoring
- 📚 Manages document uploads (PDFs) with page-level extraction and semantic search
- 🔍 **Hybrid search** combining semantic + keyword matching with RRF ranking
- 💬 **Global AI chat** for searching across all data sources
- 🔄 **Automated KB search** when emails match criteria

**Built for:** Job hunting automation, newsletter analysis, content extraction, and knowledge management.

## ✨ Key Features

### **🏗️ Architecture**
- **Strategy Pattern** for content retrieval (4 strategies: scrape, search, hybrid, intelligent discovery)
- **Factory Pattern** for strategy selection
- **Low coupling** design - easily extensible without modifying core logic
- **Configuration-driven** - no code changes needed for new use cases

### **🤖 AI-Powered**
- OpenAI GPT-4 for content analysis and extraction
- Intelligent link prioritization based on context
- Intent extraction from email content
- Automatic chunking for large content

### **🔍 Smart Content Retrieval**
1. **Direct Scraping** (`scrape_only`) - Fast scraping with Firecrawl
2. **Web Search** (`search_only`) - Tavily web search for research
3. **Hybrid** (`scrape_and_search`) - Both scraping + search for maximum coverage
4. **Intelligent Discovery** (`intelligent_discovery`) ⭐ - Finds alternative public sources when original URLs are inaccessible (e.g., expired LinkedIn tokens)

### **📊 Debugging & Monitoring**
- Comprehensive debug logging for each analysis step
- Full transparency into AI decision-making
- Performance tracking and cost analysis
- Structured debug output for easy troubleshooting

### **📚 Knowledge Base System**
- Upload documents (PDFs) with drag & drop interface
- Page-level extraction - "First X pages", "Last X pages", custom ranges
- Batch processing with auto-save or review workflows
- Edit and reprocess documents with different settings
- RAG integration for semantic search across all documents
- Strategy pattern architecture for easy extensibility (DOCX, OCR coming soon)

### **🔍 Hybrid Search & AI Chat** ⭐ NEW
- **True Hybrid Search** - Combines semantic (vector) + full-text (keyword) with Reciprocal Rank Fusion
- **Global Chat Widget** - Search across KBs and emails from any page
- **Highlighted Snippets** - See matching keywords in context
- **Multi-Intent Queries** - AI generates parallel searches for complex queries
- **Automated KB Search** - Automatically search when emails match
- **3 Search Strategies**: Single query, Multi-intent (split by field), AI-powered (LLM generates optimal queries)

## 🚀 How It Works

```
📧 Email → Extract Links → AI Prioritization → Content Retrieval → AI Analysis → Structured Data
```

### **8-Step Pipeline**

1. **Fetch Email** - Retrieve from Microsoft Graph API
2. **Extract Links** - Parse HTML and identify all links (with button detection)
3. **AI Prioritization** - Intelligently select most relevant links
4. **Content Retrieval** - Fetch content using selected strategy
5. **Email Analysis** - Extract data from email body
6. **Page Analysis** - Extract data from scraped pages (parallel)
7. **Aggregation** - Combine and score results
8. **Auto KB Search** ⭐ - Search knowledge bases for related content (configurable)

### **Example: LinkedIn Job Email with Expired Token**

```typescript
// Problem: LinkedIn otpToken expired → redirects to login
Original URL: linkedin.com/jobs/view/123456?otpToken=xyz

// Solution: intelligent_discovery strategy
1. Extract context: "Software Developer BD Energy · Aarhus"
2. Search web: "Software Developer BD Energy Aarhus"
3. Find alternatives:
   - bdenergy.dk/careers/... (company page) ✅
   - jobindex.dk/... (job board)
   - dk.linkedin.com/... (still blocked)
4. Scrape best alternative → Success!
```

## 🛠️ Tech Stack

### **Frontend & Backend**
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety throughout
- **Server Actions** - For email analysis triggers

### **Database & Auth**
- **Supabase** - PostgreSQL with Row Level Security
- **Prisma-like queries** - Type-safe database access

### **AI & External Services**
- **OpenAI GPT-4** - Content analysis and extraction
- **Firecrawl** - Web scraping to markdown
- **Tavily** - Advanced web search
- **Microsoft Graph API** - Email fetching

### **UI Components**
- **Shadcn UI** - Accessible component library
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Icon system

## 📁 Project Structure

```
lib/
├── email-analysis/          # Core pipeline
│   ├── orchestrator.ts      # Main coordinator (8-step pipeline)
│   ├── link-extractor.ts    # HTML parsing & link extraction
│   ├── link-prioritization.ts  # AI link ranking
│   ├── full-context-analyzer.ts  # AI content analysis
│   ├── aggregator.ts        # Result combination
│   └── debug-logger.ts      # Comprehensive logging
│
├── content-retrieval/       # Strategy Pattern implementation
│   ├── types.ts             # ContentRetriever interface
│   ├── factory.ts           # Strategy factory
│   ├── firecrawl-retriever.ts
│   ├── tavily-retriever.ts
│   ├── hybrid-retriever.ts
│   └── intelligent-discovery-retriever.ts  ⭐
│
├── document-processing/     # Document upload & processing
│   ├── processor.ts         # Main orchestrator
│   ├── strategies/          # PDF, Text strategies (DOCX, OCR coming)
│   ├── config/              # Configuration merging
│   └── storage/             # Supabase Storage integration
│
├── auto-search/             # Automated KB search ⭐ NEW
│   ├── types.ts             # SearchMode, SearchIntent types
│   ├── service.ts           # Main orchestrator
│   ├── factory.ts           # Strategy factory
│   └── strategies/          # Single, MultiIntent, AIPowered
│
├── chat-search/             # AI Chat system ⭐ NEW
│   ├── types.ts             # Tool interfaces
│   └── tools/               # KBSearchTool, EmailSearchTool
│
├── embeddings/              # OpenAI embeddings & hybrid search
├── firecrawl/               # Firecrawl API client
├── tavily/                  # Tavily API client
├── openai/                  # OpenAI API client
└── graph/                   # Microsoft Graph client

components/
├── chat/                    # Global chat widget ⭐ NEW
│   ├── chat-provider.tsx    # React context for chat state
│   └── global-chat-widget.tsx # Floating widget UI

app/
├── dashboard/
│   ├── components/          # Agent configuration UI
│   ├── emails/              # Email management
│   ├── knowledge-base/      # Document upload & management
│   └── results/             # Analysis results display

supabase/
└── migrations/              # Database schema
    ├── 021_add_automation_fields.sql
    ├── 022_implement_true_hybrid_search.sql  # RRF search
    ├── 023_add_search_snippets.sql
    └── 024_add_multi_intent_search.sql
```

## 🎨 Design Patterns

### **Strategy Pattern** (Content Retrieval)
```typescript
interface ContentRetriever {
  retrieve(url: string, context?: RetrievalContext): Promise<ContentRetrievalResult>
}

// All strategies implement same interface
class FirecrawlRetriever implements ContentRetriever { ... }
class IntelligentDiscoveryRetriever implements ContentRetriever { ... }

// Orchestrator uses interface, not concrete classes (low coupling!)
const retriever = createContentRetriever(strategy)
```

### **Factory Pattern** (Strategy Selection)
```typescript
export function createContentRetriever(strategy: ContentRetrievalStrategy): ContentRetriever {
  switch (strategy) {
    case 'scrape_only': return new FirecrawlRetriever()
    case 'intelligent_discovery': return new IntelligentDiscoveryRetriever()
    // Add new strategies without changing orchestrator!
  }
}
```

### **Configuration-Driven Architecture**
- All behavior controlled by database config
- No code changes for new use cases
- Per-user customization
- A/B testing support

## 📖 Documentation

### **[📊 Complete Email Analysis Architecture](Important%20documentation/2%20.%20Complete%20Email%20Analysis%20Architecture.md)**

Comprehensive documentation covering:
- Full pipeline explanation with diagrams
- All 4 content retrieval strategies with use cases
- Architecture patterns and design decisions
- File structure and key functions
- Debugging guide
- Strategy selection decision tree

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
- API keys for: OpenAI, Firecrawl, Tavily, Microsoft Graph

### **Environment Variables**

Create `.env.local` with:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI & Services
OPENAI_API_KEY=your_openai_key
FIRECRAWL_API_KEY=your_firecrawl_key
TAVILY_API_KEY=your_tavily_key

# Microsoft Graph (for email access)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id

# Debug
EMAIL_ANALYSIS_DEBUG=true  # Enable detailed logging
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

### **1. Job Hunting Automation**
- Analyze job agent emails (JobIndex, LinkedIn, etc.)
- Extract: technologies, requirements, deadlines, locations
- Match against your criteria automatically
- **Result:** Find relevant jobs without manual filtering

### **2. Newsletter Analysis**
- Extract key points from tech newsletters
- Track topics of interest
- Build knowledge base from articles
- **Result:** Stay informed without reading everything

### **3. Content Extraction**
- Extract structured data from any email type
- Support for attachments and external links
- Custom extraction fields per agent
- **Result:** Turn unstructured emails into structured data

## 📊 Performance

### **Strategy Comparison**

| Strategy | Speed | Cost | Use Case |
|----------|-------|------|----------|
| `scrape_only` | Fast | Low | Public URLs |
| `search_only` | Fastest | Low | Research |
| `scrape_and_search` | Slow | High | Maximum coverage |
| `intelligent_discovery` | Medium | Medium | Gated content |

### **Scalability**
- Parallel page analysis
- Configurable rate limits
- Debug logging for monitoring
- Efficient chunking for large content

## 🚧 Future Enhancements

### **Email Analysis**
- [ ] Cache Tavily search results
- [ ] Learn from successful discoveries
- [ ] Multi-agent deep research (orchestrator + sub-agents)
- [ ] Custom pipelines for specific email types
- [ ] Webhook support for real-time analysis

### **Knowledge Base System**
- [x] ✅ PDF upload with page-level extraction
- [x] ✅ Batch processing with drag & drop
- [x] ✅ RAG integration for semantic search
- [ ] DOCX support
- [ ] OCR for scanned PDFs and images
- [ ] Table extraction (preserve structure)
- [ ] Auto-tagging based on content
- [ ] Duplicate detection (semantic similarity)

### **Search & Chat System** ⭐ NEW
- [x] ✅ True hybrid search (RRF combining semantic + keyword)
- [x] ✅ Global chat widget accessible from any page
- [x] ✅ Search both KBs and analyzed emails
- [x] ✅ Highlighted snippets with keyword matches
- [x] ✅ Automated KB search on email match
- [x] ✅ Multi-intent query strategies (single, multi_intent, ai_powered)
- [ ] Draft cover letter generator (from KB + job match)
- [ ] User preference learning from feedback
- [ ] Proactive notifications for deadlines
- [ ] Market intelligence insights

## 📝 License

This project is for portfolio/CV purposes.

## 🤝 Contact

Built by **Henrik Fogbunzel**

For questions or collaboration opportunities, please reach out via [GitHub](https://github.com/henrikfogbunzel).

---

⭐ If you find this project interesting, please star it on GitHub!
