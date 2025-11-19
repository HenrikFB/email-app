# Hybrid Search Test Guide

Use this checklist to validate semantic search end-to-end with the seeded data.

## Prerequisites
1. Seed data created (`npm run seed`)
2. Sign in as `test@test.dk`
3. Go to `Dashboard → Results`

## Test Matrix

| # | Scenario | Steps | Expectation |
|---|----------|-------|-------------|
| 1 | **Jobs – .NET Developer** | Select “Senior .NET Developer…” email → `Find Similar` → keep `Old Job Descriptions` checked → `Search` | Matches “Senior Backend Developer - Netcompany” with high similarity |
| 2 | **Jobs – Cover Letter** | Select the same email, but check the Email source, then `Search Selected Sources` → in modal select `Cover Letters Archive` | Matches cover letters mentioning .NET/TypeScript |
| 3 | **Jobs – Manual Query** | In modal, replace query with `healthcare .NET developer UiPath` → `Search` | Finds healthcare job descriptions |
| 4 | **Finance – Q4 Opportunities** | Select “Q4 Investment Opportunities…” email → `Find Similar` → ensure `Investment History` + `Financial Reports` checked | Matches “Tech Startup Investment - Q3 2024” + report summary |
| 5 | **Finance – Fintech Seed** | Select “Fintech Startup Investment Opportunity” email source (URL) → `Search Selected Sources` → search only `Investment History` | Matches fintech seed note |
| 6 | **Negative Test** | Select “Marketing Manager Position” email → `Find Similar` → search all KBs | No meaningful matches (low/no results) |
| 7 | **Threshold Sensitivity** | Scenario #1 → run at 10%, 30%, 70%, 90% | Lower threshold returns more results; high threshold may return none |
| 8 | **Bilingual Query** | Scenario #1 → query `softwareudvikler med .NET og Python` | Still matches English job docs (cross-lingual embeddings) |

## Tips
- **Source-specific search**: Expand “Extracted Data by Source”, check a URL, click `Search Selected Sources`.
- **Debugging**: See console logs + `debug-search-runs/<timestamp>` for query, KBs, results.
- **KB toggles**: Use checkboxes to include/exclude KBs per search.
- **Manual queries**: Start from auto-generated query, then tweak to test different phrasing.

## Sample Manual Queries
- `software developer .NET C# Python healthcare`
- `full stack developer TypeScript React Azure`
- `fintech equity investment €500K`
- `healthcare teknologi investering AI`

Record observations per scenario (similarity scores, matches, false positives). This guide doubles as regression checklist whenever search logic changes.

