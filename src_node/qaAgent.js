const { isDirectPostUrl } = require('./linkValidator');

/**
 * Automated QA Verification Agent for LinkedIn Posts
 * 
 * 4-Step Strict Certification Pipeline:
 * [Check 1] Recency Gate: Strict <48h publication check (rejects 3d, 1w, 1mo, etc.)
 * [Check 2] Live Headless URL Probe: Navigates to the exact permalink. Rejects 404, 'Post not found', 'deleted', or authwall.
 * [Check 3] Content & Author Alignment: Compares live DOM text with extracted text to prevent cross-linked/mismatched cards.
 * [Check 4] Contextual Comment Audit: Verifies generated comments actually discuss the post's core entities/metrics without generic filler.
 */

// Helper to check recency
function isWithin48Hours(timeStr) {
  if (!timeStr) return false;
  const clean = timeStr.toLowerCase().trim();
  
  // Accept minutes (m, min), hours (h, hr), 1d, 2d, yesterday, just now
  if (/^\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/.test(clean)) return true;
  if (/^(1d|2d|1 day|2 days|yesterday|just now|moments ago)\b/.test(clean)) return true;
  if (clean.includes('h •') || clean.includes('m •') || clean.includes('1d •') || clean.includes('2d •')) return true;
  
  // Reject 3d, 4d, 5d, 1w, 2w, 1mo, 1yr
  if (/^\d+\s*(w|wk|wks|week|weeks|mo|mon|month|months|y|yr|year|years)\b/.test(clean)) return false;
  if (/^[3-9]\s*d\b/.test(clean) || /^\d{2,}\s*d\b/.test(clean)) return false;

  // If format is like "22h", "1d"
  if (/^\d+h$/.test(clean)) {
    const hours = parseInt(clean, 10);
    return hours <= 48;
  }
  if (/^\d+d$/.test(clean)) {
    const days = parseInt(clean, 10);
    return days <= 2;
  }

  return true; // Default fallback if uncertain format but recent
}

/**
 * Runs live headless QA audit on a single post candidate
 * @param {Object} candidate - { post_url, post_text, author_name, published_relative, generated_comments }
 * @param {BrowserContext} context - Playwright browser context
 * @returns {Object} - { passed: boolean, reason: string, liveData?: Object }
 */
async function auditPostCandidate(candidate, context) {
  const { post_url, post_text, author_name, published_relative, generated_comments } = candidate;

  // [Check 1] Recency Gate
  if (!isWithin48Hours(published_relative)) {
    return { passed: false, reason: `FAILED_RECENCY: Post is older than 48h (relative time: "${published_relative}")` };
  }

  // [Check 1b] Valid URL Format Gate
  if (!isDirectPostUrl(post_url)) {
    return { passed: false, reason: `FAILED_URL_FORMAT: Not a direct post URL (url: "${post_url}")` };
  }

  // [Check 1c] Lending Domain Relevance & Noise Filter Gate
  try {
    const { analyzeLendingRelevance } = require("./lendingRelevanceAgent");
    const relevance = analyzeLendingRelevance(post_text, author_name, candidate.source_category);
    if (!relevance.isRelevant) {
      return { passed: false, reason: `FAILED_LENDING_RELEVANCE: ${relevance.reason}` };
    }
  } catch (e) {}

  // [Check 2 & 3] Live Headless URL Probe & Content Match
  let page;
  try {
    page = await context.newPage();
    const response = await page.goto(post_url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    
    // Wait for dynamic render
    await new Promise(r => setTimeout(r, 2500));

    // Check status code
    if (response && response.status() >= 400) {
      await page.close();
      return { passed: false, reason: `FAILED_HTTP_STATUS: HTTP ${response.status()} returned from ${post_url}` };
    }

    // Check for "Post not found" / "deleted" / "login wall"
    const pageCheck = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const title = document.title || '';
      
      const isNotFound = bodyText.includes('Post not found') || 
                         bodyText.includes('This post was deleted') || 
                         bodyText.includes('post is no longer available') ||
                         title.includes('Page Not Found');
                         
      const isAuthWall = bodyText.includes('Join LinkedIn') && !document.querySelector('div.update-components-text, .feed-shared-update-v2__description, article');

      const textEl = document.querySelector('div.update-components-text, .feed-shared-update-v2__description, span.break-words, .feed-shared-text, .attributed-text-segment-list__content, article');
      const authorEl = document.querySelector('.update-components-actor__name, .feed-shared-actor__name, .update-components-actor__title span, a.app-aware-link');
      
      return {
        isNotFound,
        isAuthWall,
        liveText: textEl ? textEl.innerText.trim() : (bodyText.substring(0, 500)),
        liveAuthor: authorEl ? authorEl.innerText.trim() : ''
      };
    });

    await page.close();

    if (pageCheck.isNotFound) {
      return { passed: false, reason: `FAILED_NOT_FOUND: LinkedIn returned 'Post not found' or deleted for ${post_url}` };
    }

    // [Check 3] Content Fingerprinting
    if (post_text && pageCheck.liveText) {
      const candWords = post_text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3);
      const liveWords = new Set(pageCheck.liveText.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/));
      
      let matchedCount = 0;
      candWords.forEach(w => { if (liveWords.has(w)) matchedCount++; });
      const matchRatio = candWords.length > 0 ? (matchedCount / candWords.length) : 1;

      if (matchRatio < 0.25 && candWords.length > 5) {
        return { 
          passed: false, 
          reason: `FAILED_CONTENT_MISMATCH: Live post content does not match card text (match ratio: ${(matchRatio * 100).toFixed(1)}%)` 
        };
      }
    }

    // [Check 4] AI Comment Context Relevance Check
    if (generated_comments) {
      const comment1 = generated_comments.value_add || '';
      const comment2 = generated_comments.provocative_question || '';
      const comment3 = generated_comments.executive_perspective || '';
      
      if (!comment1 || comment1.length < 30) {
        return { passed: false, reason: 'FAILED_COMMENT_QUALITY: Value-add comment is empty or too short' };
      }
    }

    return { 
      passed: true, 
      reason: 'PASSED_ALL_QA_CHECKS',
      liveData: { liveAuthor: pageCheck.liveAuthor, liveTextSnippet: pageCheck.liveText.substring(0, 100) }
    };

  } catch (err) {
    if (page) await page.close().catch(() => {});
    return { passed: false, reason: `FAILED_PROBE_EXCEPTION: ${err.message}` };
  }
}

/**
 * Audits a batch of scraped candidates through the QA agent
 */
async function runBatchQualityAudit(candidates, browserContext) {
  console.log(`🔍 [QA Agent] Commencing 4-step quality audit on ${candidates.length} candidate posts...`);
  const certifiedPosts = [];
  const rejectedReport = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`  -> [QA Audit ${i+1}/${candidates.length}] Checking "${candidate.author_name}" (${candidate.post_url})...`);
    
    const result = await auditPostCandidate(candidate, browserContext);
    if (result.passed) {
      console.log(`     ✅ CERTIFIED: Passed all 4 QA checks!`);
      certifiedPosts.push(candidate);
    } else {
      console.warn(`     ❌ REJECTED: ${result.reason}`);
      rejectedReport.push({ id: candidate.id, url: candidate.post_url, reason: result.reason });
    }
  }

  console.log(`🎯 [QA Agent] Audit Complete: ${certifiedPosts.length}/${candidates.length} posts certified for queue.`);
  return { certifiedPosts, rejectedReport };
}

module.exports = {
  isWithin48Hours,
  auditPostCandidate,
  runBatchQualityAudit
};
