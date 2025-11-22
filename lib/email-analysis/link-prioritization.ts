/**
 * AI-Based Link Prioritization
 * Uses GPT-4o-mini to intelligently select which links to scrape based on user criteria
 * No hardcoded max limits - AI decides relevance
 */

import OpenAI from 'openai'
import type { ExtractedLink, EmailIntent } from './types'

export interface LinkPrioritizationResult {
  selectedUrls: string[]
  reasoning: string
  totalLinks: number
  selectedCount: number
}

/**
 * Extract user intent from email content
 * Analyzes email text to understand what the user is really looking for
 * This helps with link selection when link text is generic but specifics are inside
 * 
 * @param emailContent - Plain text email content (not HTML)
 * @param emailSubject - Email subject line
 * @param matchCriteria - User's match criteria from agent config
 * @param extractionFields - User's extraction fields from agent config
 * @param userIntent - Optional user intent from agent config
 * @param linkGuidance - Optional link selection guidance from agent config
 * @param extractionExamples - Optional examples of expected extraction format
 * @param analysisFeedback - Optional user feedback about what works/fails
 * @returns Refined goal, key terms, and expected content
 */
export async function extractUserIntentFromEmail(
  emailContent: string,
  emailSubject: string,
  matchCriteria: string,
  extractionFields: string,
  userIntent?: string,
  linkGuidance?: string,
  extractionExamples?: string,
  analysisFeedback?: string
): Promise<EmailIntent> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  // Truncate email content to first 2000 chars (enough for context, keeps cost low)
  const truncatedContent = emailContent.substring(0, 2000)
  
  const prompt = `Analyze this email to understand what specific information the user is looking for.

**User's Goal (from agent configuration)**:
${matchCriteria}

**What User Wants to Extract**:
${extractionFields}

${userIntent ? `**User's Intent/Context**: ${userIntent}\n` : ''}
${linkGuidance ? `**Link Selection Guidance**: ${linkGuidance}\n` : ''}

**Email Subject**: ${emailSubject}

**Email Content** (first 2000 chars):
${truncatedContent}

${extractionExamples ? `
---
## Examples of Expected Extractions

The user has provided these examples of what they want to extract:
${extractionExamples}

Use these examples to understand the TYPE, FORMAT, and SPECIFICITY of information the user is looking for.
When analyzing the email, look for terms and concepts that would lead to pages containing data in this format.
---
` : ''}

${analysisFeedback ? `
---
## CRITICAL: Known Issues to Avoid

The user has noted these problems with past analyses:
${analysisFeedback}

Pay SPECIAL ATTENTION to avoiding these issues when analyzing this email.
If feedback mentions over-including certain content, be more conservative.
If feedback mentions missing relevant content, be more inclusive.
This feedback represents ACTUAL PROBLEMS the user experienced - treat it as a hard constraint.
---
` : ''}

**Your Task**:
Extract the SPECIFIC details the user is looking for based on their goal and the email content.

Think step-by-step:
1. What specific keywords/technologies/terms are mentioned in the email?
2. What is the user's end goal (not just surface-level keywords)?
3. What kind of content would be on pages containing this information?
4. ${extractionExamples ? 'Do the key terms I\'m extracting match the TYPE of data shown in the examples?' : ''}
5. ${analysisFeedback ? 'Am I avoiding the problems mentioned in the feedback?' : ''}

**Important**: 
- Link text might be generic ("View Details", "Read More", "Click Here")
- But the SPECIFIC details the user wants (technologies, amounts, dates, etc.) are often INSIDE those links
- Extract key terms that should appear in the TARGET PAGES, not necessarily in link text

**Return JSON**:
{
  "refinedGoal": "specific description incorporating email context and user's end goal",
  "keyTerms": ["term1", "term2", "term3"],
  "expectedContent": "what should be on relevant pages to match user's needs"
}

**Examples of good extraction**:
- If user wants "software developer positions" but email mentions ".NET developer, JavaScript" → keyTerms: [".NET", "JavaScript", "software developer"]
- If user wants "investment opportunities" but email says "fintech startup, €750K" → keyTerms: ["fintech", "€750K", "startup", "equity"]
- If user wants "order details" but email is about "refund #12345" → keyTerms: ["refund", "order #12345", "return"]

