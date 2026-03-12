// /api/research/extract-headings.js
// Scrapes H1/H2/H3 headings from competitor URLs using axios + cheerio.
// Accepts up to 5 URLs to stay within Vercel's 10s function timeout.

import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid urls array' });
  }

  // Limit to top 5 to avoid timeout
  const targets = urls.slice(0, 5);

  const fetchHeadings = async (url) => {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
          'Accept': 'text/html',
        },
        maxRedirects: 3,
      });

      const $ = cheerio.load(response.data);
      const headings = [];

      $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 2 && text.length < 200) {
          headings.push(text);
        }
      });

      return headings;
    } catch {
      return []; // silently skip URLs that fail (blocked, timeout, etc.)
    }
  };

  // Scrape all URLs in parallel
  const results = await Promise.allSettled(targets.map(fetchHeadings));

  // Flatten, deduplicate, and filter empty strings
  const seen = new Set();
  const headings = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const h of result.value) {
        const normalized = h.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          headings.push(h);
        }
      }
    }
  }

  return res.status(200).json({ headings });
}
