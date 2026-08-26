const fs = require("fs");
const path = require("path");

function getAllTargetFileLocations(filename) {
  const dirs = [
    __dirname,
    path.join(__dirname, "data"),
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "src_node"),
    path.join(__dirname, "src_node", "data"),
    path.join(__dirname, "..", "src_node", "data"),
    path.join(process.cwd(), "data"),
    process.cwd()
  ];
  const unique = [];
  const seen = new Set();
  for (const d of dirs) {
    const full = path.resolve(path.join(d, filename));
    if (!seen.has(full)) {
      seen.add(full);
      unique.push(full);
    }
  }
  return unique;
}

function writeSyncedJsonFile(filename, data) {
  const locations = getAllTargetFileLocations(filename);
  for (const loc of locations) {
    try {
      const dir = path.dirname(loc);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(loc, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {}
  }
}

function getResolvedPath(filename) {
  const candidates = [
    path.join(__dirname, "data", filename),
    path.join(__dirname, filename),
    path.join(__dirname, "..", "data", filename),
    path.join(process.cwd(), "data", filename),
    path.join(process.cwd(), filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, "data", filename);
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
  return str.trim().substring(0, 120).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch (e) {
    return rawUrl.split("?")[0].toLowerCase().replace(/\/+$/, "");
  }
}

function loadPersistedActions() {
  const locations = getAllTargetFileLocations("persisted_actions.json");
  for (const loc of locations) {
    const data = readCleanJson(loc);
    if (data && typeof data === "object" && !Array.isArray(data) && (data.by_id || data.by_url || data.by_text_key)) {
      return {
        by_id: data.by_id || {},
        by_url: data.by_url || {},
        by_text_key: data.by_text_key || {}
      };
    }
  }
  return { by_id: {}, by_url: {}, by_text_key: {} };
}

function savePersistedActions(actions) {
  writeSyncedJsonFile("persisted_actions.json", actions);
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
  if (cleanedUrl) actions.by_url[cleanedUrl] = { ...(actions.by_url[cleanedUrl] || {}), ...payload };
  if (textKey) actions.by_text_key[textKey] = { ...(actions.by_text_key[textKey] || {}), ...payload };

  savePersistedActions(actions);
  console.log(`🛡️ [State Guardian] Permanently locked action for "${post.author_name || post.headline || post.title || id}": ${JSON.stringify(updates)}`);
}

function loadRejectedSet() {
  const locations = getAllTargetFileLocations("rejected_posts.json");
  const set = new Set();
  for (const loc of locations) {
    const list = readCleanJson(loc);
    if (Array.isArray(list)) {
      list.forEach(item => set.add(item));
    }
  }
  return set;
}

function saveRejectedItem(urlOrKey) {
  if (!urlOrKey) return;
  const set = loadRejectedSet();
  set.add(urlOrKey);
  const cleaned = cleanUrl(urlOrKey);
  if (cleaned) set.add(cleaned);

  const arr = Array.from(set);
  writeSyncedJsonFile("rejected_posts.json", arr);
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
                  (p.post_url ? actions.by_url[cleanUrl(p.post_url)] : null) ||
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
  writeSyncedJsonFile("posts.json", posts);
}

function postExists(postUrl, authorName = "", postText = "") {
  if (isPostBlacklisted(postUrl, postText)) return true;
  
  const actions = loadPersistedActions();
  const rawUrl = postUrl || "";
  const cleaned = cleanUrl(rawUrl);
  const textKey = normalizeKey(postText);

  if (rawUrl && actions.by_url[rawUrl]) return true;
  if (cleaned && actions.by_url[cleaned]) return true;
  if (textKey && actions.by_text_key[textKey]) return true;

  const posts = loadPosts();
  return posts.some(p => {
    if (postUrl && p.post_url && (p.post_url === postUrl || cleanUrl(p.post_url) === cleaned)) return true;
    if (textKey && normalizeKey(p.post_text) === textKey) return true;
    return false;
  });
}

function isOlderThan3Days(post) {
  if (!post) return false;
  const postDate = new Date(post.scraped_at || post.published_at || post.published_relative || Date.now());
  const now = new Date();
  const diffDays = (now - postDate) / (1000 * 60 * 60 * 24);
  return diffDays > 3;
}

function isGovernancePost(p) {
  if (!p) return false;
  if (p.source_category === "Board Leadership & Governance" || (p.id && p.id.startsWith("gov_")) || p.governance_type) {
    return true;
  }
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
  if (postExists(postData.post_url, postData.author_name, postData.post_text)) {
    return null;
  }
  const posts = loadPosts();

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
  let p = posts.find(item => item.id === postId);
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
  } else {
    // If not found in memory, still record the rejection
    if (status === "REJECTED") {
      saveRejectedItem(postId);
      recordPersistedAction({ id: postId }, { status: "REJECTED" });
    }
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
  if (p) {
    p.source_category = "M2P LOS Competitors & Tech";
    p.status = "COMPETITOR_RADAR";
    p.competitor_intel = true;
    p.competitor_note = note;
    recordPersistedAction(p, {
      status: "COMPETITOR_RADAR",
      source_category: "M2P LOS Competitors & Tech",
      competitor_intel: true,
      competitor_note: note
    });
    savePosts(posts);
  }
  return p;
}

function loadSources() {
  const locations = getAllTargetFileLocations("sources.json");
  for (const loc of locations) {
    const data = readCleanJson(loc);
    if (Array.isArray(data) && data.length > 0) return data;
  }
  return [];
}

function saveSources(sources) {
  writeSyncedJsonFile("sources.json", sources);
}

function loadPersona() {
  const locations = getAllTargetFileLocations("persona.json");
  for (const loc of locations) {
    const data = readCleanJson(loc);
    if (data && data.user_name) return data;
  }
  return {};
}

function savePersona(persona) {
  writeSyncedJsonFile("persona.json", persona);
}

function getStats() {
  const posts = loadPosts();
  const pending = posts.filter(p => p.status === "PENDING" && !isOlderThan3Days(p) && !p.manual_post && !isCompetitorPost(p) && !isGovernancePost(p) && !p.id.startsWith("news_"));
  const approved = posts.filter(p => p.status === "APPROVED");
  const posted = posts.filter(p => p.status === "POSTED");
  const rejected = posts.filter(p => p.status === "REJECTED");
  const competitor = posts.filter(p => isCompetitorPost(p) && p.status !== "POSTED" && p.status !== "REJECTED");
  const governance = posts.filter(p => isGovernancePost(p) && p.status !== "POSTED" && p.status !== "REJECTED" && !isOlderThan3Days(p));

  return {
    total: posts.length,
    pending: pending.length,
    approved: approved.length,
    posted: posted.length,
    rejected: rejected.length,
    competitors: competitor.length,
    governance: governance.length
  };
}

module.exports = {
  loadPosts,
  savePosts,
  postExists,
  insertPost,
  updatePostComments,
  approveComment,
  markPostStatus,
  markPostAsManuallyPosted,
  markPostAsCompetitor,
  loadSources,
  saveSources,
  loadPersona,
  savePersona,
  getStats,
  getPostsPaged,
  isOlderThan3Days,
  isGovernancePost,
  isCompetitorPost,
  isPostBlacklisted,
  saveRejectedItem,
  recordPersistedAction,
  loadPersistedActions,
  cleanUrl,
  normalizeKey,
  writeSyncedJsonFile,
  getAllTargetFileLocations
};