Return only valid JSON.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You extract user intent and key terms from email content to guide link selection. You understand that link text is often generic but specifics are inside the links. Return only valid JSON.'
      }, {
        role: 'user',
        content: prompt
      }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 500,
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    return {
      refinedGoal: result.refinedGoal || matchCriteria,
      keyTerms: result.keyTerms || [],
      expectedContent: result.expectedContent || 'Relevant information matching user criteria'
    }
  } catch (error) {
    console.error('❌ Intent extraction failed, using original criteria:', error)
    return {
      refinedGoal: matchCriteria,
      keyTerms: [],
      expectedContent: 'Relevant information matching user criteria'
    }
  }
}

/**
 * Use AI to prioritize which links are most relevant to user's criteria
 * Button text pattern is used as a boost signal, not a hard filter
 * 
 * @param links - All links extracted from email
 * @param matchCriteria - User's match criteria (what they're interested in)
 * @param extractionFields - What the user wants to extract
 * @param buttonTextPattern - Optional pattern to boost link ranking (e.g., "View Details|Apply|Read More")
 * @param emailIntent - Optional intent extracted from email content
 * @param linkGuidance - Optional guidance for link selection
 * @param extractionExamples - Optional examples of expected extraction format
 * @param analysisFeedback - Optional user feedback about what works/fails
 * @returns Selected URLs in order of relevance
 */
