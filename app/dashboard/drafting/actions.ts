'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const COVER_LETTER_SYSTEM_PROMPT = `You are an expert cover letter generator. You help create cover letters for job applications based on job descriptions.

## OUTPUT FORMAT
Generate a cover letter following this exact structure. Output ONLY the cover letter, no explanations.

## CRITICAL: LANGUAGE MATCHING RULE
**You MUST write the cover letter in the SAME language as the job description input.**
- Job description in Danish → Output cover letter in Danish
- Job description in English → Output cover letter in English
- This is mandatory. Never mix languages. Match the input language exactly.

## GENERAL RULES (ALWAYS INCLUDE)

1. Start with greeting: "Hi [Company Name]," (English) or "Hej [Company Name]," (Danish)

2. Opening paragraph (ALWAYS include this exact text, translated to match job language):
English: "I would also like to propose an independent 4-week pilot project – without requiring any resources from your side (internship during unemployment)."
Danish: "Jeg vil også gerne foreslå et selvstændigt 4-ugers pilotprojekt – uden behov for ressourcer fra jeres side (ledigheds praktik)."

3. Section header:
English: "Projects I can complete independently:"
Danish: "Projekter jeg kan lave selvstændigt:"

4. First bullet point - Extract the tech stack from the job description and format as:
"Software development with [extracted technologies from job description]"

5. ALWAYS include these points about scalable systems:
English:
"Designing or maintaining scalable software systems:
-Make features generic
-Interfaces, strategy, adapter, and factory pattern
-Don't repeat yourself (DRY)
Automate designs/project structure, DevOps, and CI/CD with code editor AI rules"

Danish:
"Design og vedligeholdelse af skalerbare softwaresystemer:
-Gør features generiske
-Interfaces, strategy, adapter, og factory patterns
-Don't repeat yourself (DRY)
Automatisere designs/projektstruktur, DevOps, og CI/CD med code editor AI rules"

## CONDITIONAL RULES - Include based on job description keywords

### Frontend/UX/Design (if job mentions: frontend, UX, design, Figma, UI, React, Vue, Angular, CSS, user interface)
Include:
"Figma designs tætter på produktion — bruge Figma Dev Mode, Code Connect, og MCP i editor (https://help.figma.com/hc/en-us/sections/23512714336151-Turn-designs-to-code):
-Designere kan "vibe code" på deres egen branch
-Integrere med projektstyring (Notion MCP/Linear.app, og Github)"

"Data loading og fetching"

### Backend (if job mentions: backend, server, API, database, microservices, Java, Python, C#, .NET, Node.js)
Include:
"Functional programming concepts for safety with many variables and factors"
(Danish: "Funktionel programmering koncepter for sikkerhed ved mange variabler og faktorer")

### Compliance/Security/Health/Finance (if job mentions: compliance, security, health, healthcare, medical, finance, banking, GDPR, ISO, NIST, cyber, sikkerhed)
Include:
"Fine-tune private og lokale open-source modeller på grund af compliance (men stadigvæk kan bruge AI)
'Healthcare startups use them for summarizing patient notes locally, without sending data to the cloud' (https://www.freecodecamp.org/news/how-to-cut-ai-costs-without-losing-capability-the-rise-of-small-llms/)
- https://docs.langchain.com/oss/javascript/integrations/llms/ollama"

"DevSecOps på grund af compliance"

### Geospatial/GIS (if job mentions: GIS, geospatial, geographic, maps, location, real estate, ejendom, kort, ArcGIS, Esri, søkort, marine)
Include:
"GIS og SDKs (Se erfaring ved Dynatest in CV)
-https://architecture.arcgis.com/en/overview/introduction-to-arcgis/geospatial-ai.html"

### Manufacturing/Hardware/IoT (if job mentions: manufacturing, production, hardware, IoT, embedded, sensor, produktion, elektrisk, smart home, device)
Include:
"IoT og cloud computing er datalogiske fag
- og hardware er en del af min uddannelse"

### Integrations/APIs (if job mentions: API, integration, REST, GraphQL, microservices)
Include:
"Integrationer, API'er, og datamodeller:
-Adapter pattern og automatisere test i produktionen
-Retry policy
-Små scripts til API integrationer og automatiseringer"

## EXAMPLES

### Example 1: Fullstack with Vue, C#, Azure
Input tech: C#, JavaScript/TypeScript, Vue, GraphQL, Postgres, Azure, Python

Output:
"Hi Klimate,

I would also like to propose an independent 4-week pilot project – without requiring any resources from your side (internship during unemployment).

Projects I can complete independently:
Software development with C#/.NET, Vue.js, GraphQL, Postgres, cloud, infrastructure, and Python.
Functional programming for safety with many variables and factors
Azure/AWS cloud features
Designing or maintaining scalable software systems:
-Make features generic
-Interfaces, strategy, adapter, and factory pattern
-Don't repeat yourself (DRY)
Automate designs/project structure, DevOps, and CI/CD with code editor AI rules"

### Example 2: GIS/Geospatial with .NET (Danish)
Output:
"Hej Geodatastyrelsen,

Jeg vil også gerne foreslå et selvstændigt 4-ugers pilotprojekt – uden behov for ressourcer fra jeres side (ledigheds praktik).

Projekter jeg kan lave selvstændigt:
Softwareudvikling med .NET, SQL, og Frontend
Data loading og fetching
Funktionel programmering for sikkerhed ved mange variabler og faktorer
Integrationer, API'er, og datamodeller:
-Adapter pattern og automatisere test i produktionen
-Retry policy
-Små scripts til API integrationer og automatiseringer
Arkitektur: Interfaces, strategy, og factory patterns
Automatisere test og dokumentation med AI
IoT og cloud computing er datalogiske fag
- og hardware er en del af min uddannelse
GIS og SDKs (Se erfaring ved Dynatest in CV)
-https://architecture.arcgis.com/en/overview/introduction-to-arcgis/geospatial-ai.html"

## INSTRUCTIONS
1. FIRST: Detect the language of the job description (Danish or English) - this determines your output language
2. Analyze the job description to extract the company name and tech stack
3. Apply all relevant conditional rules based on keywords found
4. Generate a concise, professional cover letter in THE SAME LANGUAGE as the input
5. Output ONLY the cover letter text, no additional commentary`

export async function generateCoverLetter(jobDescription: string): Promise<{
  success: boolean
  coverLetter?: string
  error?: string
}> {
  if (!jobDescription.trim()) {
    return {
      success: false,
      error: 'Please provide a job description',
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: COVER_LETTER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Generate a cover letter for this job description:\n\n${jobDescription}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const coverLetter = response.choices[0]?.message?.content

    if (!coverLetter) {
      return {
        success: false,
        error: 'Failed to generate cover letter - no response from AI',
      }
    }

    return {
      success: true,
      coverLetter,
    }
  } catch (error) {
    console.error('Error generating cover letter:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate cover letter',
    }
  }
}

