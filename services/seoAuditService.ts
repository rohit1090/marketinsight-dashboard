/**
 * seoAuditService.ts
 *
 * Performs a lightweight SEO audit using SerpAPI (Google Search engine).
 * Replaces the Gemini-based runSeoAudit — identical return shape so the
 * UI in SeoSuitePanel.tsx requires zero changes.
 *
 * Return shape: { analysis: string; sources: { uri: string; title: string }[] }
 *
 * Two parallel SerpAPI calls:
 *   1. site:domain.com   → indexed pages (crawlability signal)
 *   2. "domain.com"      → branded organic presence (brand authority signal)
 *
 * To upgrade later:
 *   - Replace estimateMetrics() with DataForSEO Domain Summary endpoint
 *   - Replace sources[] with real backlink API (Ahrefs / Majestic)
 *   - Add Core Web Vitals via PageSpeed Insights API (free, no key needed)
 */

const SERPAPI_BASE = '/api/serpapi/search.json';

interface SerpOrganic {
  position:        number;
  title:           string;
  link:            string;
  snippet?:        string;
  displayed_link?: string;
}

interface SerpResponse {
  organic_results?:    SerpOrganic[];
  search_information?: { total_results?: number };
  error?: string;
}

export interface AuditReport {
  analysis: string;
  sources:  { uri: string; title: string }[];
}

// --- Internal helpers ---

async function serpSearch(params: Record<string, string>): Promise<SerpResponse> {
  const key = import.meta.env.VITE_SERPAPI_KEY;
  const p = new URLSearchParams({ engine: 'google', api_key: key, num: '10', ...params });
  const res = await fetch(`${SERPAPI_BASE}?${p}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${res.statusText}`);
  const data = await res.json() as SerpResponse;
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
  return data;
}

/** Derive a simple domain health score (0–100) from available SERP signals */
function scoreHealth(indexedCount: number, brandedResults: number): number {
  const indexScore   = Math.min(indexedCount   / 100, 1) * 50; // up to 50pts
  const brandedScore = Math.min(brandedResults / 10,  1) * 50; // up to 50pts
  return Math.round(indexScore + brandedScore);
}

/** Formats a list of pages into readable bullet points */
function formatPages(results: SerpOrganic[], max = 5): string {
  return results.slice(0, max)
    .map((r, i) => `  ${i + 1}. ${r.title}\n     ${r.link}`)
    .join('\n');
}

// --- Public API ---

/**
 * Runs a two-call SerpAPI audit for the given domain.
 * Returns { analysis, sources } — same shape as geminiService.runSeoAudit().
 */
export async function runSeoAuditViaSerpAPI(domain: string): Promise<AuditReport> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Two parallel calls — fail gracefully if one fails
  const [siteResult, brandResult] = await Promise.allSettled([
    serpSearch({ q: `site:${cleanDomain}` }),
    serpSearch({ q: `"${cleanDomain}"` }),
  ]);

  const siteData   = siteResult.status   === 'fulfilled' ? siteResult.value   : null;
  const brandData  = brandResult.status  === 'fulfilled' ? brandResult.value  : null;

  const indexedPages    = siteData?.organic_results  ?? [];
  const brandedResults  = brandData?.organic_results ?? [];
  const indexedCount    = siteData?.search_information?.total_results ?? indexedPages.length;

  const healthScore  = scoreHealth(indexedCount, brandedResults.length);
  const healthLabel  = healthScore >= 70 ? '🟢 Good'
                     : healthScore >= 40 ? '🟡 Needs Improvement'
                     : '🔴 Poor';

  // Build the analysis string (rendered as whitespace-pre-wrap in the UI)
  const analysis = `
SEO Audit Report for: ${cleanDomain}
Generated: ${new Date().toLocaleString()}
Data source: Google Search via SerpAPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL HEALTH SCORE: ${healthScore}/100  ${healthLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 INDEX COVERAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pages indexed in Google: ~${indexedCount.toLocaleString()}

${indexedPages.length > 0
  ? `Top indexed pages:\n${formatPages(indexedPages)}`
  : '⚠️  No indexed pages found. Check robots.txt and sitemap.xml.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 BRANDED SEARCH PRESENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Results mentioning "${cleanDomain}" on Google: ${brandedResults.length}

${brandedResults.length > 0
  ? `Top branded mentions:\n${formatPages(brandedResults)}`
  : '⚠️  No branded mentions found. Consider link-building and PR outreach.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUICK RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${indexedCount < 10
  ? '• ⚠️  Low index count — submit sitemap to Google Search Console'
  : '• ✅ Good index coverage'}
${brandedResults.length < 3
  ? '• ⚠️  Weak branded presence — increase external mentions and backlinks'
  : '• ✅ Healthy branded visibility'}
${indexedPages.some(p => p.link.includes('/blog') || p.link.includes('/articles'))
  ? '• ✅ Content pages detected (blog/articles)'
  : '• 💡 Add a blog or resource section to improve topical authority'}
• 💡 Verify Core Web Vitals at pagespeed.web.dev
• 💡 Check mobile usability in Google Search Console
`.trim();

  // Sources = all unique URLs from both calls
  const allResults = [...indexedPages, ...brandedResults];
  const seen = new Set<string>();
  const sources = allResults
    .filter(r => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    })
    .slice(0, 10)
    .map(r => ({ uri: r.link, title: r.title }));

  return { analysis, sources };
}