export async function prioritizeLinksWithAI(
  links: ExtractedLink[],
  matchCriteria: string,
  extractionFields: string,
  buttonTextPattern?: string,
  emailIntent?: EmailIntent,
  linkGuidance?: string,
  extractionExamples?: string,
  analysisFeedback?: string
): Promise<LinkPrioritizationResult> {
  console.log(`\n🤖 AI Link Prioritization: Analyzing ${links.length} links...`)
  
  if (links.length === 0) {
    console.log('⚠️  No links to prioritize')
    return {
      selectedUrls: [],
      reasoning: 'No links found in email',
      totalLinks: 0,
      selectedCount: 0
    }
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  // Separate button pattern matches from regular links
  const buttonPatternRegex = buttonTextPattern ? new RegExp(buttonTextPattern, 'i') : null
  const buttonMatchLinks: ExtractedLink[] = []
  const regularLinks: ExtractedLink[] = []
  
  links.forEach(link => {
    if (buttonPatternRegex && buttonPatternRegex.test(link.text)) {
      buttonMatchLinks.push(link)
    } else {
      regularLinks.push(link)
    }
  })
  
  console.log(`   🎯 Button pattern matches: ${buttonMatchLinks.length}`)
  console.log(`   📋 Other links: ${regularLinks.length}`)
  
  // Build link lists with clear separation
  const buttonLinksDescription = buttonMatchLinks.length > 0
    ? buttonMatchLinks.slice(0, 20).map((link, i) => {
        // Clean URL display - extract domain and key params
        const cleanUrl = link.url.length > 100 
          ? link.url.substring(0, 100) + '...'
          : link.url
        
        return `${i + 1}. 🎯 PRIORITY: "${link.text}" → ${cleanUrl}`
      }).join('\n')
    : ''
  
  const regularLinksDescription = regularLinks.slice(0, 30).map((link, i) => {
    const cleanUrl = link.url.length > 100 
      ? link.url.substring(0, 100) + '...'
      : link.url
    const number = buttonMatchLinks.length + i + 1
    
    return `${number}. "${link.text}" → ${cleanUrl}`
  }).join('\n')
  
  const prompt = `You are selecting links from an email that will lead to pages containing specific information.

**USER'S GOAL**: ${emailIntent?.refinedGoal || matchCriteria}

${emailIntent?.keyTerms && emailIntent.keyTerms.length > 0 ? `**KEY TERMS TO FIND**: ${emailIntent.keyTerms.join(', ')}` : ''}

**WHAT TO EXTRACT**: ${extractionFields}

${linkGuidance ? `**LINK GUIDANCE**: ${linkGuidance}\n` : ''}

${buttonTextPattern ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  CRITICAL: BUTTON PATTERN PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user has configured "${buttonTextPattern}" as their PRIMARY LINK PATTERN.

Links marked with 🎯 match this pattern and should be STRONGLY PREFERRED.
These are the MAIN content links the user wants analyzed.

Unless a 🎯 link is CLEARLY irrelevant (like "unsubscribe" or "privacy policy"),
you should SELECT IT.

Regular links are SECONDARY - only select if they clearly relate to the goal.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${analysisFeedback ? `
⚠️  PAST MISTAKES TO AVOID:
${analysisFeedback}

Do NOT repeat these errors. This is critical feedback from the user.
` : ''}

**IMPORTANT NOTE ABOUT URLs**:
Many URLs may be wrapped in email protection services (like Outlook SafeLinks: safelinks.protection.outlook.com).
These will redirect to the actual destination. Focus on the LINK TEXT and CONTEXT, not the SafeLinks URL.
The actual destination URL will be revealed after scraping.

**AVAILABLE LINKS**:

${buttonMatchLinks.length > 0 ? `🎯 PRIORITY LINKS (button pattern matches):
${buttonLinksDescription}

` : ''}REGULAR LINKS:
${regularLinksDescription}

${links.length > (buttonMatchLinks.length + 30) ? `\n... and ${links.length - buttonMatchLinks.length - 30} more links not shown\n` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECTION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🎯 STRONGLY PREFER button pattern matches - these are the primary content
2. ✅ Links with content-specific words are likely relevant
3. ❌ SKIP: navigation, login, settings, unsubscribe, social media, about/terms/privacy, company homepages
4. 💭 THINK: Would this page contain the KEY TERMS and specific data the user needs?

**CRITICAL**: Link text is often generic ("View Details", "Read More", "Click Here").
The SPECIFICS (${emailIntent?.keyTerms?.slice(0, 3).join(', ') || 'technologies, amounts, details'}) are INSIDE the pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**RESPOND**: Comma-separated numbers ONLY (e.g., "1, 2, 5, 8") or "NONE"
Put button pattern matches FIRST, then other relevant links.
NO explanations, just numbers or "NONE":`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are an expert link selector. You STRONGLY PRIORITIZE links marked with 🎯 (button pattern) as these are the user\'s configured primary content. Link text is often generic but specifics are inside. Think about the end goal and what pages would contain the key terms. Return ONLY comma-separated numbers (button pattern first) or "NONE". NO text, NO explanations.'
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0,
      max_tokens: 150,
    })
    
    const content = response.choices[0].message.content?.trim() || 'NONE'
    
    console.log(`🤖 AI Response: "${content}"`)
    
    if (content === 'NONE' || content === 'none') {
      console.log('📊 AI found no relevant links')
      return {
        selectedUrls: [],
        reasoning: 'AI determined no links are relevant to user criteria',
        totalLinks: links.length,
        selectedCount: 0
      }
    }
    
    // Parse AI response
    // IMPORTANT: AI saw links in this order: [buttonMatchLinks, regularLinks]
    // So we need to map indices to the reordered array, not the original
    const reorderedLinks = [...buttonMatchLinks, ...regularLinks]
    
    const indices = content
      .split(',')
      .map(s => {
        const num = parseInt(s.trim())
        return num - 1 // Convert to 0-based index
      })
      .filter(i => !isNaN(i) && i >= 0 && i < reorderedLinks.length)
    
    const selectedUrls = indices.map(i => reorderedLinks[i].url)
    
    console.log(`✅ AI selected ${selectedUrls.length}/${links.length} relevant links`)
    selectedUrls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`)
    })
    
    return {
      selectedUrls,
      reasoning: `AI identified ${selectedUrls.length} links as relevant to user criteria`,
      totalLinks: links.length,
      selectedCount: selectedUrls.length
    }
    
  } catch (error) {
    console.error('❌ AI link prioritization failed:', error)
    
    // Fallback: Use button pattern filter if available, otherwise return empty
    if (buttonTextPattern) {
      const pattern = new RegExp(buttonTextPattern, 'i')
      const filteredLinks = links
        .filter(link => pattern.test(link.text))
        .map(link => link.url)
      
      console.log(`⚠️  Fallback: Using button pattern filter (${filteredLinks.length} links)`)
      
      return {
        selectedUrls: filteredLinks,
        reasoning: 'AI failed, used button pattern as fallback',
        totalLinks: links.length,
        selectedCount: filteredLinks.length
      }
    }
    
    console.log('⚠️  Fallback: No links selected due to AI failure and no button pattern')
    return {
      selectedUrls: [],
      reasoning: 'AI prioritization failed and no fallback available',
      totalLinks: links.length,
      selectedCount: 0
    }
  }
}

