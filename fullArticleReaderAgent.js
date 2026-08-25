const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Full Article Reader Agent
 * Resolves Google News / publisher redirects, extracts full article body text,
 * and extracts key metrics, quotes, and facts so commentary is 100% context-aware.
 */

function fetchHtmlWithRedirects(urlStr, maxRedirects = 4, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!urlStr || maxRedirects <= 0) return resolve('');

    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch (e) {
      return resolve('');
    }

    const client = parsedUrl.protocol === 'http:' ? http : https;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      rejectUnauthorized: false,
      timeout: timeoutMs
    }, (res) => {
      // Follow HTTP redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, urlStr).toString();
        }
        res.resume();
        return fetchHtmlWithRedirects(redirectUrl, maxRedirects - 1, timeoutMs).then(resolve);
      }

      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => resolve(rawData));
    });

    req.on('error', () => resolve(''));
    req.on('timeout', function() {
      this.destroy();
      resolve('');
    });
  });
}

/**
 * Extracts clean, readable journalistic text from HTML
 */
function extractArticleText(html) {
  if (!html || typeof html !== 'string') return '';

  // Remove scripts, styles, iframes, nav, header, footer, ads
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract all paragraphs (<p> tags)
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let match;

  while ((match = pRegex.exec(clean)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '') // remove inner HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // Only keep substantial journalistic sentences (ignore disclaimers, cookie notices, share prompts)
    if (text.length >= 40 && !/subscribe|cookie|copyright|all rights reserved|terms of use|follow us|advertisement/i.test(text)) {
      paragraphs.push(text);
    }
  }

  // Join up to the first 12 paragraphs (roughly 400-800 words of core journalism)
  return paragraphs.slice(0, 12).join('\n\n');
}

/**
 * Main Article Reader Function
 * Reads the full article from a URL and extracts full context
 */
async function readFullArticleContent(articleUrl, headline = '') {
  if (!articleUrl) return { fullText: '', summary: headline, keyFacts: [] };

  try {
    const html = await fetchHtmlWithRedirects(articleUrl);
    const fullText = extractArticleText(html);

    if (fullText && fullText.length >= 100) {
      // Extract key metrics / numbers from full text
      const metrics = fullText.match(/(?:₹|rs\.?|inr|usd|\$)\s*[\d,]+(?:\.\d+)?\s*(?:cr(?:ore)?|lakh|mn|bn|billion|million|percent|%)?/gi) || [];
      const keyFacts = Array.from(new Set(metrics)).slice(0, 5);

      // Create a 2-sentence rich summary of the full body
      const firstParagraphs = fullText.split('\n\n').slice(0, 2).join(' ');
      const summary = firstParagraphs.length > 250 ? firstParagraphs.substring(0, 247) + '...' : firstParagraphs;

      return {
        fullText,
        summary: summary || headline,
        keyFacts,
        wordCount: fullText.split(/\s+/).length
      };
    }
  } catch (e) {
    console.warn(`[Full Article Reader] Error fetching ${articleUrl}:`, e.message);
  }

  return {
    fullText: '',
    summary: headline,
    keyFacts: [],
    wordCount: 0
  };
}

module.exports = {
  readFullArticleContent,
  extractArticleText,
  fetchHtmlWithRedirects
};
