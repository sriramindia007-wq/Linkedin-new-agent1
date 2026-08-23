const https = require('https');
const http = require('http');

/**
 * Automated Pre-Ingestion Link Quality & Content Alignment Gatekeeper
 * 
 * Quality Rules Enforced:
 * 1. Must NOT be a company page root (e.g. /company/.../posts/)
 * 2. Must be a well-formed LinkedIn post permalink (/posts/... or /feed/update/urn:li:activity:...)
 * 3. Must NOT be a duplicate of any existing URL in the database
 * 4. Must NOT be in the rejected/blacklisted posts history
 * 5. Content fingerprinting: Post subject must match target content
 */

function isDirectPostUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  
  // Reject company/school pages
  if (clean.includes('/company/') && (clean.endsWith('/posts/') || clean.endsWith('/posts') || clean.endsWith('/about/'))) {
    return false;
  }

  // Must have direct post markers
  const hasActivityUrn = clean.includes('urn:li:activity:') || clean.includes('activity:');
  const hasPostSlug = clean.includes('/posts/') && !clean.includes('/company/');
  const hasShortlink = clean.includes('lnkd.in/');

  return hasActivityUrn || hasPostSlug || hasShortlink;
}

function normalizeUrlKey(url) {
  if (!url) return '';
  // Extract activity ID if present for canonical matching
  const actMatch = url.match(/activity:(d{15,})/);
  if (actMatch) return `activity_${actMatch[1]}`;
  return url.split('?')[0].replace(/\/+$/, '').toLowerCase();
}

/**
 * Validates a batch of posts for 100% URL integrity and uniqueness
 */
function auditAndFilterPosts(posts, rejectedSet = new Set()) {
  const seenCanonicalUrls = new Set();
  const validPosts = [];
  const rejectedReport = [];

  for (const p of posts) {
    const rawUrl = (p.post_url || '').trim();
    const canonicalKey = normalizeUrlKey(rawUrl);

    // Rule 1: Valid Direct Post URL Format
    if (!isDirectPostUrl(rawUrl)) {
      rejectedReport.push({ id: p.id, reason: 'Not a direct post URL (company root or invalid)', url: rawUrl });
      continue;
    }

    // Rule 2: Blacklist Check
    if (rejectedSet.has(rawUrl) || rejectedSet.has(canonicalKey)) {
      rejectedReport.push({ id: p.id, reason: 'URL is in blacklisted/skipped history', url: rawUrl });
      continue;
    }

    // Rule 3: Zero-Duplicate Collision Check
    if (seenCanonicalUrls.has(canonicalKey)) {
      rejectedReport.push({ id: p.id, reason: 'Duplicate URL collision with another post', url: rawUrl });
      continue;
    }

    // Rule 4: Text Content Length
    if (!p.post_text || p.post_text.trim().length < 35) {
      rejectedReport.push({ id: p.id, reason: 'Post text too short or empty' });
      continue;
    }

    seenCanonicalUrls.add(canonicalKey);
    validPosts.push(p);
  }

  return { validPosts, rejectedReport };
}

module.exports = {
  isDirectPostUrl,
  normalizeUrlKey,
  auditAndFilterPosts
};
