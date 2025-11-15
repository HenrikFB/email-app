/**
 * Email Analysis Orchestrator
 * Coordinates the full analysis pipeline:
 * 1. Fetch email HTML from Microsoft Graph
 * 2. Extract links from HTML
 * 3. Scrape links with Firecrawl (if enabled)
 * 4. Analyze with OpenAI using user-defined criteria
 */

import { getEmailById } from '@/lib/microsoft-graph/client'
import { extractLinksFromHtml } from './link-extractor'
import { scrapeUrls } from '@/lib/firecrawl/client'
import { analyzeEmailContent } from '@/lib/openai/analyzer'
import type { AnalysisJobInput, AnalysisJobResult, ScrapedPage } from './types'

/**
 * Main orchestrator for email analysis
 * Fully generic - uses user-defined match and extraction criteria
 * 
 * @param input - Analysis job configuration
 * @returns Analysis result with matched status and extracted data
 */
export async function analyzeEmail(
  input: AnalysisJobInput
): Promise<AnalysisJobResult> {
  try {
    console.log('\n🔍 ========== STARTING EMAIL ANALYSIS ==========')
    console.log('📧 Email ID:', input.emailId)
    console.log('🎯 Match Criteria:', input.agentConfig.match_criteria)
    console.log('📋 Extraction Fields:', input.agentConfig.extraction_fields)
    console.log('🔗 Follow Links:', input.agentConfig.follow_links)

    // 1. Fetch full email with HTML body from Microsoft Graph
    console.log('\n📥 Step 1: Fetching email from Microsoft Graph...')
    const email = await getEmailById(input.accessToken, input.emailId)

    if (!email) {
      throw new Error('Email not found')
    }

    console.log('✅ Email fetched:', {
      subject: email.subject,
      from: email.from.address,
      hasBody: !!email.body?.content,
      bodyLength: email.body?.content?.length || 0
    })

    // 2. Extract links from email HTML (if follow_links is enabled)
    let scrapedPages: ScrapedPage[] = []
    let scrapedUrls: string[] = []

    if (input.agentConfig.follow_links && email.body?.content) {
      console.log('\n🔗 Step 2: Extracting links from email HTML...')
      
      const links = extractLinksFromHtml(email.body.content, {
        maxLinks: 5, // Limit to 5 links to avoid excessive scraping
      })

      console.log(`✅ Found ${links.length} links:`)
      links.forEach((link, idx) => {
        console.log(`  ${idx + 1}. ${link.text} → ${link.url.substring(0, 60)}...`)
      })

      // 3. Scrape links with Firecrawl (if any found)
      if (links.length > 0) {
        const urls = links.map((link) => link.url)
        
        console.log('\n🌐 Step 3: Scraping links with Firecrawl...')
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
        
        console.log(`✅ Successfully scraped ${scrapedPages.length}/${links.length} pages`)
        scrapedPages.forEach((page, idx) => {
          console.log(`  ${idx + 1}. ${page.title || 'No title'} (${page.markdown.length} chars)`)
        })
      }
    } else {
      console.log('\n⏭️  Step 2-3: Skipping link extraction (follow_links disabled or no body)')
    }

    // 4. Analyze with OpenAI using user-defined criteria
    console.log('\n🤖 Step 4: Analyzing with OpenAI...')
    console.log('Sending to GPT-4o-mini:', {
      emailLength: (email.body?.content || email.snippet || '').length,
      scrapedPages: scrapedPages.length,
      totalContent: (email.body?.content || email.snippet || '').length + 
                    scrapedPages.reduce((sum, p) => sum + p.markdown.length, 0)
    })
    
    const analysis = await analyzeEmailContent({
      emailHtml: email.body?.content || email.snippet || '',
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
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
    }
  } catch (error) {
    console.error('Email analysis failed:', error)
    
    return {
      success: false,
      emailId: input.emailId,
      matched: false,
      extractedData: {},
      scrapedUrls: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

