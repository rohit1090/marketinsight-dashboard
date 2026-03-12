// Competitor SERP analysis service.
// Fetches top Google results for a topic, scrapes competitor headings,
// and returns an aggregated list for AI-assisted SEO outline generation.

export interface CompetitorAnalysis {
  competitorHeadings: string[];
  competitorTitles: string[];
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data as T;
}

export async function analyzeCompetitors(topic: string): Promise<CompetitorAnalysis> {
  // Step 1: Fetch top 10 Google organic results for the topic
  const { results } = await post<{ results: { title: string; link: string; snippet: string }[] }>(
    '/api/research/serp-results',
    { topic },
  );

  if (!results?.length) return { competitorHeadings: [], competitorTitles: [] };

  // Step 2: Take top 5 URLs for heading extraction
  const urls = results.slice(0, 5).map((r) => r.link).filter(Boolean);
  const competitorTitles = results.slice(0, 5).map((r) => r.title).filter(Boolean);

  // Step 3: Scrape headings from each competitor page
  const { headings } = await post<{ headings: string[] }>(
    '/api/research/extract-headings',
    { urls },
  );

  return {
    competitorHeadings: headings || [],
    competitorTitles,
  };
}

export function formatCompetitorAnalysis(analysis: CompetitorAnalysis): string {
  if (!analysis.competitorHeadings.length && !analysis.competitorTitles.length) return '';

  const lines: string[] = [];

  if (analysis.competitorTitles.length) {
    lines.push('Top ranking article titles:');
    analysis.competitorTitles.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    lines.push('');
  }

  if (analysis.competitorHeadings.length) {
    lines.push('Headings found across top competitor articles:');
    analysis.competitorHeadings.forEach((h, i) => lines.push(`  ${i + 1}. ${h}`));
  }

  return `━━━ COMPETITOR SERP ANALYSIS — Top Google Results for This Topic ━━━
${lines.join('\n')}

INSTRUCTIONS FOR AI:
• Analyze the competitor headings and titles above.
• Build a BETTER SEO structure that covers all important topics competitors cover.
• Add sections that competitors are MISSING but would add value.
• Remove redundant or low-value sections.
• Maintain logical H2/H3 heading hierarchy.
• Your article should be more comprehensive and better organized than any competitor.`;
}
