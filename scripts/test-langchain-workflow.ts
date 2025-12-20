/**
 * Test Script for LangChain Email Workflow
 * 
 * This script tests the email workflow with a sample job email.
 * Run with: npx tsx scripts/test-langchain-workflow.ts
 */

import { config } from 'dotenv'

// Load .env.local (Next.js convention)
config({ path: '.env.local' })
import { runEmailWorkflow, type AgentConfig, type EmailInput } from '../lib/langchain'

// ============================================
// Test Configuration
// ============================================

// Sample agent configuration (matches your example)
const testConfig: AgentConfig = {
  id: 'test-config-001',
  matchCriteria: `Software developer with less than 5 years experience.
In classic Java, .NET, node.js backend and Javascript/typescript frameworks like Next.js/React and Angular.
Or RPA and automation with RPA with Power platform and UiPath. Or Python.
Avoid PLC/scada and hardware descriptions like electronic/mechanic engineering.
I know Deep learning, AI Engineering, IoT & Cloud computing.
I also know something about information and cyber security and compliance.`,
  extractionFields: 'deadline, technologies, competencies, experience level, company domains, location, work type',
  userIntent: 'Find relevant software developer jobs matching my skills',
  draftGenerationEnabled: false, // Phase 1: No drafting yet
  draftInstructions: '',
  knowledgeBaseIds: [], // Phase 1: No KB search yet
}

// Sample job email (simulating a job agent email with multiple listings)
const testEmail: EmailInput = {
  id: 'test-email-001',
  subject: 'New job opportunities matching your profile',
  from: 'jobs@jobagent.dk',
  to: ['user@example.com'],
  date: new Date().toISOString(),
  htmlBody: `
    <!DOCTYPE html>
    <html>
    <head><title>Job Opportunities</title></head>
    <body>
      <h1>New Job Opportunities for You</h1>
      
      <div class="job">
        <h2>Senior React Developer</h2>
        <p><strong>Company:</strong> TechCorp Danmark A/S</p>
        <p><strong>Location:</strong> Copenhagen, Denmark (Hybrid)</p>
        <p><strong>Technologies:</strong> React, TypeScript, Node.js, AWS</p>
        <p><strong>Experience:</strong> 3-5 years</p>
        <p><strong>Description:</strong> We're looking for a passionate React developer to join our team...</p>
        <p><a href="https://www.linkedin.com/jobs/view/3847582910?refId=abc123">Apply on LinkedIn</a></p>
        <p>Application deadline: January 31, 2025</p>
      </div>
      
      <hr/>
      
      <div class="job">
        <h2>PLC Programmer - Industrial Automation</h2>
        <p><strong>Company:</strong> IndustryTech ApS</p>
        <p><strong>Location:</strong> Odense, Denmark</p>
        <p><strong>Technologies:</strong> Siemens PLC, SCADA, HMI</p>
        <p><strong>Experience:</strong> 5+ years</p>
        <p><strong>Description:</strong> Programming industrial PLCs and SCADA systems...</p>
        <p><a href="https://www.linkedin.com/jobs/view/3847582911">Apply on LinkedIn</a></p>
      </div>
      
      <hr/>
      
      <div class="job">
        <h2>.NET Backend Developer</h2>
        <p><strong>Company:</strong> FinSoft Solutions</p>
        <p><strong>Location:</strong> Aarhus, Denmark (Remote possible)</p>
        <p><strong>Technologies:</strong> C#, .NET 8, Azure, SQL Server, Microservices</p>
        <p><strong>Experience:</strong> 2-4 years</p>
        <p><strong>Description:</strong> Join our fintech team building modern .NET solutions...</p>
        <p><a href="https://www.linkedin.com/jobs/view/3847582912">View on LinkedIn</a></p>
        <p>More info: <a href="https://finsoft.dk/careers/dotnet-developer">FinSoft Careers</a></p>
        <p>Deadline: February 15, 2025</p>
      </div>
      
      <hr/>
      
      <div class="job">
        <h2>Python Developer - AI/ML Team</h2>
        <p><strong>Company:</strong> DataMind AI</p>
        <p><strong>Location:</strong> Copenhagen, Denmark</p>
        <p><strong>Technologies:</strong> Python, TensorFlow, PyTorch, FastAPI, Docker</p>
        <p><strong>Experience:</strong> 2-3 years</p>
        <p><strong>Description:</strong> Work on cutting-edge AI solutions...</p>
        <p><a href="https://datamind.ai/careers/python-developer">Apply directly</a></p>
        <p>Deadline: January 25, 2025</p>
      </div>
      
      <footer>
        <p>You received this email because you subscribed to job alerts.</p>
        <p><a href="https://jobagent.dk/unsubscribe">Unsubscribe</a></p>
      </footer>
    </body>
    </html>
  `,
  snippet: 'New job opportunities: Senior React Developer, PLC Programmer, .NET Backend Developer, Python Developer',
}

