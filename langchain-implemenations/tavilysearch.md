



Websearch:

Tavily: 
-max results increase to 10
-two steps approach from documentation!!!!!
-search_depth should be advanced
-include_answer: yes with "advanced"
-include_raw_content true(for markdown) or text for text
-instead of include or exclude domains could that so maybe be just like in the iterations of next search queries? So i keep the generic use case? Maybe later in the UI and user configurations?

"• If you need deeper content (full article, structured extraction), follow up with extract, crawl, or map where appropriate. This avoids overloading search results while giving richer content only when needed."

"Research / summarization / RAG	search_depth = advanced, max_results = 10–20, enable include_raw_content, caching + follow-up extraction"

"Improvement? High-volume or batch queries	Cache results, rate-limit, batch queries, reuse previous outputs where possible"

"Extract gives you full clean text for any URL"


"
Extract

Use it when:

• You need more than just brief snippets (e.g. full articles, documentation pages, long-form content).

• Your agent needs entire page context, for summarization, quoting, data extraction, or deeper analysis.

• You want to avoid brittle HTML parsing yourself, Tavily handles cleaning and structuring.

This makes Extract ideal for use cases like report generation, long-form summarization, content ingestion pipelines, documentation crawlers, or research agents that need full context.

"


"
How Extract Provides Full Clean Text
When you call the Extract endpoint via the SDK or API, the response includes, for each requested URL:

• raw_content: the cleaned main text content of the page (no HTML noise).

• Optionally images, metadata (depending on parameters) if you request them.

• The URLs you passed, so you know the source.

This structured and cleaned output is purpose-built for LLMs and agent workflows, making downstream reasoning, summarization, or ingestion much simpler.
"

extract_depth="advanced"

_____

For debugging but do this in type:
from tavily import TavilyClient

client = TavilyClient(api_key="tvly-YOUR_API_KEY")

response = client.extract(
    urls=["https://en.wikipedia.org/wiki/Artificial_intelligence"],
    extract_depth="basic"  # or "advanced"
)

for res in response["results"]:
    print("URL:", res["url"])
    print("Content (start):", res["raw_content"][:300])

______

Best Practices When Using Extract
• Use a two-step process for reliability: first use Search to find relevant URLs, then use Extract only on top results, this reduces noise and avoids extracting irrelevant pages.

• For complex or dynamic web pages (with embedded media, structured data, tables), use extract_depth = "advanced" for better coverage.

• Avoid bulk extracting large numbers of URLs, respect the limit (≤ 20 URLs per request). If you need more, split into batches.

• Combine Extract with domain filters, recency filters, or other heuristics (from search) to prioritize high-quality, relevant sources before extraction.


_____

_____
"
When to Use Crawl vs Map vs Extract
• Use Crawl when you need full content extraction across many pages, for documentation ingestion, content mining, building knowledge bases, RAG pre-processing, or analyzing deeply nested sites.

• Use Map when you only need a sitemap or URL list without extracting full page content, good for structural analysis, link audits, or deciding what to extract later.

• Extract (from Unit 1) is best when you already have specific URLs and just need full content for those pages, for example, summarizing an article or fetching a known documentation page.

• In many workflows, Map → Extract is a powerful combo: Map the site to discover relevant URLs, then extract full content only from selected ones.
"
-maybe for carriere websites? 
-allow_external (bool)=true -	Whether links to external domains are allowed (if you want to stay within the same domain or permit external links). 