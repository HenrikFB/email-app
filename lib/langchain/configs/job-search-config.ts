/**
 * Job Search Configuration
 * 
 * Hardcoded configuration for personal job search agent.
 * This is the source of truth for matching criteria, extraction fields,
 * and prompt customizations.
 * 
 * Later this can be extracted to a database-driven configuration,
 * but for now we iterate on prompts in code for fast development.
 */

// ============================================
// Core Configuration
// ============================================

export const JOB_SEARCH_CONFIG = {
  // Meta
  name: 'Software Developer Job Search',
  description: 'Find software developer jobs matching my skills and experience level',
  language: 'danish_and_english' as const,

  // ============================================
  // Match Criteria (INCLUSIVE - prefer false positives)
  // ============================================
  matchCriteria: `
## MATCHING PHILOSOPHY
**IMPORTANT**: I want to see ALL potentially relevant IT/software jobs. 
When in doubt, INCLUDE the job with medium confidence (0.6-0.7).
I prefer false positives over missing opportunities - I can filter manually.

## ACCEPT THESE ROLES (any of these titles)

### Core Software Development
- Software Developer / Softwareudvikler / Software Engineer / Softwareingeniør
- Programmer / Programmør
- Backend Developer / Frontend Developer / Fullstack Developer
- Web Developer / Webudvikler
- Application Developer / Applikationsudvikler / App-udvikler

### IT Development & Consulting
- IT-udvikler / IT-Developer / IT Developer
- IT-konsulent / IT Consultant (if development-focused)
- Systemudvikler / Systems Developer

### Mobile & Native Development
- Android Developer / Android-udvikler
- iOS Developer / iOS-udvikler
- Mobile Developer / Mobiludvikler

### DevOps & Platform
- DevOps Engineer / DevOps-udvikler
- Platform Engineer / Site Reliability Engineer (SRE)
- Cloud Engineer

### Automation & RPA
- RPA Developer / RPA-udvikler
- Automation Developer / Automatiseringsudvikler
- Process Automation Developer (software-based, NOT industrial PLC)

### Data & BI
- Data Engineer / Data Developer / Dataingeniør
- BI Developer / BI-udvikler

### Business Systems
- Dynamics 365 Developer / CRM Developer / ERP Developer
- Salesforce Developer
- Business Central Developer

## TECHNOLOGIES I KNOW
Languages: C#, .NET, TypeScript, JavaScript, Python, Java, SQL
Frontend: React, Angular, Vue, Next.js
Backend: Node.js, ASP.NET, Spring Boot
Cloud: Azure, AWS, GCP
Data: PostgreSQL, SQL Server, MongoDB
Automation: Power Platform, UiPath, Automation Anywhere

## EXPERIENCE LEVEL
- Be FLEXIBLE - note experience requirements but don't auto-reject
- Flag jobs requiring 5+ years or "Senior"/"Lead"/"Architect" - but still INCLUDE them
- Let me decide if a senior role is worth applying to

## HARD REJECTION (Only reject these specific ROLES)
⚠️ IMPORTANT: Reject based on the JOB ROLE, NOT the company!
A software developer job at ABB, Siemens, or any industrial company is FINE if the role is software development.

Only reject if the JOB ITSELF requires:
- PLC programming (Siemens S7, TIA Portal, ABB PLCs) - the actual controller programming
- SCADA systems development - industrial control software
- Hardware engineering, electronic design, PCB design
- Embedded firmware with microcontrollers, RTOS, bare-metal
- Mechanical or mechatronic engineering

✅ ACCEPT: "Software Developer at ABB using C#, .NET, SQL" - this is a software role!
❌ REJECT: "PLC Programmer at ABB using Siemens S7, TIA Portal" - this is PLC programming

## COMPANY DOMAIN DOES NOT MATTER
The company can be in manufacturing, utilities, healthcare, finance, etc.
What matters is: Is the ROLE software development with technologies I know?
`.trim(),

  // ============================================
  // Extraction Fields
  // ============================================
  extractionFields: `
Extract these fields for each job:

1. **position**: The job title (in original language)
2. **company**: Company name
3. **location**: City, country, or "Remote"/"Hybrid"/"Onsite"
4. **technologies**: List of specific technologies, frameworks, languages mentioned
5. **experience_level**: Junior / Mid / Senior / Lead / Not specified
6. **experience_years**: If mentioned (e.g., "3-5 years", "5+ years")
7. **deadline**: Application deadline if mentioned (date format)
8. **work_type**: Remote / Hybrid / Onsite / Not specified
9. **salary**: If mentioned (range or specific)
10. **competencies**: Soft skills and other qualifications
11. **company_domain**: What industry/domain (fintech, healthcare, etc.)
12. **job_url**: URL to the full job posting
`.trim(),

  // ============================================
  // User Intent
  // ============================================
  userIntent: `
I'm looking for IT/software development jobs in Denmark. My background is computer science/IT/software.

WHAT I WANT:
- Software development roles (backend, frontend, fullstack, mobile, web)
- IT development and consulting roles
- DevOps and cloud engineering roles
- RPA and automation development (UiPath, Power Platform)
- Data engineering and BI development
- Business systems development (Dynamics 365, Salesforce, ERP)

MY SKILLS:
- Languages: .NET/C#, Java, TypeScript, JavaScript, Python, SQL
- Frontend: React, Angular, Vue, Next.js
- Backend: Node.js, ASP.NET, Spring Boot
- Cloud: Azure, AWS, GCP
- Automation: Power Platform, UiPath

EXPERIENCE: 
- I'm flexible on experience level
- Flag senior roles (5+ years) but still include them
- Let ME decide if a senior role is worth pursuing

LOCATION: Denmark (Copenhagen, Aarhus, Aalborg, Odense, or remote)

**IMPORTANT**: Show me ALL potentially relevant jobs!
I prefer seeing some false positives over missing good opportunities.
I can quickly scan and filter myself.
`.trim(),

  // ============================================
  // Danish Language Support
  // ============================================
  danishTerms: {
    // Core Software Development
    'softwareudvikler': 'software developer',
    'udvikler': 'developer',
    'programmør': 'programmer',
    'webudvikler': 'web developer',
    'appudvikler': 'app developer',
    'app-udvikler': 'app developer',
    
    // IT Development
    'it-udvikler': 'IT developer',
    'it-konsulent': 'IT consultant',
    'systemudvikler': 'system developer',
    
    // Automation
    'automatiseringsudvikler': 'automation developer',
    'rpa-udvikler': 'RPA developer',
    
    // Architecture
    'arkitekt': 'architect',
    'løsningsarkitekt': 'solution architect',
    
    // Experience
    'erfaring': 'experience',
    'års erfaring': 'years of experience',
    'nyuddannet': 'recent graduate',
    'junior': 'junior',
    'senior': 'senior',
    'erfaren': 'experienced',
    
    // Work type
    'hjemmearbejde': 'remote work',
    'deltid': 'part-time',
    'fuldtid': 'full-time',
    'hybrid': 'hybrid',
    
    // Other
    'stilling': 'position',
    'ansøgning': 'application',
    'ansøgningsfrist': 'application deadline',
    'løn': 'salary',
    'arbejdssted': 'workplace',
    'fastansættelse': 'permanent position',
  } as Record<string, string>,

  // ============================================
  // Rejection Patterns (ONLY hard rejections)
  // ============================================
  rejectionPatterns: [
    // Industrial/Hardware Automation (NOT software RPA)
    /\bPLC\s+programm/i,   // PLC programming specifically
    /\bSCADA\b/i,
    /\bSiemens\s+S7/i,
    /\bSiemens\s+TIA/i,
    /\bABB\b.*robot/i,
    /\bproces\s*automat/i, // Process automation (industrial)
    
    // Embedded/Hardware
    /\bembedded\s+software/i,
    /\bfirmware\s+(developer|engineer)/i,
    /\bRTOS\b/i,
    /\bmicrocontroller/i,
    /\bSTM32\b/i,
    
    // Hardware Engineering
    /\bhardware\s+engineer/i,
    /\belectronic\s+design/i,
    /\bPCB\s+design/i,
    /\bmechanical\s+engineer/i,
    /\bmechatron/i,
  ],

  // ============================================
  // Research Configuration
  // ============================================
  research: {
    // Preferred domains for job search
    preferredDomains: [
      'jobindex.dk',
      'karriere.dk', 
      'it-jobbank.dk',
      'ofir.dk',
      // Company career pages are discovered dynamically
    ],
    
    // Domains to avoid (require auth or are low quality)
    avoidDomains: [
      'linkedin.com',  // Requires authentication
      'facebook.com',
      'twitter.com',
    ],
    
    // Max iterations for research agent
    maxIterations: 15,
    
    // Max concurrent research jobs
    maxConcurrent: 3,
  },
} as const

