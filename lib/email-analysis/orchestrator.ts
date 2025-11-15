/**
 * Email Analysis Orchestrator
 * Coordinates the full analysis pipeline with two-pass optimization:
 * 
 * PASS 1 (Match Check): Uses FULL email content + visible links to check relevance
 * - AI sees complete email HTML and all links found
 * - Determines if email matches user's criteria
 * - If no match, stops here (saves Firecrawl credits by not scraping)
 * 
 * PASS 2 (Link Scraping): Only runs if Pass 1 matched
 * - Scrapes up to 5 links with Firecrawl
 * - Full AI analysis with email + scraped content
 * - Extracts structured data based on user-defined fields
 */

import { getEmailById } from '@/lib/microsoft-graph/client'
import { extractLinksFromHtml } from './link-extractor'
import { scrapeUrls } from '@/lib/firecrawl/client'
import { analyzeEmailContent } from '@/lib/openai/analyzer'
import OpenAI from 'openai'
import type { AnalysisJobInput, AnalysisJobResult, ScrapedPage, ExtractedLink } from './types'

/**
 * PASS 1: Quick match check using FULL email content and available links
 * This determines if the email is relevant before spending credits on scraping
 * 
 * @param email - Full email object with HTML content
 * @param links - All links found in the email
 * @param matchCriteria - User-defined match criteria
 * @returns Whether the email appears to match the criteria
 */
async function quickMatchCheck(
  email: { subject: string; from: { address: string }; htmlBody: string },
  links: string[],
  matchCriteria: string
): Promise<{ matched: boolean; reasoning: string; confidence: number }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const linksSection = links.length > 0 
    ? `\n\nLinks found in email:\n${links.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
    : '\n\nNo links found in email.'

  const prompt = `You are evaluating if an email is relevant to a user's interests.

Email Subject: ${email.subject}
Email From: ${email.from.address}

Email Content:
${email.htmlBody}
${linksSection}

User's Interest (Match Criteria):
${matchCriteria}

Based on the FULL email content and links available, does this email match the user's interests?
This is Pass 1 - if it matches, we'll scrape the links in Pass 2 for deeper analysis.

Return a JSON object with:
{
  "matched": boolean,  // true if relevant, false if clearly not relevant
  "reasoning": string, // Brief explanation (2-3 sentences) of why it matches or doesn't
  "confidence": number // 0.0-1.0 confidence score
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an email relevance evaluator. You see the full email content and links. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return {
      matched: result.matched || false,
      reasoning: result.reasoning || 'Quick match check completed',
      confidence: result.confidence || 0.5,
    }
  } catch (error) {
    console.error('Quick match check failed:', error)
    // If quick check fails, assume it might be relevant (better to over-include than miss)
    return {
      matched: true,
      reasoning: 'Quick match check failed, proceeding with full analysis to be safe',
      confidence: 0.5,
    }
  }
}

/**
 * Main orchestrator for email analysis
 * Fully generic - uses user-defined match and extraction criteria
 * Implements two-pass analysis to save Firecrawl credits
 * 
 * @param input - Analysis job configuration
 * @returns Analysis result with matched status and extracted data
 */
