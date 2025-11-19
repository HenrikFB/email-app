____##Key Findings____1)Wrong Extraction Order - You're truncating the email FIRST, then extracting links. This loses 71% of your job listings before you even try to extract their URLs.2)No Link Filtering - Taking the first 10 links gets navigation/footer links, not content links.3) We dont get into the real url and webpage because of wrapper and firecrawl extract.  We need to do firecrawl scrape and not extract. Scrape should be able to first scrape after redirect. I can get the correct in all the below cases on firecrawl platform. IMPORTANT IS I need sometimes do it multiple times because of bad regrets errors. So there need be retry policy.  Use /scrape Endpoint (NOT /extract) waitFor: 3000.Example:
Outlook link buttons also has safelinks:https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.jobindex.dk%2Fc%3Ft%3Dh1614112%26uid%3DZqsyNZSg%26abtestid%3D7955004834--121377597c1bebccb5df1c8ede4366438bc5197d%26ttid%3Dj3902520%26source%3Demail%26utm_source%3Djobindex%26utm_medium%3Demail%26utm_campaign%3Djobmail&data=05%7C02%7C%7C62571ff302f6410be67e08de24482e89%7C84df9e7fe9f640afb435aaaaaaaaaaaa%7C1%7C0%7C638988089597643749%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=jwLcax%2F3B5qe0BIS4%2Fn3P381xA9mAVboPt37AIQxfyw%3D&reserved=0Gmail only has jobindex and then it will redirect:https://www.jobindex.dk/c?t=h1614112&uid=ZqsyNZSg&abtestid=7955004834--121377597c1bebccb5df1c8ede4366438bc5197d&ttid=j3902520&source=email&utm_source=jobindex&utm_medium=email&utm_campaign=jobmail real job descriptions:https://midtjob.dk/ad/frontend-udvikler-med-ivaerksaettermindset/bb17py/da _______##Research questions? _____1) why so many tokens?why is the email so long?  Is it because it is html? And body text is better or what?Maybe the body text and not html could go to openai chat completions? Or can we do something where we extract <p> and <h1-5>?  Or enhanced link extraction with DOM context? Header, nav, footer, main? So we skip everything else? But is this generic?Is it possible actually to get the snippets like above and below the buttons? 


2)Could we recursive works through it or chunk the emails?Extra chat completions steps? Analyse or extraction pipeline?Something like: async function determineScrapingStrategy(email: Email): Promise<‘small email | ' big email and many links ‘ |  ‘big email and few links’ |  small emails and many links’.
Cheerio Best Practices
* Use $('a[href]') to select all links
* Use .attr('href') to get link URLs
* Use .text() to get link text
* Use .parents() or .closest() for context detection




3) Option AI-Based Link Prioritization
Concept: Send all link URLs + text to GPT-4o-mini before scraping
const prompt = `Given these links from a l, rank all that are most likely to be actual urls the user request {Agent configurations variables}  (not navigation):
${links.map(l => `- ${l.href} (text: "${l.text}")`).join('\n')}`;


4) Option C: Email Chunking by Job Sections
Concept: Parse HTML structure to identify boundaries, analyze separately
5) Add learning from user feedback?6) Could we in examples with buttons also make an agent configuration where the user directly write the name of the button text? Etc “Se Jobbet” (view the job in English)? It is just so it is generic.  My job agents is like similar text on the buttons. In news letters or other emails there can just be a link in middle of the text. But sometimes the buttons is similiar. ______##Future_______If the above doesnt works supabase hybrid search with sermantich and full text is probably best right? 