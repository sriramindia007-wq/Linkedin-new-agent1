const fs = require("fs");
const path = require("path");

function getResolvedPath(filename) {
  const candidates = [
    path.join(__dirname, filename),
    path.join(__dirname, "data", filename),
    path.join(__dirname, "..", "data", filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, filename);
}

const POSTS_FILE = getResolvedPath("posts.json");
const SOURCES_FILE = getResolvedPath("sources.json");
const PERSONA_FILE = getResolvedPath("persona.json");
const REJECTED_FILE = getResolvedPath("rejected_posts.json");
const PERSISTED_ACTIONS_FILE = getResolvedPath("persisted_actions.json");

function readCleanJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    let raw = fs.readFileSync(filePath, "utf-8");
    raw = raw.replace(/^\uFEFF/, "").trim(); // Strip BOM
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e.message);
    return null;
  }
}

function normalizeKey(str) {
  if (!str) return "";
  return str.trim().substring(0, 100).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function loadPersistedActions() {
  const data = readCleanJson(PERSISTED_ACTIONS_FILE);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      by_id: data.by_id || {},
      by_url: data.by_url || {},
      by_text_key: data.by_text_key || {}
    };
  }
  return { by_id: {}, by_url: {}, by_text_key: {} };
}

function savePersistedActions(actions) {
  try {
    fs.writeFileSync(PERSISTED_ACTIONS_FILE, JSON.stringify(actions, null, 2), "utf-8");
    const alt = path.join(__dirname, "data", "persisted_actions.json");
    if (fs.existsSync(path.dirname(alt))) {
      try { fs.writeFileSync(alt, JSON.stringify(actions, null, 2), "utf-8"); } catch (e) {}
    }
  } catch (e) {
    console.error("Error saving persisted actions:", e.message);
  }
}

function cleanUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch (e) {
    return rawUrl.split("?")[0].toLowerCase();
  }
}

function recordPersistedAction(post, updates = {}) {
  if (!post) return;
  const actions = loadPersistedActions();
  const id = post.id;
  const rawUrl = post.post_url || post.article_url || post.link || "";
  const cleanedUrl = cleanUrl(rawUrl);
  const textKey = normalizeKey(post.post_text || post.headline || post.title || "");

  const payload = {
    ...updates,
    headline: post.headline || post.title || undefined,
    author: post.author_name || post.publisher || undefined,
    updated_at: new Date().toISOString()
  };

  if (id) actions.by_id[id] = { ...(actions.by_id[id] || {}), ...payload };
  if (rawUrl) actions.by_url[rawUrl] = { ...(actions.by_url[rawUrl] || {}), ...payload };
  if (cleanedUrl && cleanedUrl !== rawUrl) actions.by_url[cleanedUrl] = { ...(actions.by_url[cleanedUrl] || {}), ...payload };
  if (textKey) actions.by_text_key[textKey] = { ...(actions.by_text_key[textKey] || {}), ...payload };

  savePersistedActions(actions);
  console.log(`🛡️ [State Guardian] Permanently locked action for "${post.author_name || post.headline || post.title || id}": ${JSON.stringify(updates)}`);
}

function loadRejectedSet() {
  const list = readCleanJson(REJECTED_FILE);
  if (!Array.isArray(list)) return new Set();
  return new Set(list);
}

function saveRejectedItem(urlOrKey) {
  if (!urlOrKey) return;
  const set = loadRejectedSet();
  set.add(urlOrKey);
  const cleaned = cleanUrl(urlOrKey);
  if (cleaned && cleaned !== urlOrKey) set.add(cleaned);

  const arr = Array.from(set);
  try {
    fs.writeFileSync(REJECTED_FILE, JSON.stringify(arr, null, 2), "utf-8");
    const alt = path.join(__dirname, "data", "rejected_posts.json");
    if (fs.existsSync(path.dirname(alt))) {
      try { fs.writeFileSync(alt, JSON.stringify(arr, null, 2), "utf-8"); } catch (e) {}
    }
  } catch (e) {}
}

function isPostBlacklisted(postUrl = "", postText = "") {
  const set = loadRejectedSet();
  const rawUrl = postUrl || "";
  const cleaned = cleanUrl(rawUrl);
  const textKey = normalizeKey(postText);

  if (rawUrl && set.has(rawUrl)) return true;
  if (cleaned && set.has(cleaned)) return true;
  if (textKey && set.has(textKey)) return true;

  // Check persisted actions for REJECTED or POSTED
  const actions = loadPersistedActions();
  if (rawUrl && (actions.by_url[rawUrl]?.status === "REJECTED" || actions.by_url[rawUrl]?.status === "POSTED")) return true;
  if (cleaned && (actions.by_url[cleaned]?.status === "REJECTED" || actions.by_url[cleaned]?.status === "POSTED")) return true;
  if (textKey && (actions.by_text_key[textKey]?.status === "REJECTED" || actions.by_text_key[textKey]?.status === "POSTED")) return true;

  return false;
}

