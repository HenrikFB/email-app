# 🔧 Link Prioritization Fix

## Problem Identified

From your debug data (`debug-analysis-runs/1763729898612-AQMkADAw`):

**What Should Have Been Selected:**
- ✅ Multiple "Se jobbet" links (your configured `button_text_pattern`)
- ✅ Job-specific links like "Løsningsarkitekt til IT-udvikling"
- ✅ "Junior Quantitative Analyst" links

**What Was Actually Selected:**
- ❌ "Se den online" (web version of email)
- ❌ `laegemiddelstyrelsen.dk` (Danish Medicines Agency homepage - completely irrelevant!)
- ❌ `regionsjaelland.dk` (Regional government homepage)

The AI was **completely ignoring** your `button_text_pattern: "Se jobbet"` configuration!

---

## What I Fixed

### 1. **Strongly Boosted Button Pattern Priority** 🎯

**Before:**
- Button pattern was mentioned as a "strong signal"
- AI treated it equally with other factors
- Lost in the complexity of the prompt

**After:**
- Button pattern matches are **separated into their own priority group**
- Shown FIRST in the link list with 🎯 emoji
- Huge visual section in prompt:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  CRITICAL: BUTTON PATTERN PRIORITY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  Links marked with 🎯 match this pattern and should be STRONGLY PREFERRED.
  Unless a 🎯 link is CLEARLY irrelevant, you should SELECT IT.
  ```

### 2. **Simplified & Cleaner Display**

**Before:** Long URLs with tracking parameters cluttering the view
```
1. URL: https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2F...
   Text: "Se jobbet"
   Type: Link ⭐ MATCHES BUTTON PATTERN
```

**After:** Clean, focused display
```
🎯 PRIORITY LINKS (button pattern matches):
1. 🎯 PRIORITY: "Se jobbet" → https://www.jobindex.dk/c?t=h1615512...
2. 🎯 PRIORITY: "Se jobbet" → https://www.jobindex.dk/c?t=h1615490...
```

### 3. **Better System Prompt**

**Before:** Long explanation about understanding user intent
**After:** Direct, action-oriented instruction:
> "You STRONGLY PRIORITIZE links marked with 🎯 (button pattern) as these are the user's configured primary content."

### 4. **Clearer Selection Rules**

Added a clear decision framework:
```
SELECTION RULES:
1. 🎯 STRONGLY PREFER button pattern matches
2. ✅ Links with content-specific words are relevant
3. ❌ SKIP: navigation, login, company homepages, about/terms
4. 💭 THINK: Would this page contain the KEY TERMS?
```

---

## About Your Questions

### Q: "Why gpt-4o-mini? It feels stupid?"

**A: Cost!** 💰

- **gpt-4o-mini**: $0.15 per 1M input tokens
- **gpt-4o**: $2.50 per 1M input tokens
- **That's 17x more expensive!**

**For your email analysis:**
- Mini cost: ~$0.02 per email
- gpt-4o cost: ~$0.30-0.40 per email

**If you process 100 emails/day:**
- Mini: $2/day = $60/month
- gpt-4o: $30-40/day = **$900-1200/month**

**BUT** - the problem wasn't the model being "stupid", it was the **prompt being confusing**! The AI couldn't understand what you wanted. With the new clear structure, mini should work great.

### Q: "What's the point of chunks? Why not analyze full email?"

**A: Your email was 267KB of HTML!** That's:
- **Expensive** to process as one giant block
- **Slow** to analyze
- AI gets "overwhelmed" and misses details in huge documents

**Chunking Benefits:**
- Focused analysis (AI looks at 2-3KB at a time instead of 267KB)
- Parallel processing (faster)
- Better accuracy (AI doesn't get lost in massive text)

**BUT** - you're right that the main problem was **selecting wrong URLs**, not chunking!

---

## Testing The Fix

The next time you analyze a Jobindex email, the AI should now:

1. ✅ **Prioritize ALL "Se jobbet" links** (your button pattern)
2. ✅ **Select job-specific links** (Løsningsarkitekt, Developer, etc.)
3. ❌ **Skip company homepages** (laegemiddelstyrelsen.dk, etc.)
4. ❌ **Skip navigation** (settings, about, privacy)

Your `max_links_to_scrape: 3` will then pick the **TOP 3** from the correctly prioritized list.

---

## Configuration Recommendations

For Jobindex emails with 26 jobs:

1. **Increase `max_links_to_scrape`** from 3 to at least 10-15
   - The email has 26 new jobs
   - You're only scraping 3 URLs
   - Most jobs are being ignored!

2. **Add `analysis_feedback`** if issues persist:
   ```
   "Never select company homepages like laegemiddelstyrelsen.dk or regionsjaelland.dk. 
   Only select links that lead to actual job descriptions with specific technologies 
   and requirements."
   ```

---

## Summary

**Root Cause:** The button pattern prompt was too weak and buried in complexity.

**Fix:** Made it crystal clear with visual separation, strong language, and priority grouping.

**Result:** AI should now strongly prefer "Se jobbet" links and avoid irrelevant company homepages.

**Generic:** No hardcoding - works for ANY button pattern you configure (not just "Se jobbet").