// ============================================
// Main Test Function
// ============================================

async function runTest() {
  console.log('═'.repeat(70))
  console.log('🧪 LANGCHAIN EMAIL WORKFLOW TEST')
  console.log('═'.repeat(70))
  
  // Validate environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set')
    process.exit(1)
  }
  
  if (!process.env.TAVILY_API_KEY) {
    console.error('❌ TAVILY_API_KEY not set')
    process.exit(1)
  }
  
  console.log('✅ Environment variables configured')
  console.log('')
  
  try {
    // Run the workflow
    const result = await runEmailWorkflow({
      email: testEmail,
      config: testConfig,
      userId: 'test-user-001',
    })
    
    // Print results
    console.log('\n' + '═'.repeat(70))
    console.log('📊 WORKFLOW RESULTS')
    console.log('═'.repeat(70))
    
    console.log(`\nSuccess: ${result.success}`)
    console.log(`Phase: ${result.phase}`)
    console.log(`Processing time: ${(result.processingTimeMs / 1000).toFixed(2)}s`)
    console.log(`Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`)
    
    console.log('\n--- JOBS FOUND ---')
    for (const job of result.jobs) {
      const matchIcon = job.matched ? '✓' : '✗'
      console.log(`\n${matchIcon} ${job.position} at ${job.company}`)
      console.log(`   Location: ${job.location || 'Not specified'}`)
      console.log(`   Matched: ${job.matched} (${Math.round(job.confidence * 100)}%)`)
      console.log(`   Reasoning: ${job.matchReasoning}`)
      console.log(`   Technologies: ${job.technologies.join(', ') || 'None'}`)
      if (job.originalUrl) {
        console.log(`   Original URL: ${job.originalUrl}`)
      }
    }
    
    console.log('\n--- RESEARCH RESULTS ---')
    for (const research of result.researchResults) {
      const foundIcon = research.found ? '✓' : '✗'
      console.log(`\n${foundIcon} ${research.position} at ${research.company}`)
      console.log(`   Found: ${research.found}`)
      console.log(`   Iterations: ${research.iterations}`)
      console.log(`   Sources searched: ${research.sourcesSearched.length}`)
      if (research.primarySource) {
        console.log(`   Primary source: ${research.primarySource.url}`)
        console.log(`   Source type: ${research.primarySource.sourceType}`)
      }
      if (research.technologies && research.technologies.length > 0) {
        console.log(`   Technologies found: ${research.technologies.slice(0, 5).join(', ')}`)
      }
      if (research.deadline) {
        console.log(`   Deadline: ${research.deadline}`)
      }
    }
    
    console.log('\n--- ENTITIES EXTRACTED ---')
    if (result.entities) {
      console.log(`Companies: ${result.entities.companies.join(', ') || 'None'}`)
      console.log(`Technologies: ${result.entities.technologies.join(', ') || 'None'}`)
      console.log(`Locations: ${result.entities.locations.join(', ') || 'None'}`)
      console.log(`Positions: ${result.entities.positions.join(', ') || 'None'}`)
    }
    
    console.log('\n' + '═'.repeat(70))
    console.log('✅ TEST COMPLETED')
    console.log('═'.repeat(70))
    
    // Return result for programmatic use
    return result
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    process.exit(1)
  }
}

// Run the test
runTest()

