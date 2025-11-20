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
 * @returns Refined goal, key terms, and expected content
 */
export async function extractUserIntentFromEmail(
  emailContent: string,
  emailSubject: string,
  matchCriteria: string,
  extractionFields: string,
  userIntent?: string,
  linkGuidance?: string
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

**Your Task**:
Extract the SPECIFIC details the user is looking for based on their goal and the email content.

Think about:
1. What specific keywords/technologies/terms are mentioned in the email?
2. What is the user's end goal (not just surface-level keywords)?
3. What kind of content would be on pages containing this information?

**Important**: 
- Link text might be generic ("Software Developer", "IT jobs", "View Details")
- But the SPECIFIC details the user wants (.NET, JavaScript, RPA, specific amounts, etc.) are often INSIDE those links
- Extract key terms that should appear in the TARGET PAGES, not necessarily in link text

**Return JSON**:
{
  "refinedGoal": "specific description incorporating email context and user's end goal",
  "keyTerms": ["term1", "term2", "term3"],
  "expectedContent": "what should be on relevant pages to match user's needs"
}

**Examples of good extraction**:
- If user wants "IT and software jobs" but email mentions ".NET developer, JavaScript" → keyTerms: [".NET", "JavaScript", "software developer"]
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
 * @param buttonTextPattern - Optional pattern to boost link ranking (e.g., "Se jobbet|Apply")
 * @param emailIntent - Optional intent extracted from email content
 * @returns Selected URLs in order of relevance
 */
export async function prioritizeLinksWithAI(
  links: ExtractedLink[],
  matchCriteria: string,
  extractionFields: string,
  buttonTextPattern?: string,
  emailIntent?: EmailIntent
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
  
  // Build prompt with all links and context
  const linksDescription = links.slice(0, 50).map((link, i) => {
    const buttonBadge = buttonTextPattern && new RegExp(buttonTextPattern, 'i').test(link.text)
      ? ' ⭐ MATCHES BUTTON PATTERN'
      : ''
    
    return `${i + 1}. URL: ${link.url}
   Text: "${link.text}"
   Type: ${link.isButton ? 'Button' : 'Link'}${buttonBadge}`
  }).join('\n\n')
  
  const prompt = `You are analyzing links from an email to determine which pages likely contain the information the user needs.

**User's Goal**:
${emailIntent?.refinedGoal || matchCriteria}

${emailIntent?.keyTerms && emailIntent.keyTerms.length > 0 ? `**Key Terms from Email** (look for pages with these specifics):
${emailIntent.keyTerms.join(', ')}
` : ''}

**What User Wants to Extract**:
${extractionFields}

${emailIntent?.expectedContent ? `**Expected Page Content**:
${emailIntent.expectedContent}
` : ''}

${buttonTextPattern ? `**Priority Signal**: Links with text matching "${buttonTextPattern}" are marked with ⭐ below. These are strong candidates.
` : ''}

**All Links Found** (${Math.min(links.length, 50)} shown):
${linksDescription}

${links.length > 50 ? `\n... and ${links.length - 50} more links (truncated for brevity)\n` : ''}

**CRITICAL UNDERSTANDING**:
Link text is often GENERIC (e.g., "Software Developer", "IT jobs", "View Details", "Learn More").
The SPECIFIC information the user wants (${emailIntent?.keyTerms?.slice(0, 3).join(', ') || 'key terms'}) is usually INSIDE the pages, not in the link text.

**Your Task**:
Select links that are likely to lead to pages containing the specific information mentioned in "Key Terms" and "User's Goal".

**Selection Reasoning**:
1. ✅ Generic job/opportunity/content links MIGHT contain the specifics - include them if they could relate to the goal
2. ✅ Links marked with ⭐ (button pattern) are strong signals - prioritize these
3. ✅ Think about the user's END GOAL and what pages would have that information
4. ❌ Skip: Truly irrelevant links (homepage, login, social media, unsubscribe, about, terms, privacy, generic navigation)

**Examples**:
- Link text: "Software Developer Position" (generic) → SELECT if user wants .NET/JavaScript jobs (specifics likely inside)
- Link text: "Investment Opportunity" (generic) → SELECT if user wants fintech/equity investments (specifics likely inside)
- Link text: "View Job" or "Se jobbet" (generic action) → SELECT if it could relate to user's goal
- Link text: "About Us" or "Privacy Policy" → SKIP (truly irrelevant)

**Return Format**: 
- Comma-separated numbers in order of relevance (e.g., "5, 12, 3, 18, 7")
- If NO relevant links: Return exactly "NONE"
- NO explanations, just numbers or "NONE"

Response:`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are an expert at understanding user intent and identifying which pages likely contain specific information. You understand that link text is often generic but the specifics are inside the pages. Use reasoning about the user\'s end goal to select relevant links. Return ONLY comma-separated numbers or "NONE". No explanations.'
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0,
      max_tokens: 200,
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
    const indices = content
      .split(',')
      .map(s => {
        const num = parseInt(s.trim())
        return num - 1 // Convert to 0-based index
      })
      .filter(i => !isNaN(i) && i >= 0 && i < links.length)
    
    const selectedUrls = indices.map(i => links[i].url)
    
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

