/**
 * Seed Database Script
 * 
 * Populates the database with realistic end-to-end data for two use cases:
 * 1. Jobs Search - Software development job applications
 * 2. Finance - Investment opportunities and financial news
 * 
 * Usage:
 *   Set environment variables:
 *     OPENAI_API_KEY=your_key
 *     NEXT_PUBLIC_SUPABASE_URL=your_url
 *     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 * 
 *   Run: npx tsx scripts/seed-database.ts
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Constants
const USER_ID = 'acfb6765-3f43-41d0-8647-887379341f57'

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n⚠️  IMPORTANT: You need the SERVICE_ROLE_KEY (not anon key) to bypass RLS for seeding.')
  console.error('\nTo get it:')
  console.error('   1. Go to Supabase Dashboard → Settings → API')
  console.error('   2. Copy the "service_role" key (it\'s secret, starts with "eyJ...")')
  console.error('   3. Add it to .env.local as: SUPABASE_SERVICE_ROLE_KEY=your_key')
  console.error('\nMake sure .env.local exists with these variables.')
  process.exit(1)
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing required environment variable:')
  console.error('   OPENAI_API_KEY')
  console.error('\nMake sure .env.local exists with OPENAI_API_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper function to generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.substring(0, 8000)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: truncatedText,
  })
  return response.data[0].embedding
}

// Helper function to chunk text
function chunkText(text: string, chunkSize: number = 1000): string[] {
  if (!text || text.length === 0) return []
  
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      if (paragraph.length > chunkSize) {
        for (let i = 0; i < paragraph.length; i += chunkSize) {
          chunks.push(paragraph.substring(i, i + chunkSize).trim())
        }
      } else {
        currentChunk = paragraph
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

// Fixed UUIDs for idempotency
const UUIDs = {
  // Agent Configs
  agentConfigJobs: '11111111-1111-1111-1111-111111111111',
  agentConfigFinance: '22222222-2222-2222-2222-222222222222',
  
  // Knowledge Bases - Jobs
  kbOldJobDescriptions: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  kbCoverLetters: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  
  // Knowledge Bases - Finance
  kbInvestmentHistory: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  kbFinancialReports: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  
  // Email Connection
  emailConnection: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
}

console.log('🌱 Starting database seed...\n')

async function seed() {
  try {
    // ============================================
    // 1. CREATE AGENT CONFIGURATIONS
    // ============================================
    console.log('📋 Creating agent configurations...')
    
    const agentConfigs = [
      {
        id: UUIDs.agentConfigJobs,
        user_id: USER_ID,
        name: 'Jobs - Software Developer',
        email_address: 'jobs@example.com',
        match_criteria: 'Software development positions requiring .NET, C#, Python, SQL, or automation/RPA technologies. Focus on healthcare, public sector, or fintech domains.',
        extraction_fields: 'technologies, domain, location, company, salary_range, deadline, required_experience, competencies',
        follow_links: true,
        button_text_pattern: 'Se jobbet|View Job|Apply Now|Ansøg nu',
        analyze_attachments: false,
        user_intent: 'I want to track .NET and Python developer jobs in healthcare or fintech with 3-5 years experience requirement. I am particularly interested in RPA/automation roles.',
        link_selection_guidance: 'Job link titles are often generic like "Software Developer" or "IT Position" - the specific technologies (.NET, Python, RPA) are usually inside the job descriptions, not in the link text.',
        max_links_to_scrape: 8,  // Job emails can have 50-200 links, but only 3-8 are usually real job postings
        content_retrieval_strategy: 'search_only',  // LinkedIn job links require auth, use web search to find public postings
        extraction_examples: '{"technologies": [".NET", "C#", "Python", "SQL Server"], "location": "Copenhagen", "experience": "3-5 years", "domain": "Healthcare"}',
        analysis_feedback: 'Works well for LinkedIn job emails. Sometimes includes PLC/SCADA jobs which I don\'t want - need better filtering for industrial/hardware roles.',
      },
      {
        id: UUIDs.agentConfigFinance,
        user_id: USER_ID,
        name: 'Finance - Tech Investments',
        email_address: 'investments@example.com',
        match_criteria: 'Investment opportunities in technology sector, equity investments between €500K-€5M, early-stage startups, fintech companies',
        extraction_fields: 'sector, investment_type, amount_range, company_stage, valuation, expected_return, deadline, risk_level',
        follow_links: true,
        button_text_pattern: 'Learn More|View Details|Invest Now',
        analyze_attachments: false,
        user_intent: 'I want to identify early-stage tech investment opportunities in fintech and healthcare sectors. Looking for equity deals between €500K-€5M with strong growth potential.',
        link_selection_guidance: 'Investment opportunity links often say "Learn More" or "View Details" - the specific sector (fintech, healthcare) and amounts are inside the pages, not in link text.',
        max_links_to_scrape: 12,  // Investment emails may have multiple opportunities worth exploring
        content_retrieval_strategy: 'scrape_and_search',  // Use both for comprehensive due diligence
        extraction_examples: '{"sector": "Fintech", "investment_type": "Series A Equity", "amount_range": "€2M-€3M", "company_stage": "Early-stage", "expected_return": "3-5x in 4-6 years"}',
        analysis_feedback: null,  // No specific feedback yet
      }
    ]
    
    for (const config of agentConfigs) {
      const { error } = await supabase
        .from('agent_configurations')
        .upsert(config, { onConflict: 'id' })
      
      if (error) {
        console.error(`   ❌ Error creating agent config ${config.email_address}:`, error)
      } else {
        console.log(`   ✅ Created agent config: ${config.email_address}`)
      }
    }
    
    // ============================================
    // 2. CREATE KNOWLEDGE BASES
    // ============================================
    console.log('\n📚 Creating knowledge bases...')
    
    const knowledgeBases = [
      {
        id: UUIDs.kbOldJobDescriptions,
        user_id: USER_ID,
        name: 'Old Job Descriptions',
        description: 'Archive of previous job descriptions I applied to',
        type: 'manual',
        optimization_context: 'Focus on extracting technologies, required experience, and domain expertise',
        is_dynamic: false,
      },
      {
        id: UUIDs.kbCoverLetters,
        user_id: USER_ID,
        name: 'Cover Letters Archive',
        description: 'My previous cover letters for reference',
        type: 'manual',
        optimization_context: 'Extract key competencies, technologies mentioned, and how I positioned my experience',
        is_dynamic: false,
      },
      {
        id: UUIDs.kbInvestmentHistory,
        user_id: USER_ID,
        name: 'Investment History',
        description: 'Notes on previous investments and opportunities',
        type: 'manual',
        optimization_context: 'Focus on sector, investment type, amounts, and outcomes',
        is_dynamic: false,
      },
      {
        id: UUIDs.kbFinancialReports,
        user_id: USER_ID,
        name: 'Financial Reports',
        description: 'Summaries of financial reports and market analysis',
        type: 'manual',
        optimization_context: 'Extract key metrics, trends, and investment insights',
        is_dynamic: false,
      }
    ]
    
    for (const kb of knowledgeBases) {
      const { error } = await supabase
        .from('knowledge_bases')
        .upsert(kb, { onConflict: 'id' })
      
      if (error) {
        console.error(`   ❌ Error creating KB ${kb.name}:`, error)
      } else {
        console.log(`   ✅ Created KB: ${kb.name}`)
      }
    }
    
    // ============================================
    // 3. CREATE KB DOCUMENTS
    // ============================================
    console.log('\n📄 Creating KB documents...')
    
    const kbDocuments = [
      // Old Job Descriptions
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbOldJobDescriptions,
        title: 'Senior Backend Developer - Netcompany',
        type: 'text_note',
        content: `Senior Backend Developer til egenudviklede løsninger

Vi søger en alsidig backend udvikler til opgaver indenfor både RPA, front-end- og back-end-udvikling. 

Teknologier:
- .NET (C#)
- Python
- SQL Server
- UiPath (RPA)
- React (frontend)

Domæne: Sundhedsvæsenet, offentlig sektor
Lokation: Aarhus, Danmark
Erfaring: Minimum 3 års erfaring med .NET og Python

Du kommer til at arbejde med:
- Løsningsdesign, udvikling og test af RPA-løsninger i UiPath og/eller Python
- Backend udvikling af nye projekter der bliver egenudviklet
- Frontend udvikling i React

Det er vigtigt, at du har kompetencer indenfor frontend og backend-udvikling og erfaring med Scrum eller lignende arbejdsmetoder.`,
        notes: 'Applied in November 2024. Strong match for my .NET and Python experience.',
        optimization_hints: 'Focus on .NET, Python, RPA, and healthcare domain',
        extraction_guidelines: 'Extract: technologies (.NET, C#, Python, SQL, UiPath), domain (healthcare, public sector), location (Aarhus)',
        context_tags: ['backend', 'rpa', 'healthcare', 'public-sector', 'netcompany'],
      },
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbOldJobDescriptions,
        title: 'Full Stack Developer - Systematic',
        type: 'text_note',
        content: `Full Stack Developer - Systematic A/S

Vi søger en erfaren full stack udvikler til vores team i Aarhus.

Teknologier:
- C# (.NET Core)
- TypeScript/JavaScript
- SQL
- Azure
- Docker

Domæne: Forsvarsindustrien, sikkerhedskritiske systemer
Lokation: Aarhus, Danmark
Erfaring: 5+ års erfaring med .NET og web development

Opgaver:
- Udvikling af full stack løsninger
- Design og implementering af API'er
- Database design og optimering
- DevOps og CI/CD pipelines

Vi søger en udvikler med stærke tekniske færdigheder og erfaring med komplekse systemer.`,
        notes: 'Applied in October 2024. Good match for full stack .NET experience.',
        optimization_hints: 'Focus on .NET, TypeScript, Azure, and defense domain',
        extraction_guidelines: 'Extract: technologies (.NET, C#, TypeScript, SQL, Azure), domain (defense, security-critical)',
        context_tags: ['fullstack', 'net', 'azure', 'defense', 'systematic'],
      },
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbOldJobDescriptions,
        title: 'Backend Developer - Danske Bank',
        type: 'text_note',
        content: `Backend Developer - Danske Bank

Vi søger en backend udvikler til vores digitaliseringsteam.

Teknologier:
- Java
- Spring Boot
- SQL
- Kafka
- Kubernetes

Domæne: Fintech, banking
Lokation: København, Danmark
Erfaring: 3+ års erfaring med Java og microservices

Du kommer til at arbejde med:
- Microservices arkitektur
- Event-driven systemer
- API udvikling
- Cloud native løsninger

Vi søger en udvikler med erfaring i finanssektoren og interesse for moderne teknologi.`,
        notes: 'Applied in September 2024. Good match but prefer .NET over Java.',
        optimization_hints: 'Focus on Java, Spring, fintech domain',
        extraction_guidelines: 'Extract: technologies (Java, Spring Boot, SQL, Kafka), domain (fintech, banking)',
        context_tags: ['backend', 'java', 'fintech', 'banking', 'danske-bank'],
      },
      
      // Cover Letters
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbCoverLetters,
        title: 'Cover Letter - Netcompany Position',
        type: 'text_note',
        content: `Kære Netcompany,

Jeg søger stillingen som Senior Backend Developer, da jeg ser en perfekt match mellem mine kompetencer og jeres behov.

Mine stærke kompetencer:
- 5+ års erfaring med .NET (C#) og Python
- Omfattende erfaring med RPA og automatisering (UiPath)
- Stærk backend udvikling med SQL Server
- Erfaring med sundhedsvæsenet og offentlig sektor

Jeg har arbejdet med lignende projekter og har en dyb forståelse for komplekse systemer. Jeg trives i et agilt miljø og er vant til Scrum.

Jeg ser frem til at høre fra jer.

Venlig hilsen,
[Your Name]`,
        notes: 'Cover letter for Netcompany backend developer position',
        optimization_hints: 'Focus on .NET, Python, RPA, healthcare experience',
        extraction_guidelines: 'Extract: technologies mentioned, years of experience, domain expertise',
        context_tags: ['cover-letter', 'netcompany', 'backend', 'rpa'],
      },
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbCoverLetters,
        title: 'Cover Letter - Systematic Position',
        type: 'text_note',
        content: `Kære Systematic,

Jeg er meget interesseret i stillingen som Full Stack Developer hos jer.

Mine kompetencer:
- 6+ års erfaring med .NET og C#
- Stærk TypeScript/JavaScript erfaring
- Azure cloud services
- Docker og containerization
- Erfaring med sikkerhedskritiske systemer

Jeg har en passion for at bygge robuste, skalerbare løsninger og trives i et team-orienteret miljø. Jeg er interesseret i forsvarsindustrien og ser en spændende udfordring i jeres projekter.

Jeg håber på at høre fra jer.

Venlig hilsen,
[Your Name]`,
        notes: 'Cover letter for Systematic full stack position',
        optimization_hints: 'Focus on .NET, TypeScript, Azure, defense domain',
        extraction_guidelines: 'Extract: technologies, years of experience, domain (defense)',
        context_tags: ['cover-letter', 'systematic', 'fullstack', 'defense'],
      },
      
      // Investment History
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbInvestmentHistory,
        title: 'Tech Startup Investment - Q3 2024',
        type: 'text_note',
        content: `Investment Opportunity: Fintech Startup

Sector: Financial Technology
Investment Type: Equity
Amount: €750,000
Company Stage: Series A
Valuation: €8M pre-money
Expected Return: 3-5x over 5 years
Risk Level: Medium-High

Company: Payment processing platform for SMEs
Technology: Cloud-native, microservices architecture
Market: European market, focusing on Denmark and Sweden

Notes: Strong team with fintech experience. Good product-market fit. Competitive market but strong differentiation.`,
        notes: 'Evaluated in Q3 2024, decided not to invest due to high competition',
        optimization_hints: 'Focus on sector (fintech), investment type (equity), amount, stage',
        extraction_guidelines: 'Extract: sector, investment_type, amount, company_stage, valuation, expected_return',
        context_tags: ['investment', 'fintech', 'equity', 'series-a'],
      },
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbInvestmentHistory,
        title: 'Healthcare Tech Investment - Q2 2024',
        type: 'text_note',
        content: `Investment Opportunity: Healthcare Technology

Sector: Healthcare Technology
Investment Type: Equity
Amount: €1.2M
Company Stage: Seed
Valuation: €4M pre-money
Expected Return: 5-7x over 7 years
Risk Level: High

Company: AI-powered diagnostic platform for hospitals
Technology: Machine learning, cloud infrastructure
Market: European healthcare market

Notes: Innovative technology with strong clinical validation. Long sales cycles in healthcare but high barriers to entry.`,
        notes: 'Invested in Q2 2024. Strong potential but long-term play.',
        optimization_hints: 'Focus on healthcare tech, seed stage, AI/ML',
        extraction_guidelines: 'Extract: sector (healthcare tech), investment_type, amount, stage (seed)',
        context_tags: ['investment', 'healthcare', 'ai', 'seed'],
      },
      
      // Financial Reports
      {
        id: randomUUID(),
        user_id: USER_ID,
        knowledge_base_id: UUIDs.kbFinancialReports,
        title: 'Q4 2024 Tech Sector Analysis',
        type: 'text_note',
        content: `Q4 2024 Technology Sector Investment Analysis

Key Trends:
- Strong growth in fintech sector, particularly payment solutions
- Healthcare technology showing resilience
- AI/ML companies attracting significant investment
- European market showing 15% YoY growth

Investment Activity:
- Total investments: €2.5B in Q4
- Average deal size: €1.2M
- Most active sectors: Fintech (35%), Healthcare Tech (25%), AI/ML (20%)

Market Outlook:
- Continued growth expected in 2025
- Focus on B2B SaaS and enterprise solutions
- Early-stage investments remain strong

Recommendations:
- Focus on fintech and healthcare tech opportunities
- Look for companies with strong unit economics
- Prefer Series A and later stage for lower risk`,
        notes: 'Quarterly analysis for investment decision making',
        optimization_hints: 'Focus on sectors, investment amounts, trends, recommendations',
        extraction_guidelines: 'Extract: sectors, investment amounts, trends, market outlook',
        context_tags: ['report', 'tech-sector', 'q4-2024', 'analysis'],
      }
    ]
    
    const documentIds: string[] = []
    for (const doc of kbDocuments) {
      const { data, error } = await supabase
        .from('kb_documents')
        .upsert(doc, { onConflict: 'id' })
        .select('id')
        .single()
      
      if (error) {
        console.error(`   ❌ Error creating document ${doc.title}:`, error)
      } else {
        console.log(`   ✅ Created document: ${doc.title}`)
        if (data) documentIds.push(data.id)
      }
    }
    
    // ============================================
    // 4. GENERATE EMBEDDINGS FOR KB DOCUMENTS
    // ============================================
    console.log('\n🧮 Generating embeddings for KB documents...')
    
    for (const doc of kbDocuments) {
      console.log(`   Processing: ${doc.title}`)
      const chunks = chunkText(doc.content)
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        console.log(`      Generating embedding for chunk ${i + 1}/${chunks.length}...`)
        const embedding = await generateEmbedding(chunk)
        
        const { error } = await supabase
          .from('kb_chunks')
          .upsert({
            user_id: USER_ID,
            knowledge_base_id: doc.knowledge_base_id,
            document_id: doc.id,
            content: chunk,
            chunk_index: i,
            char_count: chunk.length,
            embedding: embedding
          }, { onConflict: 'id' })
        
        if (error) {
          console.error(`      ❌ Error storing chunk ${i + 1}:`, error)
        } else {
          console.log(`      ✅ Chunk ${i + 1}/${chunks.length} embedded`)
        }
      }
      
      // Update document with chunk count
      await supabase
        .from('kb_documents')
        .update({
          chunk_count: chunks.length,
          char_count: doc.content.length
        })
        .eq('id', doc.id)
    }
    
    // Update KB document counts
    for (const kb of knowledgeBases) {
      const { count } = await supabase
        .from('kb_documents')
        .select('*', { count: 'exact', head: true })
        .eq('knowledge_base_id', kb.id)
      
      await supabase
        .from('knowledge_bases')
        .update({ document_count: count || 0 })
        .eq('id', kb.id)
    }
    
    // ============================================
    // 5. CREATE AGENT-KB ASSIGNMENTS
    // ============================================
    console.log('\n🔗 Creating agent-KB assignments...')
    
    const assignments = [
      {
        agent_configuration_id: UUIDs.agentConfigJobs,
        knowledge_base_id: UUIDs.kbOldJobDescriptions,
      },
      {
        agent_configuration_id: UUIDs.agentConfigJobs,
        knowledge_base_id: UUIDs.kbCoverLetters,
      },
      {
        agent_configuration_id: UUIDs.agentConfigFinance,
        knowledge_base_id: UUIDs.kbInvestmentHistory,
      },
      {
        agent_configuration_id: UUIDs.agentConfigFinance,
        knowledge_base_id: UUIDs.kbFinancialReports,
      }
    ]
    
    for (const assignment of assignments) {
      const { error } = await supabase
        .from('agent_kb_assignments')
        .upsert(assignment, { onConflict: 'id' })
      
      if (error) {
        console.error(`   ❌ Error creating assignment:`, error)
      } else {
        console.log(`   ✅ Created assignment`)
      }
    }
    
    // ============================================
    // 6. CREATE EMAIL CONNECTION
    // ============================================
    console.log('\n📧 Creating email connection...')
    
    const emailConnection = {
      id: UUIDs.emailConnection,
      user_id: USER_ID,
      email_address: 'test@example.com',
      provider: 'microsoft',
      account_id: 'test-account-123',
      aurinko_access_token: 'fake-token-for-seeding',
      aurinko_refresh_token: 'fake-refresh-token',
      is_active: true,
    }
    
    const { error: connError } = await supabase
      .from('email_connections')
      .upsert(emailConnection, { onConflict: 'id' })
    
    if (connError) {
      console.error(`   ❌ Error creating email connection:`, connError)
    } else {
      console.log(`   ✅ Created email connection`)
    }
    
    // ============================================
    // 7. CREATE ANALYZED EMAILS
    // ============================================
    console.log('\n📨 Creating analyzed emails...')
    
    const analyzedEmails = [
      // Jobs - Email 1
      {
        id: randomUUID(),
        user_id: USER_ID,
        agent_configuration_id: UUIDs.agentConfigJobs,
        email_connection_id: UUIDs.emailConnection,
        email_subject: 'Senior .NET Developer Position - Region Midtjylland',
        email_from: 'jobs@regionmidtjylland.dk',
        email_to: ['test@example.com'],
        email_date: new Date('2024-12-15T10:00:00Z').toISOString(),
        email_message_id: 'msg-jobs-001',
        email_snippet: 'Vi søger en alsidig udvikler til opgaver indenfor både RPA, front-end- og back-end-udvikling...',
        has_attachments: false,
        extracted_data: {
          technologies: ['.NET', 'C#', 'Python', 'SQL', 'UiPath'],
          domain: 'healthcare',
          location: 'Aarhus',
          company: 'Region Midtjylland',
          required_experience: '3+ years',
          competencies: ['Backend development', 'RPA', 'Frontend development', 'Scrum'],
        },
        matched: true,
        analysis_status: 'completed',
        error_message: null,
        scraped_urls: ['https://midtjob.dk/ad/alsidig-udvikler-til-egenudviklede-losninger-barselsvikariat/qj4vyc/da'],
        scraped_content: {
          'https://midtjob.dk/ad/alsidig-udvikler-til-egenudviklede-losninger-barselsvikariat/qj4vyc/da': {
            markdown: `# Senior .NET Developer Position - Region Midtjylland

Vi søger en alsidig udvikler til opgaver indenfor både RPA, front-end- og back-end-udvikling.

## Teknologier
- .NET (C#)
- Python
- SQL Server
- UiPath (RPA)
- React (frontend)

## Domæne
Sundhedsvæsenet, offentlig sektor

## Lokation
Aarhus, Danmark

## Erfaring
Minimum 3 års erfaring med .NET og Python

Du kommer til at arbejde med:
- Løsningsdesign, udvikling og test af RPA-løsninger i UiPath og/eller Python
- Backend udvikling af nye projekter der bliver egenudviklet
- Frontend udvikling i React

Det er vigtigt, at du har kompetencer indenfor frontend og backend-udvikling og erfaring med Scrum eller lignende arbejdsmetoder.`,
            title: 'Senior .NET Developer Position - Region Midtjylland',
            scraped_at: new Date('2024-12-15T10:00:00Z').toISOString()
          }
        },
        reasoning: 'Strong match: Requires .NET, C#, Python, SQL, and UiPath (RPA). Healthcare domain matches criteria. Location in Aarhus.',
        confidence: 0.92,
        all_links_found: [
          'https://midtjob.dk/ad/alsidig-udvikler-til-egenudviklede-losninger-barselsvikariat/qj4vyc/da',
          'https://www.regionmidtjylland.dk/job',
        ],
        data_by_source: [
          {
            source: 'Email',
            data: {
              technologies: ['.NET', 'C#', 'Python'],
              domain: 'healthcare',
              location: 'Aarhus',
            },
            reasoning: 'Email content clearly states .NET, C#, Python technologies and healthcare domain',
            confidence: 0.90,
          },
          {
            source: 'https://midtjob.dk/ad/alsidig-udvikler-til-egenudviklede-losninger-barselsvikariat/qj4vyc/da',
            data: {
              technologies: ['.NET', 'C#', 'Python', 'SQL', 'UiPath'],
              domain: 'healthcare',
              location: 'Aarhus',
              company: 'Region Midtjylland',
              required_experience: '3+ years',
              competencies: ['Backend development', 'RPA', 'Frontend development'],
            },
            reasoning: 'Full job description confirms all technologies including UiPath for RPA, healthcare domain, and detailed requirements',
            confidence: 0.95,
          }
        ],
        email_html_body: `<html><body>
          <h1>Senior .NET Developer Position</h1>
          <p>Vi søger en alsidig udvikler til opgaver indenfor både RPA, front-end- og back-end-udvikling.</p>
          <p><strong>Teknologier:</strong> .NET, C#, Python, SQL, UiPath</p>
          <p><strong>Domæne:</strong> Sundhedsvæsenet</p>
          <p><strong>Lokation:</strong> Aarhus</p>
          <a href="https://midtjob.dk/ad/alsidig-udvikler-til-egenudviklede-losninger-barselsvikariat/qj4vyc/da">Se jobbet</a>
        </body></html>`,
        analyzed_at: new Date().toISOString(),
        graph_message_id: 'graph-msg-001',
      },
      
      // Jobs - Email 2
      {
        id: randomUUID(),
        user_id: USER_ID,
        agent_configuration_id: UUIDs.agentConfigJobs,
        email_connection_id: UUIDs.emailConnection,
        email_subject: 'Full Stack Developer - Fintech Startup',
        email_from: 'careers@fintechstartup.dk',
        email_to: ['test@example.com'],
        email_date: new Date('2024-12-14T14:30:00Z').toISOString(),
        email_message_id: 'msg-jobs-002',
        email_snippet: 'We are looking for an experienced full stack developer with .NET and TypeScript experience...',
        has_attachments: false,
        extracted_data: {
          technologies: ['.NET', 'C#', 'TypeScript', 'React', 'SQL', 'Azure'],
          domain: 'fintech',
          location: 'Copenhagen',
          company: 'Fintech Startup',
          required_experience: '5+ years',
          competencies: ['Full stack development', 'Cloud services', 'Microservices'],
        },
        matched: true,
        analysis_status: 'completed',
        error_message: null,
        scraped_urls: ['https://fintechstartup.dk/careers/fullstack-developer'],
        scraped_content: {
          'https://fintechstartup.dk/careers/fullstack-developer': {
            markdown: `# Full Stack Developer - Fintech Startup

We are looking for an experienced full stack developer.

## Technologies
- .NET, C#
- TypeScript, React
- SQL, Azure
- Microservices architecture

## Domain
Fintech

## Location
Copenhagen, Denmark

## Experience
5+ years with .NET and web development`,
            title: 'Full Stack Developer - Fintech Startup',
            scraped_at: new Date('2024-12-14T14:30:00Z').toISOString()
          }
        },
        reasoning: 'Good match: .NET and TypeScript required, fintech domain, strong technical requirements',
        confidence: 0.88,
        all_links_found: [
          'https://fintechstartup.dk/careers/fullstack-developer',
          'https://fintechstartup.dk/about',
        ],
        data_by_source: [
          {
            source: 'Email',
            data: {
              technologies: ['.NET', 'TypeScript'],
              domain: 'fintech',
            },
            reasoning: 'Email mentions .NET and TypeScript for fintech position',
            confidence: 0.85,
          },
          {
            source: 'https://fintechstartup.dk/careers/fullstack-developer',
            data: {
              technologies: ['.NET', 'C#', 'TypeScript', 'React', 'SQL', 'Azure'],
              domain: 'fintech',
              location: 'Copenhagen',
              company: 'Fintech Startup',
              required_experience: '5+ years',
            },
            reasoning: 'Full job posting provides complete technology stack and requirements',
            confidence: 0.92,
          }
        ],
        email_html_body: `<html><body>
          <h1>Full Stack Developer Position</h1>
          <p>We are looking for an experienced full stack developer.</p>
          <p><strong>Technologies:</strong> .NET, C#, TypeScript, React, SQL, Azure</p>
          <p><strong>Domain:</strong> Fintech</p>
          <a href="https://fintechstartup.dk/careers/fullstack-developer">View Job</a>
        </body></html>`,
        analyzed_at: new Date().toISOString(),
        graph_message_id: 'graph-msg-002',
      },
      
      // Jobs - Email 3 (Not matched)
      {
        id: randomUUID(),
        user_id: USER_ID,
        agent_configuration_id: UUIDs.agentConfigJobs,
        email_connection_id: UUIDs.emailConnection,
        email_subject: 'Marketing Manager Position',
        email_from: 'hr@company.dk',
        email_to: ['test@example.com'],
        email_date: new Date('2024-12-13T09:00:00Z').toISOString(),
        email_message_id: 'msg-jobs-003',
        email_snippet: 'We are looking for a marketing manager with 5+ years experience...',
        has_attachments: false,
        extracted_data: {
          role: 'Marketing Manager',
          required_experience: '5+ years',
        },
        matched: false,
        analysis_status: 'completed',
        error_message: null,
        scraped_urls: [],
        reasoning: 'Not a match: This is a marketing position, not a software development role. No relevant technologies mentioned.',
        confidence: 0.15,
        all_links_found: [],
        data_by_source: [
          {
            source: 'Email',
            data: {
              role: 'Marketing Manager',
            },
            reasoning: 'Email is for marketing position, not software development',
            confidence: 0.10,
          }
        ],
        email_html_body: `<html><body>
          <h1>Marketing Manager Position</h1>
          <p>We are looking for a marketing manager.</p>
        </body></html>`,
        analyzed_at: new Date().toISOString(),
        graph_message_id: 'graph-msg-003',
      },
      
      // Finance - Email 1
      {
        id: randomUUID(),
        user_id: USER_ID,
        agent_configuration_id: UUIDs.agentConfigFinance,
        email_connection_id: UUIDs.emailConnection,
        email_subject: 'Q4 Investment Opportunities - Tech Sector',
        email_from: 'investments@venturecapital.com',
        email_to: ['test@example.com'],
        email_date: new Date('2024-12-12T11:00:00Z').toISOString(),
        email_message_id: 'msg-finance-001',
        email_snippet: 'We have several exciting investment opportunities in the technology sector...',
        has_attachments: false,
        extracted_data: {
          sector: 'Technology',
          investment_type: 'Equity',
          amount_range: '€500K-€2M',
          company_stage: 'Series A',
          expected_return: '3-5x over 5 years',
          risk_level: 'Medium',
        },
        matched: true,
        analysis_status: 'completed',
        error_message: null,
        scraped_urls: ['https://venturecapital.com/opportunities/q4-tech-investments'],
        scraped_content: {
          'https://venturecapital.com/opportunities/q4-tech-investments': {
            markdown: `# Q4 Investment Opportunities - Tech Sector

We have several exciting investment opportunities in the technology sector.

## Sector
Technology

## Investment Type
Equity

## Amount Range
€500K-€2M

## Company Stage
Series A

## Expected Return
3-5x over 5 years

## Risk Level
Medium`,
            title: 'Q4 Investment Opportunities - Tech Sector',
            scraped_at: new Date('2024-12-12T11:00:00Z').toISOString()
          }
        },
        reasoning: 'Strong match: Tech sector equity investments in Series A stage, amount range matches criteria',
        confidence: 0.90,
        all_links_found: [
          'https://venturecapital.com/opportunities/q4-tech-investments',
          'https://venturecapital.com/about',
        ],
        data_by_source: [
          {
            source: 'Email',
            data: {
              sector: 'Technology',
              investment_type: 'Equity',
              amount_range: '€500K-€2M',
            },
            reasoning: 'Email mentions tech sector equity investments in the specified amount range',
            confidence: 0.88,
          },
          {
            source: 'https://venturecapital.com/opportunities/q4-tech-investments',
            data: {
              sector: 'Technology',
              investment_type: 'Equity',
              amount_range: '€500K-€2M',
              company_stage: 'Series A',
              expected_return: '3-5x over 5 years',
              risk_level: 'Medium',
            },
            reasoning: 'Full investment opportunity page provides complete details including stage and expected returns',
            confidence: 0.93,
          }
        ],
        email_html_body: `<html><body>
          <h1>Q4 Investment Opportunities</h1>
          <p>We have several exciting investment opportunities in the technology sector.</p>
          <p><strong>Sector:</strong> Technology</p>
          <p><strong>Type:</strong> Equity</p>
          <p><strong>Amount:</strong> €500K-€2M</p>
          <a href="https://venturecapital.com/opportunities/q4-tech-investments">Learn More</a>
        </body></html>`,
        analyzed_at: new Date().toISOString(),
        graph_message_id: 'graph-msg-finance-001',
      },
      
      // Finance - Email 2
      {
        id: randomUUID(),
        user_id: USER_ID,
        agent_configuration_id: UUIDs.agentConfigFinance,
        email_connection_id: UUIDs.emailConnection,
        email_subject: 'Fintech Startup Investment Opportunity',
        email_from: 'deals@angelinvestors.dk',
        email_to: ['test@example.com'],
        email_date: new Date('2024-12-11T15:00:00Z').toISOString(),
        email_message_id: 'msg-finance-002',
        email_snippet: 'Early-stage fintech startup seeking €750K investment...',
        has_attachments: false,
        extracted_data: {
          sector: 'Financial Technology',
          investment_type: 'Equity',
          amount_range: '€750K',
          company_stage: 'Seed',
          expected_return: '5-7x over 7 years',
          risk_level: 'High',
        },
        matched: true,
        analysis_status: 'completed',
        error_message: null,
        scraped_urls: ['https://angelinvestors.dk/deals/fintech-seed-2024'],
        scraped_content: {
          'https://angelinvestors.dk/deals/fintech-seed-2024': {
            markdown: `# Fintech Startup Investment Opportunity

Early-stage fintech startup seeking investment.

## Sector
Financial Technology

## Investment Type
Equity

## Amount
€750K

## Company Stage
Seed

## Expected Return
5-7x over 7 years

## Risk Level
High`,
            title: 'Fintech Startup Investment Opportunity',
            scraped_at: new Date('2024-12-11T15:00:00Z').toISOString()
          }
        },
        reasoning: 'Good match: Fintech sector, equity investment, amount within range, early stage',
        confidence: 0.85,
        all_links_found: [
          'https://angelinvestors.dk/deals/fintech-seed-2024',
        ],
        data_by_source: [
          {
            source: 'Email',
            data: {
              sector: 'Financial Technology',
              investment_type: 'Equity',
              amount_range: '€750K',
            },
            reasoning: 'Email mentions fintech equity investment opportunity',
            confidence: 0.82,
          },
          {
            source: 'https://angelinvestors.dk/deals/fintech-seed-2024',
            data: {
              sector: 'Financial Technology',
              investment_type: 'Equity',
              amount_range: '€750K',
              company_stage: 'Seed',
              expected_return: '5-7x over 7 years',
              risk_level: 'High',
            },
            reasoning: 'Investment details page confirms seed stage, expected returns, and risk level',
            confidence: 0.88,
          }
        ],
        email_html_body: `<html><body>
          <h1>Fintech Startup Investment</h1>
          <p>Early-stage fintech startup seeking €750K investment.</p>
          <p><strong>Sector:</strong> Financial Technology</p>
          <p><strong>Stage:</strong> Seed</p>
          <a href="https://angelinvestors.dk/deals/fintech-seed-2024">View Details</a>
        </body></html>`,
        analyzed_at: new Date().toISOString(),
        graph_message_id: 'graph-msg-finance-002',
      },
    ]
    
    const emailIds: string[] = []
    for (const email of analyzedEmails) {
      const { data, error } = await supabase
        .from('analyzed_emails')
        .insert(email)
        .select('id')
        .single()
      
      if (error) {
        console.error(`   ❌ Error creating email ${email.email_subject}:`, error)
      } else {
        console.log(`   ✅ Created email: ${email.email_subject}`)
        if (data) emailIds.push(data.id)
      }
    }
    
    // ============================================
    // 8. GENERATE EMBEDDINGS FOR ANALYZED EMAILS
    // ============================================
    console.log('\n🧮 Generating embeddings for analyzed emails...')
    
    for (let i = 0; i < analyzedEmails.length; i++) {
      const email = analyzedEmails[i]
      const emailId = emailIds[i]
      
      if (!emailId) continue
      
      console.log(`   Processing: ${email.email_subject}`)
      
      // Embed extracted_data
      const extractedText = JSON.stringify(email.extracted_data, null, 2)
      console.log(`      Generating embedding for extracted_data...`)
      const extractedEmbedding = await generateEmbedding(extractedText)
      
      const { error: extractedError } = await supabase
        .from('analyzed_email_embeddings')
        .insert({
          analyzed_email_id: emailId,
          user_id: USER_ID,
          content_type: 'extracted_data',
          embedded_text: extractedText,
          embedding: extractedEmbedding
        })
      
      if (extractedError) {
        console.error(`      ❌ Error storing extracted_data embedding:`, extractedError)
      } else {
        console.log(`      ✅ Extracted data embedded`)
      }
      
      // Embed each scraped URL's data
      if (email.data_by_source) {
        for (let j = 0; j < email.data_by_source.length; j++) {
          const source = email.data_by_source[j]
          
          // Skip email itself (only embed scraped URLs)
          if (source.source === 'Email') continue
          
          const sourceText = `${JSON.stringify(source.data, null, 2)}\n\nReasoning: ${source.reasoning}`
          console.log(`      Generating embedding for URL ${j + 1}...`)
          const sourceEmbedding = await generateEmbedding(sourceText)
          
          const { error: sourceError } = await supabase
            .from('analyzed_email_embeddings')
            .insert({
              analyzed_email_id: emailId,
              user_id: USER_ID,
              content_type: 'scraped_url',
              source_url: source.source,
              source_index: j,
              embedded_text: sourceText,
              embedding: sourceEmbedding
            })
          
          if (sourceError) {
            console.error(`      ❌ Error storing URL embedding ${j + 1}:`, sourceError)
          } else {
            console.log(`      ✅ URL ${j + 1} embedded: ${source.source.substring(0, 50)}...`)
          }
        }
      }
    }
    
    // ============================================
    // 9. SIMULATE "SAVE TO KB" FOR SOME EMAILS
    // ============================================
    console.log('\n💾 Simulating "Save to Knowledge Base" for sample emails...')
    
    // Save the first job email to "Old Job Descriptions" KB
    if (emailIds.length > 0) {
      const email1 = analyzedEmails[0]
      const emailId1 = emailIds[0]
      
      // Fetch agent config for this email
      const { data: agentConfig1 } = await supabase
        .from('agent_configurations')
        .select('*')
        .eq('id', email1.agent_configuration_id)
        .single()
      
      if (agentConfig1) {
        const agentConfigSnapshot1 = {
          name: agentConfig1.name,
          email_address: agentConfig1.email_address,
          match_criteria: agentConfig1.match_criteria,
          extraction_fields: agentConfig1.extraction_fields,
          analyze_attachments: agentConfig1.analyze_attachments,
          follow_links: agentConfig1.follow_links,
          button_text_pattern: agentConfig1.button_text_pattern,
        }
        
        const analyzedEmailSnapshot1 = {
          email_subject: email1.email_subject,
          email_from: email1.email_from,
          email_date: email1.email_date,
          reasoning: email1.reasoning,
          confidence: email1.confidence,
          matched: email1.matched,
          extracted_data: email1.extracted_data,
          data_by_source: email1.data_by_source,
          scraped_urls: email1.scraped_urls,
        }
        
        const savedDocId1 = randomUUID()
        const { error: saveError1 } = await supabase
          .from('kb_documents')
          .insert({
            id: savedDocId1,
            user_id: USER_ID,
            knowledge_base_id: UUIDs.kbOldJobDescriptions,
            title: email1.email_subject,
            type: 'saved_email',
            content: JSON.stringify(email1.extracted_data, null, 2),
            analyzed_email_id: emailId1,
            source_agent_config_id: agentConfig1.id,
            agent_config_snapshot: agentConfigSnapshot1,
            analyzed_email_snapshot: analyzedEmailSnapshot1,
            notes: 'Saved from seed script - demonstrates snapshot functionality',
          })
        
        if (saveError1) {
          console.error('   ❌ Error saving email 1 to KB:', saveError1)
        } else {
          console.log(`   ✅ Saved email to KB: ${email1.email_subject}`)
          
          // Generate embedding for this saved email
          const savedContent1 = JSON.stringify(email1.extracted_data, null, 2)
          const chunks1 = chunkText(savedContent1)
          
          for (let i = 0; i < chunks1.length; i++) {
            const embedding1 = await generateEmbedding(chunks1[i])
            await supabase
              .from('kb_chunks')
              .insert({
                user_id: USER_ID,
                knowledge_base_id: UUIDs.kbOldJobDescriptions,
                document_id: savedDocId1,
                content: chunks1[i],
                chunk_index: i,
                char_count: chunks1[i].length,
                embedding: embedding1
              })
          }
          
          // Update document chunk count
          await supabase
            .from('kb_documents')
            .update({
              chunk_count: chunks1.length,
              char_count: savedContent1.length
            })
            .eq('id', savedDocId1)
        }
      }
    }
    
    // Save the first finance email to "Investment History" KB
    if (emailIds.length > 3) {
      const email4 = analyzedEmails[3]
      const emailId4 = emailIds[3]
      
      // Fetch agent config for this email
      const { data: agentConfig4 } = await supabase
        .from('agent_configurations')
        .select('*')
        .eq('id', email4.agent_configuration_id)
        .single()
      
      if (agentConfig4) {
        const agentConfigSnapshot4 = {
          name: agentConfig4.name,
          email_address: agentConfig4.email_address,
          match_criteria: agentConfig4.match_criteria,
          extraction_fields: agentConfig4.extraction_fields,
          analyze_attachments: agentConfig4.analyze_attachments,
          follow_links: agentConfig4.follow_links,
          button_text_pattern: agentConfig4.button_text_pattern,
        }
        
        const analyzedEmailSnapshot4 = {
          email_subject: email4.email_subject,
          email_from: email4.email_from,
          email_date: email4.email_date,
          reasoning: email4.reasoning,
          confidence: email4.confidence,
          matched: email4.matched,
          extracted_data: email4.extracted_data,
          data_by_source: email4.data_by_source,
          scraped_urls: email4.scraped_urls,
        }
        
        const savedDocId4 = randomUUID()
        const { error: saveError4 } = await supabase
          .from('kb_documents')
          .insert({
            id: savedDocId4,
            user_id: USER_ID,
            knowledge_base_id: UUIDs.kbInvestmentHistory,
            title: email4.email_subject,
            type: 'saved_email',
            content: JSON.stringify(email4.extracted_data, null, 2),
            analyzed_email_id: emailId4,
            source_agent_config_id: agentConfig4.id,
            agent_config_snapshot: agentConfigSnapshot4,
            analyzed_email_snapshot: analyzedEmailSnapshot4,
            notes: 'Saved from seed script - demonstrates snapshot functionality',
          })
        
        if (saveError4) {
          console.error('   ❌ Error saving email 4 to KB:', saveError4)
        } else {
          console.log(`   ✅ Saved email to KB: ${email4.email_subject}`)
          
          // Generate embedding for this saved email
          const savedContent4 = JSON.stringify(email4.extracted_data, null, 2)
          const chunks4 = chunkText(savedContent4)
          
          for (let i = 0; i < chunks4.length; i++) {
            const embedding4 = await generateEmbedding(chunks4[i])
            await supabase
              .from('kb_chunks')
              .insert({
                user_id: USER_ID,
                knowledge_base_id: UUIDs.kbInvestmentHistory,
                document_id: savedDocId4,
                content: chunks4[i],
                chunk_index: i,
                char_count: chunks4[i].length,
                embedding: embedding4
              })
          }
          
          // Update document chunk count
          await supabase
            .from('kb_documents')
            .update({
              chunk_count: chunks4.length,
              char_count: savedContent4.length
            })
            .eq('id', savedDocId4)
        }
      }
    }
    
    // Update KB document counts (including newly saved emails)
    for (const kb of knowledgeBases) {
      const { count } = await supabase
        .from('kb_documents')
        .select('*', { count: 'exact', head: true })
        .eq('knowledge_base_id', kb.id)
      
      await supabase
        .from('knowledge_bases')
        .update({ document_count: count || 0 })
        .eq('id', kb.id)
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70))
    console.log('✅ SEED COMPLETE!')
    console.log('='.repeat(70))
    console.log(`\nCreated:`)
    console.log(`  📋 Agent Configurations: 2`)
    console.log(`  📚 Knowledge Bases: 4`)
    console.log(`  📄 KB Documents (text notes): ${kbDocuments.length}`)
    console.log(`  💾 KB Documents (saved emails): 2`)
    console.log(`  📧 Analyzed Emails: ${analyzedEmails.length}`)
    console.log(`  🔗 Agent-KB Assignments: ${assignments.length}`)
    console.log(`\nAll embeddings have been generated and stored.`)
    console.log(`\n✨ Special features demonstrated:`)
    console.log(`  • Agent config snapshots saved in KB documents`)
    console.log(`  • Analyzed email snapshots saved in KB documents`)
    console.log(`  • Full scraped content stored in analyzed emails`)
    console.log(`\nYou can now:`)
    console.log(`  1. View agent configurations in the dashboard`)
    console.log(`  2. Browse knowledge bases and documents`)
    console.log(`  3. View analyzed emails in the results page`)
    console.log(`  4. Test semantic search with "Find Similar"`)
    console.log(`  5. Check kb_documents to see snapshot metadata`)
    console.log(`\nUser ID: ${USER_ID}`)
    console.log('='.repeat(70) + '\n')
    
  } catch (error) {
    console.error('\n❌ Error during seed:', error)
    throw error
  }
}

// Run seed
seed()
  .then(() => {
    console.log('✅ Seed script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error)
    process.exit(1)
  })