function ensureContextualGrounding(p) {
  if (!p || !p.post_text) return;
  const currentComment = p.approved_comment || p.generated_comments?.value_add || "";
  
  const isBoilerplate = !currentComment || 
    currentComment.length < 30 ||
    currentComment.includes("robust corporate governance and fiduciary oversight are the foundational pillars") ||
    currentComment.includes("From an institutional credit perspective, sustainable growth for") ||
    currentComment.includes("A significant development for India's evolving financial") ||
    currentComment.includes("Regarding General Context:");

  if (isBoilerplate) {
    try {
      const { synthesizePostCommentary } = require("./deepContentSynthesisAgent");
      if (synthesizePostCommentary) {
        const commentary = synthesizePostCommentary(p.author_name, p.post_text, p.source_category, p.post_url);
        p.generated_comments = commentary;
        p.approved_comment = commentary.value_add;
      }
    } catch (e) {}
  }
}

function loadPosts() {
  const data = readCleanJson(POSTS_FILE);
  if (!Array.isArray(data)) return [];
  
  const actions = loadPersistedActions();
  const seen = new Set();
  const unique = [];

  for (const p of data) {
    const k = normalizeKey(p.post_text) || p.post_url || p.id;
    if (k && !seen.has(k)) {
      seen.add(k);

      // Apply immutable persisted actions
      const act = actions.by_id[p.id] || 
                  (p.post_url ? actions.by_url[p.post_url] : null) || 
                  (p.post_text ? actions.by_text_key[normalizeKey(p.post_text)] : null);

      if (act) {
        Object.assign(p, act);
      }

      // Permanent Zero-Boilerplate Guardian
      ensureContextualGrounding(p);

      unique.push(p);
    }
  }
  return unique;
}

function savePosts(posts) {
  if (Array.isArray(posts)) {
    posts.forEach(p => ensureContextualGrounding(p));
  }
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
  const altLocations = [
    path.join(__dirname, "data", "posts.json"),
    path.join(__dirname, "src_node", "data", "posts.json"),
    path.join(__dirname, "src_node", "posts.json")
  ];
  altLocations.forEach(loc => {
    try {
      if (fs.existsSync(path.dirname(loc))) fs.writeFileSync(loc, JSON.stringify(posts, null, 2), "utf-8");
    } catch (e) {}
  });
}

function postExists(postUrl, authorName = "", postText = "") {
  if (isPostBlacklisted(postUrl, postText)) return true;
  const posts = loadPosts();
  const textKey = normalizeKey(postText);
  return posts.some(p => {
    if (postUrl && p.post_url && p.post_url === postUrl) return true;
    if (textKey && normalizeKey(p.post_text) === textKey) return true;
    return false;
  });
}

function isOlderThan3Days(p) {
  if (!p) return true;
  // 1. Check relative published string (e.g., 4d, 5d, 6d, 1w, 2w, 1mo, 2mo)
  const rel = (p.published_relative || "").toLowerCase().trim();
  if (/([4-9]|\d{2,})\s*d/i.test(rel)) return true; // 4d, 5d, 6d, 7d and above
  if (/(\d+)\s*(w|wk|week|mo|month|yr|year)s?/i.test(rel)) return true; // weeks, months, years

  // 2. Check scraped_at timestamp (strictly <= 72 hours)
  if (p.scraped_at) {
    const ageMs = Date.now() - new Date(p.scraped_at).getTime();
    if (ageMs > (3 * 24 * 60 * 60 * 1000)) return true; // older than 72 hours
  }
  return false;
}

function pruneExpiredPendingPosts() {
  let posts = loadPosts();
  let changed = false;
  let prunedCount = 0;

  for (const p of posts) {
    if (p.status !== "POSTED" && p.status !== "REJECTED" && p.status !== "EXPIRED" && isOlderThan3Days(p)) {
      p.status = "EXPIRED";
      changed = true;
      prunedCount++;
    }
  }

  if (changed) {
    savePosts(posts);
    console.log(`🧹 [Freshness Guardian] Auto-pruned ${prunedCount} stale posts (>3 days old).`);
  }
  return prunedCount;
}

