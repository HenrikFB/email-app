/**
 * AI-Based Link Prioritization
 * Uses GPT-4o-mini to intelligently select which links to scrape based on user criteria
 * No hardcoded max limits - AI decides relevance
 */

import OpenAI from 'openai'
import type { ExtractedLink } from './types'

export interface LinkPrioritizationResult {
  selectedUrls: string[]
  reasoning: string
  totalLinks: number
  selectedCount: number
}

/**
 * Use AI to prioritize which links are most relevant to user's criteria
 * Button text pattern is used as a boost signal, not a hard filter
 * 
 * @param links - All links extracted from email
 * @param matchCriteria - User's match criteria (what they're interested in)
 * @param extractionFields - What the user wants to extract
 * @param buttonTextPattern - Optional pattern to boost link ranking (e.g., "Se jobbet|Apply")
 * @returns Selected URLs in order of relevance
 */
export async function prioritizeLinksWithAI(
  links: ExtractedLink[],
  matchCriteria: string,
  extractionFields: string,
  buttonTextPattern?: string
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
  
  const prompt = `You are analyzing links from an email to determine which are most relevant for data extraction.

**User's Interest (Match Criteria)**:
${matchCriteria}

**What User Wants to Extract**:
${extractionFields}

${buttonTextPattern ? `**Button Text Hint** (boost if present, not required): ${buttonTextPattern}\nLinks matching this pattern are marked with ⭐` : ''}

**All Links Found** (${Math.min(links.length, 50)} shown):
${linksDescription}

${links.length > 50 ? `\n... and ${links.length - 50} more links (truncated for brevity)\n` : ''}

**Task**: Select the link numbers that are:
1. ✅ Directly related to user's interests and extraction needs
2. ✅ Likely to contain the information user wants to extract
3. ❌ NOT generic/irrelevant (homepages, login, social media, unsubscribe, about us, terms of service, privacy policy, generic navigation)
4. ⭐ Give preference to links matching button pattern (but don't exclude other relevant links)

**Return Format**: 
- If relevant links exist: Return comma-separated numbers in order of relevance (e.g., "5, 12, 3, 18, 7")
- If NO relevant links: Return exactly "NONE"
- Do NOT add explanations, just the numbers or "NONE"

Response:`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are a link relevance analyzer. Return ONLY comma-separated numbers or "NONE". No explanations.'
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

