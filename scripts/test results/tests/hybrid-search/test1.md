Here are test scenarios using the seed data:

## Test scenarios

### 1. Jobs: .NET developer search
**Select**: "Senior .NET Developer Position - Region Midtjylland" email
- Click "Find Similar" (or select the scraped URL source)
- **Expected query**: Auto-generated from extracted data (technologies: .NET, C#, Python, SQL, UiPath)
- **Search in**: "Old Job Descriptions" KB
- **Expected results**: Should match "Senior Backend Developer - Netcompany" (similar tech stack)

**Manual query to try**:
```
.NET developer with Python and RPA experience in healthcare
```

henrikfogbunzel@MacBookPro email-app % npm run dev

> email-app@0.1.0 dev
> next dev

   ▲ Next.js 16.0.3 (Turbopack)
   - Local:         http://localhost:3000
   - Network:       http://192.168.8.111:3000
   - Environments: .env.local

 ✓ Starting...
 ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
 ✓ Ready in 663ms
 GET / 307 in 6.6s (compile: 1220ms, proxy.ts: 5.2s, render: 204ms)
 GET /dashboard 200 in 1185ms (compile: 408ms, proxy.ts: 108ms, render: 669ms)
 POST /dashboard 200 in 464ms (compile: 2ms, proxy.ts: 233ms, render: 229ms)
 GET /dashboard/emails 200 in 6.0s (compile: 735ms, proxy.ts: 5.2s, render: 25ms)
 GET /dashboard/emails 200 in 423ms (compile: 3ms, proxy.ts: 406ms, render: 15ms)
 GET /dashboard/emails 200 in 123ms (compile: 2ms, proxy.ts: 109ms, render: 12ms)
 POST /dashboard/emails 200 in 420ms (compile: 2ms, proxy.ts: 95ms, render: 322ms)
 GET /dashboard 200 in 2.4s (compile: 550µs, proxy.ts: 1910ms, render: 511ms)
 POST /dashboard/emails 200 in 714ms (compile: 5ms, proxy.ts: 356ms, render: 354ms)
 GET /dashboard 200 in 725ms (compile: 3ms, proxy.ts: 336ms, render: 387ms)
 POST /dashboard/emails 200 in 801ms (compile: 3ms, proxy.ts: 198ms, render: 600ms)
 POST /dashboard 200 in 523ms (compile: 3ms, proxy.ts: 164ms, render: 356ms)
 POST /dashboard 200 in 496ms (compile: 5ms, proxy.ts: 226ms, render: 265ms)
 POST /dashboard 200 in 370ms (compile: 1841µs, proxy.ts: 114ms, render: 254ms)
 GET /dashboard/emails 200 in 219ms (compile: 6ms, proxy.ts: 197ms, render: 17ms)
 POST /dashboard/emails 200 in 293ms (compile: 3ms, proxy.ts: 100ms, render: 189ms)
 POST /dashboard/emails 200 in 308ms (compile: 4ms, proxy.ts: 104ms, render: 200ms)
 POST /dashboard/emails 200 in 294ms (compile: 4ms, proxy.ts: 98ms, render: 192ms)
 POST /dashboard/emails 200 in 311ms (compile: 4ms, proxy.ts: 121ms, render: 186ms)
 GET /dashboard/results 200 in 619ms (compile: 513ms, proxy.ts: 90ms, render: 16ms)
 POST /dashboard/results 200 in 2.6s (compile: 5ms, proxy.ts: 1846ms, render: 737ms)
 POST /dashboard/results 200 in 362ms (compile: 4ms, proxy.ts: 97ms, render: 261ms)
 POST /dashboard/results 200 in 364ms (compile: 4ms, proxy.ts: 102ms, render: 258ms)
 POST /dashboard/results 200 in 468ms (compile: 3ms, proxy.ts: 165ms, render: 300ms)
 POST /dashboard/results 200 in 295ms (compile: 4ms, proxy.ts: 90ms, render: 202ms)

📁 Search debug folder created: debug-search-runs/1763551111752-bc19571b
📝 Logged query details: .NET developer with Python and RPA experience in h...

══════════════════════════════════════════════════════════════════════
🔍 SEMANTIC SEARCH INITIATED
══════════════════════════════════════════════════════════════════════
📝 Query: ".NET developer with Python and RPA experience in healthcare"
👤 User ID: acfb6765-3f43-41d0-8647-887379341f57
🎯 Threshold: 0.3 (30%)
📋 Limit: 10 results per source
🔎 Search KBs: Yes
📧 Search Emails: Yes
🗂️  KB IDs: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
══════════════════════════════════════════════════════════════════════


══════════════════════════════════════════════════════════════════════
🔍 KNOWLEDGE BASE SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: ".NET developer with Python and RPA experience in healthcare"
📊 Query length: 59 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
🗂️  KBs to search: 1 specific KB(s)
📚 KB Names: Old Job Descriptions
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: kb_chunks
   RPC Function: hybrid_search_knowledge_base
   Fields searched: content, embedding, document_id, chunk_index, char_count
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   KB filter: 1 KB ID(s)
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing hybrid search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 3 results found
   Similarity range: 33.7% - 52.3%
   Average similarity: 40.6%
══════════════════════════════════════════════════════════════════════

📝 Logged KB selection: 1 KB(s)
📝 Logged database queries: kb_chunks, analyzed_email_embeddings
📝 Logged embedding: 1536 dimensions
📝 Logged KB results: 3 matches

══════════════════════════════════════════════════════════════════════
📧 ANALYZED EMAIL SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: ".NET developer with Python and RPA experience in healthcare"
📊 Query length: 59 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: analyzed_email_embeddings
   RPC Function: search_analyzed_emails
   Fields searched: embedded_text, embedding, content_type, source_url, analyzed_email_id
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing email search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 7 emails found
   Similarity range: 31.0% - 57.1%
   Average similarity: 38.8%
══════════════════════════════════════════════════════════════════════

📝 Logged email results: 7 matches
📝 Logged KB selection: 1 KB(s)

✅ Search debug complete: debug-search-runs/1763551111752-bc19571b
📊 View summary: debug-search-runs/1763551111752-bc19571b/SUMMARY.md


══════════════════════════════════════════════════════════════════════
✅ SEARCH COMPLETE
══════════════════════════════════════════════════════════════════════
📊 KB Results: 3
📧 Email Results: 7
📁 Debug folder: debug-search-runs/1763551111752-bc19571b
══════════════════════════════════════════════════════════════════════

 POST /dashboard/results 200 in 7.7s (compile: 8ms, proxy.ts: 1955ms, render: 5.7s)






___________________________________________________
### 2. Jobs: Cover letter similarity
**Select**: "Full Stack Developer - Fintech Startup" email
- Select the email source (not the URL)
- **Search in**: "Cover Letters Archive" KB
- **Expected results**: Should match cover letters mentioning .NET, TypeScript, or fintech

**Manual query to try**:
```
full stack developer with .NET and TypeScript experience in fintech
```


NOTES: 
IT only find full stack developer with .NET. I need to query fintech directly before it choose that. 


henrikfogbunzel@MacBookPro email-app % npm run dev

> email-app@0.1.0 dev
> next dev

   ▲ Next.js 16.0.3 (Turbopack)
   - Local:         http://localhost:3000
   - Network:       http://192.168.8.111:3000
   - Environments: .env.local

 ✓ Starting...
 ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
 ✓ Ready in 693ms
 GET / 307 in 4.2s (compile: 1321ms, proxy.ts: 2.7s, render: 207ms)
 GET /dashboard 200 in 2.5s (compile: 420ms, proxy.ts: 99ms, render: 2.0s)
 POST /dashboard 200 in 1711ms (compile: 5ms, proxy.ts: 1498ms, render: 208ms)
 GET /dashboard/results 200 in 749ms (compile: 618ms, proxy.ts: 118ms, render: 13ms)
 POST /dashboard/results 200 in 463ms (compile: 6ms, proxy.ts: 205ms, render: 252ms)
 POST /dashboard/results 200 in 267ms (compile: 5ms, proxy.ts: 96ms, render: 166ms)

📁 Search debug folder created: debug-search-runs/1763551611793-4a047218
📝 Logged query details: full stack developer with .NET and TypeScript expe...

══════════════════════════════════════════════════════════════════════
🔍 SEMANTIC SEARCH INITIATED
══════════════════════════════════════════════════════════════════════
📝 Query: "full stack developer with .NET and TypeScript experience in fintech"
👤 User ID: acfb6765-3f43-41d0-8647-887379341f57
🎯 Threshold: 0.3 (30%)
📋 Limit: 10 results per source
🔎 Search KBs: Yes
📧 Search Emails: Yes
🗂️  KB IDs: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
══════════════════════════════════════════════════════════════════════


══════════════════════════════════════════════════════════════════════
🔍 KNOWLEDGE BASE SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: "full stack developer with .NET and TypeScript experience in fintech"
📊 Query length: 67 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
🗂️  KBs to search: 1 specific KB(s)
📚 KB Names: Cover Letters Archive
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: kb_chunks
   RPC Function: hybrid_search_knowledge_base
   Fields searched: content, embedding, document_id, chunk_index, char_count
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   KB filter: 1 KB ID(s)
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing hybrid search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 2 results found
   Similarity range: 36.0% - 51.4%
   Average similarity: 43.7%
══════════════════════════════════════════════════════════════════════

📝 Logged KB selection: 1 KB(s)
📝 Logged database queries: kb_chunks, analyzed_email_embeddings
📝 Logged embedding: 1536 dimensions
📝 Logged KB results: 2 matches

══════════════════════════════════════════════════════════════════════
📧 ANALYZED EMAIL SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: "full stack developer with .NET and TypeScript experience in fintech"
📊 Query length: 67 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: analyzed_email_embeddings
   RPC Function: search_analyzed_emails
   Fields searched: embedded_text, embedding, content_type, source_url, analyzed_email_id
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing email search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 10 emails found
   Similarity range: 34.3% - 67.7%
   Average similarity: 43.9%
══════════════════════════════════════════════════════════════════════

📝 Logged email results: 10 matches
📝 Logged KB selection: 1 KB(s)

✅ Search debug complete: debug-search-runs/1763551611793-4a047218
📊 View summary: debug-search-runs/1763551611793-4a047218/SUMMARY.md


══════════════════════════════════════════════════════════════════════
✅ SEARCH COMPLETE
══════════════════════════════════════════════════════════════════════
📊 KB Results: 2
📧 Email Results: 10
📁 Debug folder: debug-search-runs/1763551611793-4a047218
══════════════════════════════════════════════════════════════════════

 POST /dashboard/results 200 in 4.1s (compile: 8ms, proxy.ts: 180ms, render: 3.9s)





### 3. Finance: Investment opportunity search
**Select**: "Q4 Investment Opportunities - Tech Sector" email
- Click "Find Similar"
- **Search in**: "Investment History" + "Financial Reports" KBs
- **Expected results**: Should match "Tech Startup Investment - Q3 2024" and "Q4 2024 Tech Sector Analysis"

**Manual query to try**:
```
tech sector equity investment Series A €500K to €2M
```

henrikfogbunzel@MacBookPro email-app % npm run dev

> email-app@0.1.0 dev
> next dev

   ▲ Next.js 16.0.3 (Turbopack)
   - Local:         http://localhost:3000
   - Network:       http://192.168.8.111:3000
   - Environments: .env.local

 ✓ Starting...
 ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
 ✓ Ready in 709ms
 GET / 307 in 4.1s (compile: 1276ms, proxy.ts: 2.7s, render: 195ms)
 POST /dashboard 200 in 321ms (compile: 3ms, proxy.ts: 98ms, render: 220ms)
 GET /dashboard 200 in 2.7s (compile: 437ms, proxy.ts: 106ms, render: 2.2s)
 GET /dashboard/results 200 in 733ms (compile: 616ms, proxy.ts: 107ms, render: 10ms)
 POST /dashboard/results 200 in 882ms (compile: 6ms, proxy.ts: 231ms, render: 644ms)
 POST /dashboard/results 200 in 219ms (compile: 4ms, proxy.ts: 97ms, render: 118ms)
 POST /dashboard/results 200 in 2.4s (compile: 5ms, proxy.ts: 1759ms, render: 634ms)
 POST /dashboard/results 200 in 311ms (compile: 3ms, proxy.ts: 143ms, render: 165ms)

📁 Search debug folder created: debug-search-runs/1763552209545-68853186
📝 Logged query details: tech sector equity investment Series A €500K to €2...

══════════════════════════════════════════════════════════════════════
🔍 SEMANTIC SEARCH INITIATED
══════════════════════════════════════════════════════════════════════
📝 Query: "tech sector equity investment Series A €500K to €2M"
👤 User ID: acfb6765-3f43-41d0-8647-887379341f57
🎯 Threshold: 0.3 (30%)
📋 Limit: 10 results per source
🔎 Search KBs: Yes
📧 Search Emails: Yes
🗂️  KB IDs: cccccccc-cccc-cccc-cccc-cccccccccccc, dddddddd-dddd-dddd-dddd-dddddddddddd
══════════════════════════════════════════════════════════════════════


══════════════════════════════════════════════════════════════════════
🔍 KNOWLEDGE BASE SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: "tech sector equity investment Series A €500K to €2M"
📊 Query length: 51 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
🗂️  KBs to search: 2 specific KB(s)
📚 KB Names: Investment History, Financial Reports
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: kb_chunks
   RPC Function: hybrid_search_knowledge_base
   Fields searched: content, embedding, document_id, chunk_index, char_count
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   KB filter: 2 KB ID(s)
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing hybrid search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 3 results found
   Similarity range: 55.2% - 66.4%
   Average similarity: 62.3%
══════════════════════════════════════════════════════════════════════

📝 Logged KB selection: 2 KB(s)
📝 Logged database queries: kb_chunks, analyzed_email_embeddings
📝 Logged embedding: 1536 dimensions
📝 Logged KB results: 3 matches

══════════════════════════════════════════════════════════════════════
📧 ANALYZED EMAIL SEARCH
══════════════════════════════════════════════════════════════════════
📝 Query: "tech sector equity investment Series A €500K to €2M"
📊 Query length: 51 characters
🎯 Similarity threshold: 0.3 (30%)
📋 Result limit: 10
──────────────────────────────────────────────────────────────────────
🗄️  Database Query:
   Table: analyzed_email_embeddings
   RPC Function: search_analyzed_emails
   Fields searched: embedded_text, embedding, content_type, source_url, analyzed_email_id
   Filter: user_id = acfb6765-3f43-41d0-8647-887379341f57
   Similarity filter: > 0.3
──────────────────────────────────────────────────────────────────────
🧮 Generating query embedding...
   ✅ Embedding generated: 1536 dimensions
🔎 Executing email search RPC...
──────────────────────────────────────────────────────────────────────
✅ Search complete: 8 emails found
   Similarity range: 31.3% - 68.5%
   Average similarity: 48.9%
══════════════════════════════════════════════════════════════════════

📝 Logged email results: 8 matches
📝 Logged KB selection: 2 KB(s)

✅ Search debug complete: debug-search-runs/1763552209545-68853186
📊 View summary: debug-search-runs/1763552209545-68853186/SUMMARY.md


══════════════════════════════════════════════════════════════════════
✅ SEARCH COMPLETE
══════════════════════════════════════════════════════════════════════
📊 KB Results: 3
📧 Email Results: 8
📁 Debug folder: debug-search-runs/1763552209545-68853186
══════════════════════════════════════════════════════════════════════

 POST /dashboard/results 200 in 5.2s (compile: 8ms, proxy.ts: 207ms, render: 5.0s)

_____________



### 4. Finance: Fintech investment search
**Select**: "Fintech Startup Investment Opportunity" email
- Select the scraped URL source
- **Search in**: "Investment History" KB
- **Expected results**: Should match "Tech Startup Investment - Q3 2024" (fintech sector)

**Manual query to try**:
```
fintech startup seed investment €750K equity
```

### 5. Cross-domain: Technology search
**Select**: Any job email with .NET/C# technologies
- **Search in**: "Old Job Descriptions" + "Cover Letters Archive"
- **Query**: 
```
.NET C# Python SQL developer
```
- **Expected results**: Should find job descriptions and cover letters mentioning these technologies

### 6. Domain-specific: Healthcare search
**Select**: "Senior .NET Developer Position - Region Midtjylland"
- **Search in**: "Old Job Descriptions" KB
- **Query**:
```
healthcare domain .NET developer Aarhus
```
- **Expected results**: Should match "Senior Backend Developer - Netcompany" (healthcare domain)

### 7. Negative test: Non-matching search
**Select**: "Marketing Manager Position" (not matched email)
- **Search in**: All KBs
- **Query**: 
```
software development .NET Python
```
- **Expected results**: Should find job-related content, but NOT the marketing email itself (it's not a match)

### 8. Threshold testing
**Select**: "Senior .NET Developer Position"
- **Search in**: "Old Job Descriptions"
- **Test different thresholds**:
  - 10%: Should return many results (broader)
  - 30%: Should return relevant matches
  - 70%: Should return only very similar matches (stricter)
  - 90%: Might return no results (too strict)

## Tips for testing

1. Use source-specific search:
   - Expand "Extracted Data by Source"
   - Check the box next to a specific URL source
   - Click "Search Selected Sources"
   - This searches only that URL's extracted data

2. Compare auto-generated vs manual queries:
   - Let the system auto-generate the query first
   - Then edit it manually to see how results change
   - Try more specific or broader queries

3. Test bilingual search:
   - Try queries in Danish: "softwareudvikler med .NET og Python"
   - Should still find English content (embeddings are cross-lingual)

4. Test multiple KBs:
   - Select multiple KBs to search across
   - Compare results from different KBs
   - See which KBs have the most relevant matches

5. Check debug output:
   - Look at console logs to see what's being searched
   - Check `debug-search-runs/` folder for detailed search traces
   - Review similarity scores and which chunks matched

## Expected results summary

| Email Selected | KBs to Search | Expected Matches |
|---------------|---------------|------------------|
| Senior .NET Developer | Old Job Descriptions | Netcompany job (high similarity) |
| Full Stack Developer | Cover Letters Archive | Cover letters with .NET/TypeScript |
| Q4 Investment Opportunities | Investment History | Tech Startup Investment Q3 2024 |
| Fintech Startup Investment | Investment History | Tech Startup Investment (fintech) |
| Marketing Manager | Any KB | No matches (not a software dev role) |

Start with scenario #1 to verify the basic flow, then try the others.