function isGovernancePost(p) {
  if (!p) return false;
  if (p.source_category === "Board Leadership & Governance" || p.source_category === "Corporate Governance & Board Oversight") return true;
  if (p.id && p.id.startsWith("gov_")) return true;
  
  const textToCheck = `${p.author_name || ''} ${p.author_headline || ''} ${p.source_name || ''} ${(p.relevance_tags || []).join(' ')}`.toLowerCase();
  if (/iica|iod|board\s*leadership|centre\s*of\s*excellence\s*for\s*board|independent\s*director|boardroom|board\s*stewardship|governance\s*and\s*risk\s*committee|damodaran|haribhakti/i.test(textToCheck)) {
    return true;
  }
  return false;
}

function isCompetitorPost(p) {
  if (!p) return false;
  if (p.source_category === "M2P LOS Competitors & Tech" || p.competitor_intel || p.status === "COMPETITOR_RADAR") return true;
  return false;
}

function getPostsPaged({ status = "PENDING", category = "ALL", page = 1, limit = 50 }) {
  let all = loadPosts();

  // Strict filtering for PENDING review: exclude POSTED, REJECTED, EXPIRED, COMPETITOR_RADAR, BOARD GOVERNANCE, and items > 3 days old
  if (status === "PENDING") {
    all = all.filter(p => 
      p.status === "PENDING" && 
      !isOlderThan3Days(p) &&
      !p.manual_post && 
      !isCompetitorPost(p) &&
      !isGovernancePost(p) &&
      !p.id.startsWith("news_") &&
      !isPostBlacklisted(p.post_url, p.post_text)
    );
  } else if (status && status !== "ALL") {
    all = all.filter(p => p.status === status);
  }

  if (category && category !== "ALL") {
    all = all.filter(p => p.source_category === category);
  }

  const total = all.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit, 10) || 50);
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (pageNum - 1) * pageSize;
  const slice = all.slice(offset, offset + pageSize);

  return {
    posts: slice,
    total,
    page: pageNum,
    limit: pageSize,
    totalPages,
    hasMore: pageNum < totalPages
  };
}