// ============================================
// Type Exports
// ============================================

export type JobSearchConfig = typeof JOB_SEARCH_CONFIG

// ============================================
// Few-Shot Examples
// ============================================

/**
 * Examples for the email analysis prompt
 * These teach the LLM how to reason about job matches
 */
export const ANALYSIS_EXAMPLES = {
  // Example 1: Clear match
  goodMatch: {
    input: `
Job: .NET Backend Developer at Danske Bank
Location: Copenhagen
Technologies: C#, .NET 8, Azure, SQL Server, microservices
Experience: 2-4 years
`,
    reasoning: `
<thinking>
Let me analyze this job step by step:

1. JOB TYPE CHECK:
   - Title: ".NET Backend Developer" - this is clearly a software development role ✓
   - Not PLC/SCADA/hardware/embedded - it's web/cloud development ✓

2. TECHNOLOGY CHECK:
   - C#, .NET 8 - matches my skills ✓
   - Azure - cloud experience matches ✓
   - SQL Server - database matches ✓
   - Microservices - modern architecture ✓

3. EXPERIENCE CHECK:
   - 2-4 years required - this is mid-level, appropriate ✓
   - Not requiring "senior" or "lead" ✓

4. LOCATION CHECK:
   - Copenhagen - matches my preferred location ✓

DECISION: MATCH with high confidence (0.9)
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.9,
      matchReasoning: 'Backend .NET role in Copenhagen, technologies match (C#, .NET, Azure), experience level appropriate (2-4 years)',
    },
  },

  // Example 2: Software Developer at Industrial Company (SHOULD MATCH!)
  softwareAtIndustrialCompany: {
    input: `
Job: Software Developer – C# and Automation
Virksomhed: ABB
Sted: Aalborg
Teknologier: C#, .NET, SQL, Azure, UI/UX design, Power Apps
Erfaring: 5-8 years
`,
    reasoning: `
<thinking>
Let me analyze this job step by step:

1. JOB TYPE CHECK:
   - Title: "Software Developer" - this IS software development ✓
   - Technologies: C#, .NET, SQL, Azure - these are standard software technologies ✓
   - "Automation" in title might raise a flag, but let me check the technologies...
   - The technologies are software-focused (C#, .NET, SQL), NOT PLC/SCADA ✓

2. COMPANY DOMAIN CHECK:
   - ABB is known for industrial automation
   - BUT: The JOB ROLE is software development, not PLC programming!
   - COMPANY DOMAIN DOES NOT MATTER - only the JOB ROLE matters ✓
   
3. TECHNOLOGY CHECK:
   - C#, .NET, SQL - matches my skills ✓
   - Azure - cloud, matches ✓
   - Power Apps - automation/low-code, relevant ✓
   - NO PLC, NO SCADA, NO Siemens S7 mentioned ✓

4. REJECTION CHECK:
   - Is there PLC/Siemens S7 in the requirements? NO ✓
   - Is there SCADA? NO ✓
   - Is there embedded/firmware? NO ✓
   - This is a standard software developer role!

5. EXPERIENCE CHECK:
   - 5-8 years - on the higher side ⚠️
   - Flag as senior, but INCLUDE (user is flexible on experience)

DECISION: MATCH with confidence (0.75)
This is exactly the kind of software role we want, even though ABB is an industrial company!
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.75,
      matchReasoning: 'Software Developer role using C#, .NET, SQL, Azure - standard software technologies. The company (ABB) being industrial does NOT matter - the job itself is software development. Flagged as senior (5-8 years) but included.',
    },
  },

  // Example 3: PLC Programmer (SHOULD REJECT)
  clearRejection: {
    input: `
Job: PLC Programmer at Vestas
Location: Aarhus
Technologies: Siemens S7, SCADA, TIA Portal
Experience: 3+ years
`,
    reasoning: `
<thinking>
Let me analyze this job step by step:

1. JOB TYPE CHECK:
   - Title: "PLC Programmer" - this is industrial automation, NOT software development ✗
   - Technologies: Siemens S7, SCADA, TIA Portal - these are industrial control systems ✗
   - This is hardware-adjacent PLC programming, not software development

2. REJECTION TRIGGERS:
   - "PLC" in title - explicit rejection pattern ✗
   - "SCADA" mentioned - explicit rejection pattern ✗
   - "Siemens S7" - industrial automation ✗

DECISION: REJECT
</thinking>
`,
    output: {
      matched: false,
      confidence: 0.95,
      matchReasoning: 'PLC/SCADA industrial automation role - not software development. Uses Siemens industrial systems, not web/cloud technologies.',
    },
  },

  // Example 3: Edge case - match with lower confidence
  edgeCase: {
    input: `
Job: Senior Software Architect at Novo Nordisk
Location: Copenhagen
Technologies: .NET, Azure, Kubernetes, System Design
Experience: 7+ years, lead experience preferred
`,
    reasoning: `
<thinking>
Let me analyze this job step by step:

1. JOB TYPE CHECK:
   - Title: "Senior Software Architect" - this is software development ✓
   - Technologies are relevant (.NET, Azure, Kubernetes) ✓

2. TECHNOLOGY CHECK:
   - .NET, Azure - matches my skills ✓
   - Kubernetes - cloud-native ✓
   - System Design - relevant ✓

3. EXPERIENCE CHECK:
   - 7+ years required - this is senior level ⚠️
   - "Lead experience preferred" - might be too senior ⚠️
   - User wants flexible experience but should know about senior requirements

4. DECISION REASONING:
   - Technologies match perfectly
   - But experience level is high (7+ years)
   - User said "flexible" on experience, wants to see all opportunities
   - Include it but with lower confidence so user can decide

DECISION: MATCH with medium confidence (0.6)
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.6,
      matchReasoning: 'Technologies match well (.NET, Azure, Kubernetes), but requires 7+ years and lead experience - flagging as senior role for user review.',
    },
  },

  // Example 4: Danish job posting
  danishExample: {
    input: `
Job: Softwareudvikler til vores team i København
Virksomhed: Netcompany
Sted: København (hybrid)
Teknologier: Java, Spring Boot, React, AWS
Erfaring: 2-5 års erfaring som udvikler
`,
    reasoning: `
<thinking>
This is a Danish job posting. Let me translate and analyze:

1. TRANSLATION:
   - "Softwareudvikler" = Software Developer
   - "til vores team" = to our team
   - "Virksomhed" = Company
   - "Sted" = Location
   - "Erfaring" = Experience
   - "års erfaring som udvikler" = years of experience as developer

2. JOB TYPE CHECK:
   - "Softwareudvikler" - software development role ✓
   - Technologies: Java, Spring Boot, React, AWS - modern stack ✓

3. TECHNOLOGY CHECK:
   - Java, Spring Boot - backend technologies ✓
   - React - frontend, matches my skills ✓
   - AWS - cloud ✓

4. EXPERIENCE CHECK:
   - "2-5 års erfaring" = 2-5 years experience - appropriate ✓

5. LOCATION CHECK:
   - København (hybrid) = Copenhagen (hybrid) - matches preferences ✓

DECISION: MATCH with high confidence (0.85)
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.85,
      matchReasoning: 'Software developer role in Copenhagen (hybrid). Tech stack matches (Java, Spring Boot, React, AWS). Experience level appropriate (2-5 years).',
    },
  },

  // Example 5: RPA/Automation job (SHOULD MATCH)
  rpaMatch: {
    input: `
Job: App-udvikler til Automatiseringsteamet (APP/RPA)
Virksomhed: Normal A/S
Sted: Skanderborg
Teknologier: Power Platform, Power Automate, web apps, mobile apps
Erfaring: Ikke specificeret
`,
    reasoning: `
<thinking>
Let me analyze this RPA/App developer position:

1. JOB TYPE CHECK:
   - "App-udvikler" = App Developer - this IS software development ✓
   - "Automatiseringsteamet" = Automation team - RPA/automation focus
   - This is SOFTWARE automation (RPA, Power Platform), NOT industrial PLC ✓

2. TECHNOLOGY CHECK:
   - Power Platform, Power Automate - automation tools user knows ✓
   - Web apps, mobile apps - software development ✓
   - This is modern business automation, not SCADA/PLC ✓

3. RPA vs PLC DISTINCTION:
   - RPA (Robotic Process Automation) = software-based automation ✓
   - PLC (Programmable Logic Controller) = industrial hardware ✗
   - This job is RPA/software automation, which we ACCEPT ✓

4. EXPERIENCE CHECK:
   - Not specified - could be any level ✓

DECISION: MATCH with good confidence (0.8)
This is exactly the kind of IT/automation role we're looking for!
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.8,
      matchReasoning: 'App developer role in automation team using Power Platform and RPA. This is software-based automation, not industrial PLC. Good match for IT/automation skills.',
    },
  },

  // Example 6: IT-udvikler (SHOULD MATCH)
  itDeveloperMatch: {
    input: `
Job: IT-udvikler
Virksomhed: Herning Vand A/S
Sted: Herning
Teknologier: BI-rapporter, automatisering, RPA
Erfaring: Ikke specificeret
`,
    reasoning: `
<thinking>
Let me analyze this IT-udvikler position:

1. JOB TYPE CHECK:
   - "IT-udvikler" = IT Developer - general IT development role ✓
   - Even if utility company, the ROLE is IT development ✓

2. TECHNOLOGY CHECK:
   - BI-rapporter (BI reports) - data/reporting work ✓
   - Automatisering - automation ✓
   - RPA - software automation ✓

3. DOMAIN CHECK:
   - Company is "Herning Vand" (water utility)
   - But the ROLE is IT development, not water management ✓
   - IT roles in non-tech companies are still valid IT jobs ✓

4. INCLUSION PRINCIPLE:
   - User wants to see ALL relevant IT jobs
   - This is clearly an IT development position
   - INCLUDE with medium-high confidence

DECISION: MATCH with confidence (0.75)
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.75,
      matchReasoning: 'IT developer role with BI and RPA work. Even though company is a utility, the role itself is IT development. Good match for automation skills.',
    },
  },

  // Example 7: DevOps (SHOULD MATCH)
  devopsMatch: {
    input: `
Job: DevOps Engineer
Virksomhed: KMD A/S
Sted: Aalborg
Teknologier: Kubernetes, Docker, Azure, CI/CD, security
Erfaring: Solid erfaring med infrastruktur
`,
    reasoning: `
<thinking>
Let me analyze this DevOps position:

1. JOB TYPE CHECK:
   - "DevOps Engineer" - DevOps is part of software development ✓
   - DevOps enables developers, it's a core IT/software role ✓

2. TECHNOLOGY CHECK:
   - Kubernetes, Docker - containerization ✓
   - Azure - cloud, matches skills ✓
   - CI/CD - developer tooling ✓
   - Security - important in modern dev ✓

3. IS DevOps SOFTWARE DEVELOPMENT?
   - YES! DevOps is infrastructure-as-code, automation, developer enablement
   - It requires coding skills (scripts, IaC, automation)
   - User explicitly wants DevOps roles ✓

4. EXPERIENCE CHECK:
   - "Solid erfaring" = solid experience - likely senior but not explicitly stated
   - Flag as potentially senior but INCLUDE ✓

DECISION: MATCH with confidence (0.8)
</thinking>
`,
    output: {
      matched: true,
      confidence: 0.8,
      matchReasoning: 'DevOps Engineer with Kubernetes, Docker, Azure. DevOps is software/infrastructure automation and matches IT development skills. Good match.',
    },
  },
}

