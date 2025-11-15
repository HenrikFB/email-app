You're absolutely right - your idea is GOOD! The problem is the implementation needs refinement. Let me create a comprehensive research document for you to analyze elsewhere.

[3 tools called]

Perfect! Here's a comprehensive research document you can paste into any LLM:

---

# EMAIL ANALYSIS SYSTEM - RESEARCH DOCUMENT
**Problem**: Link extraction and URL following not working correctly for job listing emails

## 🎯 SYSTEM OVERVIEW

I'm building an email analysis system that:
1. Fetches emails via Microsoft Graph API (Outlook/Microsoft 365)
2. Extracts links from email HTML
3. Scrapes those links with Firecrawl API
4. Analyzes email + scraped content with OpenAI GPT-4o-mini
5. Extracts structured data based on user-defined criteria

**Current workflow:**
- Email arrives → Parse HTML → Extract first 10 links → Scrape 5 links → Analyze with AI → Extract structured data

## ❌ PROBLEMS ENCOUNTERED

### Problem 1: Wrong Links Being Extracted

**Test case**: Job listing email from JobIndex with 28 job postings
- Email length: 278,465 characters
- Contains 28 individual job listings with "Apply" buttons/links

**What was scraped (all WRONG):**
```
1. https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2F%3Fttid%3D...
   → JobIndex homepage (navigation link)
   
2. https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2Fc%3Ft%3Dc69...
   → Click tracking redirect (analytics link)
   
3. https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2Fc%3Ft%3Dm2247...
   → Another tracking link
   
4. https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2Fal%3Fl%3D...
   → Account settings page
   
5. http://keolis.dk/
   → Company homepage (footer link)
```

**What SHOULD have been scraped:**
- Actual job description URLs (likely contain `/job/` or `/jobs/` or `/virksomheder/`)
- Direct "Apply" or "See Job" button links
- Job-specific pages with titles, descriptions, requirements

### Problem 2: Truncation Losing Data

- Original email: 278,465 chars
- Truncated to: 80,000 chars (only **29%** of content!)
- **71% of job listings cut off** including most job URLs

### Problem 3: Microsoft Outlook SafeLinks Wrapper

All URLs are wrapped in Outlook SafeLinks:
```
Original: https://www.jobindex.dk/job/12345
Wrapped:  https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2Fjob%2F12345&data=...
```

**Question**: Does Firecrawl follow the SafeLinks redirect correctly? Or do we need to unwrap URLs first?

## 📊 CURRENT IMPLEMENTATION

### Link Extraction (`link-extractor.ts`)
```typescript
// Current logic:
1. Parse HTML with Cheerio
2. Find all <a href="..."> tags
3. Skip mailto: and # anchors
4. Optional filter by linkTextPattern or hrefPattern (currently NOT USED)
5. Extract first 10 unique links
6. Return as array
```

**Current call:**
```typescript
allLinks = extractLinksFromHtml(emailHtmlBody, {
  maxLinks: 10, // Just takes first 10 links!
})
```

### Scraping Strategy (`orchestrator.ts`)
```typescript
// Two-pass approach:
1. Extract first 10 links from email
2. Quick match check (AI decides if email is relevant)
3. If matched: Scrape first 5 of those 10 links
4. Analyze email + scraped content with GPT-4o-mini
5. Extract structured data
```

### Content Truncation (`analyzer.ts`)
```typescript
const MAX_EMAIL_LENGTH = 80000 // ~20k tokens
const MAX_SCRAPED_PAGE_LENGTH = 15000 // ~3.75k tokens per page

// Truncates content to fit within GPT-4o-mini's 128k token limit
```

## 🔍 RESEARCH QUESTIONS

### 1. Link Extraction Strategy

**Current approach**: Takes first 10 links in DOM order
**Problem**: First links are usually navigation/footer, not content links

**Possible solutions:**
- **A) Pattern-based filtering**: Use regex to identify job URLs
  - Example: `href.includes('/job/')` or `href.match(/\/virksomheder\/[\w-]+\/[\w-]+/)`
  - Question: What patterns identify job listing URLs vs navigation?

- **B) Link text analysis**: Filter by button text
  - Example: Links with text "Se jobbet", "View Job", "Ansøg", "Apply"
  - Current code supports this but it's NOT USED
  - Question: What link text patterns indicate job applications?

- **C) Semantic prioritization**: Use AI to rank link relevance BEFORE scraping
  - Send all link URLs + text to GPT-4o-mini: "Which 5 links are job descriptions?"
  - Cost: ~$0.001 per email (cheap!)
  - Question: Would this work better than pattern matching?

- **D) DOM position heuristics**: 
  - Skip links in `<header>`, `<footer>`, `<nav>` elements
  - Prioritize links within main content area
  - Question: How reliable is this for various email templates?

### 2. SafeLinks Handling