export async function analyzeEmail(
  input: AnalysisJobInput
): Promise<AnalysisJobResult> {
  const scrapingStrategy = input.agentConfig.scraping_strategy || 'two-pass'
  
  try {
    console.log('\n🔍 ========== STARTING EMAIL ANALYSIS ==========')
    console.log('📧 Email ID:', input.emailId)
    console.log('🎯 Match Criteria:', input.agentConfig.match_criteria)
    console.log('📋 Extraction Fields:', input.agentConfig.extraction_fields)
    console.log('🔗 Follow Links:', input.agentConfig.follow_links)
    console.log('⚙️  Scraping Strategy:', scrapingStrategy)

    // STEP 1: Fetch email from Microsoft Graph
    console.log('\n📥 Step 1: Fetching email from Microsoft Graph...')
    const email = await getEmailById(input.accessToken, input.emailId)

    if (!email) {
      throw new Error('Email not found')
    }

    const emailHtmlBody = email.body?.content || email.snippet || ''
    
    console.log('✅ Email fetched:', {
      subject: email.subject,
      from: email.from.address,
      hasBody: !!email.body?.content,
      bodyLength: emailHtmlBody.length
    })

    // STEP 2: Extract ALL links first (we'll decide which to scrape later)
    let allLinks: ExtractedLink[] = []
    let allLinksFound: string[] = []
    
    if (emailHtmlBody) {
      allLinks = extractLinksFromHtml(emailHtmlBody, {
        maxLinks: 10, // Get up to 10 links for reference
      })
      allLinksFound = allLinks.map(link => link.url)
      console.log(`🔗 Found ${allLinks.length} links in email`)
    }

    // STEP 3: Determine if we should scrape (based on strategy)
    let shouldScrape = false
    let quickMatchResult: { matched: boolean; reasoning: string; confidence: number } | null = null

    if (input.agentConfig.follow_links && allLinks.length > 0) {
      if (scrapingStrategy === 'two-pass') {
        // PASS 1: Quick match check with FULL email content and links
        console.log('\n🚦 Pass 1: Quick match check (full email + links visible)...')
        quickMatchResult = await quickMatchCheck(
          {
            subject: email.subject,
            from: email.from,
            htmlBody: emailHtmlBody,
          },
          allLinksFound,
          input.agentConfig.match_criteria
        )
        
        console.log('✅ Quick match result:', {
          matched: quickMatchResult.matched,
          confidence: quickMatchResult.confidence,
          reasoning: quickMatchResult.reasoning
        })
        
        shouldScrape = quickMatchResult.matched
        
        if (!shouldScrape) {
          console.log('⏭️  Pass 2 skipped: Email did not match criteria (saved Firecrawl credits!)')
          console.log(`💰 Saved ~${allLinks.length} link scrapes = ~$${(allLinks.length * 0.01).toFixed(2)}`)
          
          // Return early with quick check results
          return {
            success: true,
            emailId: input.emailId,
            matched: false,
            extractedData: {},
            scrapedUrls: [],
            allLinksFound,
            emailHtmlBody,
            reasoning: quickMatchResult.reasoning,
            confidence: quickMatchResult.confidence,
          }
        }
        
        console.log('✅ Pass 1 matched! Proceeding to Pass 2 (link scraping)...')
      } else {
        // single-pass: always scrape
        shouldScrape = true
        console.log('⚙️  Single-pass mode: Will scrape all links regardless')
      }
    }

    // STEP 4: Scrape links if needed (PASS 2)
    let scrapedPages: ScrapedPage[] = []
    let scrapedUrls: string[] = []

    if (shouldScrape && allLinks.length > 0) {
      console.log('\n🌐 Pass 2: Scraping links with Firecrawl...')
      
      // Limit to first 5 links for scraping to control costs
      const linksToScrape = allLinks.slice(0, 5)
      const urls = linksToScrape.map(link => link.url)
      
      console.log(`📥 Scraping ${urls.length} URLs...`)
      
      const scrapeResults = await scrapeUrls(urls, {
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      })

      scrapedPages = scrapeResults
        .filter((result) => result.success && result.markdown)
        .map((result) => ({
          url: result.url,
          markdown: result.markdown!,
          title: result.metadata?.title,
        }))

      scrapedUrls = scrapedPages.map((page) => page.url)
      
      console.log(`✅ Successfully scraped ${scrapedPages.length}/${urls.length} pages`)
      scrapedPages.forEach((page, idx) => {
        console.log(`  ${idx + 1}. ${page.title || 'No title'} (${page.markdown.length} chars)`)
      })
    } else if (!input.agentConfig.follow_links) {
      console.log('\n⏭️  Step 2-3: Skipping link scraping (follow_links disabled)')
    }

    // STEP 5: Full AI analysis with OpenAI
    console.log('\n🤖 Full Analysis: Analyzing with OpenAI...')
    console.log('Sending to GPT-4o-mini:', {
      emailLength: emailHtmlBody.length,
      scrapedPages: scrapedPages.length,
      totalContent: emailHtmlBody.length + scrapedPages.reduce((sum, p) => sum + p.markdown.length, 0)
    })
    
    const analysis = await analyzeEmailContent({
      emailHtml: emailHtmlBody,
      emailSubject: email.subject,
      emailFrom: email.from.address,
      emailDate: email.receivedDateTime,
      scrapedContent: scrapedPages,
      matchCriteria: input.agentConfig.match_criteria,
      extractionFields: input.agentConfig.extraction_fields,
    })

    console.log('\n✅ Analysis complete!')
    console.log('📊 Results:', {
      matched: analysis.matched,
      confidence: analysis.confidence,
      extractedFields: Object.keys(analysis.extractedData),
      reasoning: analysis.reasoning.substring(0, 100) + '...'
    })
    console.log('========== EMAIL ANALYSIS COMPLETE ==========\n')

    return {
      success: true,
      emailId: input.emailId,
      matched: analysis.matched,
      extractedData: analysis.extractedData,
      scrapedUrls,
      allLinksFound,
      emailHtmlBody,
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
    }
  } catch (error) {
    console.error('❌ Email analysis failed:', error)
    
    return {
      success: false,
      emailId: input.emailId,
      matched: false,
      extractedData: {},
      scrapedUrls: [],
      allLinksFound: [],
      emailHtmlBody: '',
      reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