/**
 * Examples for the research agent
 */
export const RESEARCH_EXAMPLES = {
  linkedinWorkaround: {
    problem: 'Job URL is linkedin.com/jobs/... which requires authentication',
    solution: `
1. Extract company name and position from the LinkedIn URL or email
2. Search for "[Company] [Position] karriere" or "[Company] careers [Position]"
3. Look for company career page in results
4. If not found, search on jobindex.dk or it-jobbank.dk
5. Extract full job description from public source
6. VALIDATE: Confirm company and position match before concluding!
`,
  },

  jobindexDeepLink: {
    problem: 'Jobindex shows listing but job description is on another portal',
    solution: `
1. Extract the job from jobindex search results
2. Look for "Se jobbet" or "Ansøg" link
3. Follow that link to the actual company portal
4. Extract full job description from the company site
5. VALIDATE: Confirm this is the correct job before concluding!
`,
  },

  // Validation examples to avoid wrong matches
  validationWrongLocation: {
    problem: 'Found ABB job in Bangalore but expected Aalborg, Denmark',
    solution: `
This is the WRONG JOB - same company, same role, but different location/country!

<validation_thinking>
1. Company Match: ✅ Content mentions "ABB" 
2. Position Match: ✅ "Software Developer" 
3. Location Match: ❌ WRONG COUNTRY - Content says "Bangalore, India" but expected "Aalborg, Denmark"
4. Content Type: ✅ Real job posting
</validation_thinking>

Decision: NOT FOUND - Different office, different job
Action: Search specifically for "ABB Aalborg Denmark Software Developer careers"
`,
  },

  validationGenericTemplate: {
    problem: 'Found indeed.com/hire/job-description/full-stack-developer instead of actual Unleash job',
    solution: `
This is a TEMPLATE page, not a real job posting!

<validation_thinking>
1. Company Match: ❌ No mention of "Unleash" anywhere in content
2. Position Match: ⚠️ Title says "Full Stack Developer" but generic
3. Location Match: ❌ No specific location 
4. Content Type: ❌ TEMPLATE - URL "/hire/job-description/" is Indeed's template generator for employers
</validation_thinking>

Decision: NOT FOUND - This is a generic template, not the actual job
Action: Search for "Unleash careers Full Stack Developer" or "Unleash company jobs"
`,
  },

  validationSuccess: {
    problem: 'How does successful validation look?',
    solution: `
Found actual Getinge job on careers.getinge.com

<validation_thinking>
1. Company Match: ✅ Content prominently mentions "Getinge" 
2. Position Match: ✅ "Full-Stack Developers - Join Us in Shaping the Future of Digital Health" - exact match
3. Location Match: ✅ Content says "Copenhagen" which matches expected "København"
4. Content Type: ✅ Real job - has specific requirements, team info, application details
</validation_thinking>

Decision: FOUND ✅ - All validations pass
`,
  },
}