**The SafeLinks URL structure:**
```
https://emea01.safelinks.protection.outlook.com/?url=[URL_ENCODED_TARGET]&data=...&sdata=...
```

**Questions:**
- Does Firecrawl automatically follow the redirect? (Test needed)
- Should we decode the `url` parameter BEFORE sending to Firecrawl?
- Does the SafeLinks redirect preserve job listing URLs or does it go through tracking?

**URL decoding solution:**
```typescript
function unwrapSafeLinks(url: string): string {
  if (url.includes('safelinks.protection.outlook.com')) {
    const urlParams = new URLSearchParams(url.split('?')[1])
    return decodeURIComponent(urlParams.get('url') || url)
  }
  return url
}
```

### 3. JobIndex Specific Patterns

**From the logs, JobIndex URLs look like:**
- Homepage: `www.jobindex.dk/`
- Tracking: `www.jobindex.dk/c?t=...` (click tracking)
- Job agent: `www.jobindex.dk/al?...` (settings)
- **ACTUAL JOB**: `???` (we never scraped one!)

**Questions:**
- What does a real JobIndex job URL look like?
- Pattern: `/job/[id]`? `/virksomheder/[company]/[job-title]`?
- Do JobIndex emails have direct job URLs or do they all go through tracking redirects?

### 4. Alternative Architecture: Vector Database

**Current**: Extract links → Scrape → Analyze everything together

**Alternative**: Use Supabase vector embeddings
1. Store entire email in `pgvector` with embeddings
2. Store each scraped page separately with embeddings
3. Use hybrid search (keyword + semantic) to find relevant sections
4. Only send RELEVANT sections to GPT-4o-mini

**Questions:**
- Would this solve the truncation problem?
- How much more complex is the implementation?
- Supabase has hybrid search (RLS + pgvector) - is this worth exploring?
- Would retrieval add too much latency?

### 5. Content Chunking Strategy

**Instead of truncating linearly, could we:**
- Extract job sections using HTML structure (`<table>`, `<div class="job">`, etc.)
- Send each job to GPT separately: "Is this relevant? Extract data."
- Aggregate results across all jobs
- Question: How to identify job boundaries in HTML?

### 6. Scraping Strategy Trade-offs

**Option A: Pre-filter links before scraping**
- Extract ALL links from FULL email (before truncation)
- Filter to likely job URLs using patterns
- Scrape top 10-20 job URLs
- Pros: Gets real job data
- Cons: More Firecrawl credits, need good patterns

**Option B: Skip scraping, analyze email only**
- Job emails already contain: title, company, requirements, tech stack
- Skip Firecrawl entirely for long emails
- Pros: Fast, cheap, works with truncation
- Cons: Misses external content (but do we need it?)

**Option C: Smart hybrid**
- If email > 100k chars: skip scraping, extract from email
- If email < 100k chars: scrape top 5 links
- Pros: Best of both worlds
- Cons: More complex logic

## 📝 TEST DATA

**Email Structure (JobIndex):**
```
<html>
  <body>
    <header>
      <!-- Navigation links (we DON'T want these) -->
      <a href="https://www.jobindex.dk/">JobIndex Home</a>
      <a href="https://www.jobindex.dk/c?t=...">Tracking</a>
    </header>
    
    <main>
      <!-- Job Listing 1 -->
      <table class="job">
        <h2>Junior Power Platform Developer</h2>
        <p>Danish Crown</p>
        <a href="[JOB_URL_1]">Se jobbet</a>
      </table>
      
      <!-- Job Listing 2 -->
      <table class="job">
        <h2>Full Stack Developer</h2>
        <p>Company B</p>
        <a href="[JOB_URL_2]">Apply Now</a>
      </table>
      
      <!-- ... 26 more jobs ... -->
    </main>
    
    <footer>
      <!-- More navigation (we DON'T want these) -->
    </footer>
  </body>
</html>
```

## 🎯 SPECIFIC REQUESTS FOR ANALYSIS

Please analyze and provide recommendations on:

1. **Best strategy for extracting job listing URLs specifically**
   - Regex patterns for JobIndex URLs
   - DOM filtering strategies
   - Should we use AI for link prioritization?

2. **How to handle Outlook SafeLinks**
   - Should we unwrap before scraping?
   - Will Firecrawl follow redirects correctly?

3. **Truncation vs. alternatives**
   - Is vector database + hybrid search worth the complexity?
   - Should we chunk jobs and analyze separately?
   - Can we extract job URLs before truncation?

4. **General architecture improvements**
   - Is the two-pass strategy correct?
   - Should we skip scraping for job emails entirely?
   - How to make the system work for BOTH long job emails AND short newsletter emails?

5. **Implementation priorities**
   - Which fix gives the biggest improvement for least effort?
   - What's the minimum viable solution to make job emails work?

---

**Copy the above into Claude/ChatGPT/etc. for deep analysis!** 🚀