function insertPost(postData) {
  const posts = loadPosts();
  if (postExists(postData.post_url, postData.author_name, postData.post_text)) {
    return null;
  }

  const id = postData.id || ("post_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 6));
  const newPost = {
    id,
    source_id: postData.source_id || "",
    source_name: postData.source_name || "",
    source_category: postData.source_category || "Lending",
    author_name: postData.author_name || "LinkedIn Source",
    author_headline: postData.author_headline || "",
    post_url: postData.post_url || "",
    post_text: postData.post_text || "",
    published_relative: postData.published_relative || "1d",
    scraped_at: new Date().toISOString(),
    status: postData.status || "PENDING",
    priority_score: postData.priority_score || 85,
    impact_badge: postData.impact_badge || "⚡ High Impact",
    post_type_badge: postData.post_type_badge || "⚡ Digital Lending",
    badge_color: postData.badge_color || "primary",
    relevance_tags: postData.relevance_tags || ["Lending", "LOS"],
    generated_comments: postData.generated_comments || {},
    selected_style: null,
    approved_comment: null,
    posted_at: null,
    error_message: null
  };

  posts.unshift(newPost);
  savePosts(posts);
  return newPost;
}

function updatePostComments(postId, newComments) {
  const posts = loadPosts();
  const p = posts.find(item => item.id === postId);
  if (p) {
    p.generated_comments = newComments;
    recordPersistedAction(p, { generated_comments: newComments });
    savePosts(posts);
  }
  return p;
}

function approveComment(postId, style, commentText) {
  const posts = loadPosts();
  const p = posts.find(item => item.id === postId);
  if (p) {
    p.selected_style = style;
    p.approved_comment = commentText;
    p.status = "APPROVED";
    recordPersistedAction(p, { status: "APPROVED", selected_style: style, approved_comment: commentText });
    savePosts(posts);
  }
  return p;
}

function markPostStatus(postId, status, errorMsg = null) {
  const posts = loadPosts();
  const p = posts.find(item => item.id === postId);
  if (p) {
    p.status = status;
    if (status === "POSTED") p.posted_at = new Date().toISOString();
    if (status === "REJECTED") {
      if (p.post_url) saveRejectedItem(p.post_url);
      const k = normalizeKey(p.post_text);
      if (k) saveRejectedItem(k);
    }
    if (errorMsg) p.error_message = errorMsg;
    
    recordPersistedAction(p, {
      status,
      posted_at: p.posted_at || (status === "POSTED" ? new Date().toISOString() : undefined),
      error_message: errorMsg
    });
    savePosts(posts);
  }
  return p;
}

function markPostAsManuallyPosted(postId, commentText = "", manualTag = "Manually Posted on LinkedIn") {
  const posts = loadPosts();
  let p = posts.find(item => item.id === postId);
  if (!p) {
    p = {
      id: postId,
      author_name: "LinkedIn Post",
      status: "POSTED",
      manual_post: true,
      manual_tag: manualTag,
      posted_at: new Date().toISOString(),
      approved_comment: commentText
    };
    posts.unshift(p);
  } else {
    p.status = "POSTED";
    p.manual_post = true;
    p.manual_tag = manualTag;
    p.posted_at = new Date().toISOString();
    if (commentText) p.approved_comment = commentText;
  }

  recordPersistedAction(p, {
    status: "POSTED",
    manual_post: true,
    manual_tag: manualTag,
    posted_at: p.posted_at,
    approved_comment: p.approved_comment
  });
  savePosts(posts);
  return p;
}

function markPostAsCompetitor(postId, note = "Competitor Intel") {
  const posts = loadPosts();
  let p = posts.find(item => item.id === postId);
  if (!p) {
    p = {
      id: postId,
      author_name: "Competitor Source",
      status: "COMPETITOR_RADAR",
      source_category: "M2P LOS Competitors & Tech",
      competitor_intel: true,
      competitor_note: note
    };
    posts.unshift(p);
  } else {
    p.status = "COMPETITOR_RADAR";
    p.source_category = "M2P LOS Competitors & Tech";
    p.competitor_intel = true;
    p.competitor_note = note;
  }

  recordPersistedAction(p, {
    status: "COMPETITOR_RADAR",
    source_category: "M2P LOS Competitors & Tech",
    competitor_intel: true,
    competitor_note: note
  });
  savePosts(posts);
  return p;
}

function getStats() {
  const posts = loadPosts();
  const sources = loadSources();
  let pendingLending = 0;
  let pendingGov = 0;
  let competitorCount = 0;
  let postedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const p of posts) {
    if (p.status === "POSTED" || p.manual_post) {
      postedCount++;
    } else if (p.status === "REJECTED") {
      rejectedCount++;
    } else if (p.status === "APPROVED") {
      approvedCount++;
    } else if (p.status === "PENDING" && !isOlderThan3Days(p)) {
      if (isCompetitorPost(p)) {
        competitorCount++;
      } else if (isGovernancePost(p)) {
        pendingGov++;
      } else {
        pendingLending++;
      }
    }
  }

  let newsCount = 0;
  try {
    const marketNewsFile = path.join(__dirname, "data", "market_news.json");
    if (fs.existsSync(marketNewsFile)) {
      const rawNews = JSON.parse(fs.readFileSync(marketNewsFile, "utf-8"));
      newsCount = Array.isArray(rawNews) ? rawNews.filter(n => n.status !== "POSTED" && n.status !== "REJECTED").length : 0;
    }
  } catch (e) {}

  let scheduledCount = 0;
  try {
    const schedFile = path.join(__dirname, "data", "scheduled_posts.json");
    if (fs.existsSync(schedFile)) {
      const rawSched = JSON.parse(fs.readFileSync(schedFile, "utf-8"));
      scheduledCount = Array.isArray(rawSched) ? rawSched.filter(s => s.status === "SCHEDULED").length : 0;
    }
  } catch (e) {}

  return {
    pending: pendingLending,
    governance_count: pendingGov,
    competitors_count: competitorCount,
    approved: approvedCount,
    posted: postedCount,
    rejected: rejectedCount,
    sources_count: sources.length,
    news_count: newsCount,
    scheduled_count: scheduledCount,
    total: posts.length,
    last_scrape: posts.length > 0 ? posts[0].scraped_at : new Date().toISOString()
  };
}

function loadSources() {
  const data = readCleanJson(SOURCES_FILE);
  return Array.isArray(data) ? data : [];
}

function saveSources(sources) {
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2), "utf-8");
}

function loadPersona() {
  const data = readCleanJson(PERSONA_FILE);
  return data || {};
}

function savePersona(persona) {
  fs.writeFileSync(PERSONA_FILE, JSON.stringify(persona, null, 2), "utf-8");
}

module.exports = {
  loadPosts,
  savePosts,
  postExists,
  getPostsPaged,
  insertPost,
  updatePostComments,
  approveComment,
  markPostStatus,
  markPostAsManuallyPosted,
  markPostAsCompetitor,
  recordPersistedAction,
  getStats,
  loadSources,
  saveSources,
  loadPersona,
  savePersona,
  isPostBlacklisted,
  saveRejectedItem,
  loadRejectedSet,
  normalizeKey,
  cleanUrl,
  loadPersistedActions,
  isOlderThan3Days,
  isGovernancePost,
  isCompetitorPost,
  pruneExpiredPendingPosts
};
