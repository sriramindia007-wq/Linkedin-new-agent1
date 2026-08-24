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

function recordPersistedAction(post, updates = {}) {
  if (!post) return;
  const actions = loadPersistedActions();
  const id = post.id;
  const url = post.post_url;
  const textKey = normalizeKey(post.post_text);

  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (id) actions.by_id[id] = { ...(actions.by_id[id] || {}), ...payload };
  if (url) actions.by_url[url] = { ...(actions.by_url[url] || {}), ...payload };
  if (textKey) actions.by_text_key[textKey] = { ...(actions.by_text_key[textKey] || {}), ...payload };

  savePersistedActions(actions);
  console.log(`🛡️ [State Guardian] Permanently locked action for "${post.author_name || id}": ${JSON.stringify(updates)}`);
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
  try {
    fs.writeFileSync(REJECTED_FILE, JSON.stringify(Array.from(set), null, 2), "utf-8");
  } catch (e) {}
}

function isPostBlacklisted(postUrl = "", postText = "") {
  const set = loadRejectedSet();
  if (postUrl && set.has(postUrl)) return true;
  const textKey = normalizeKey(postText);
  if (textKey && set.has(textKey)) return true;

  // Check persisted actions for REJECTED
  const actions = loadPersistedActions();
  if (postUrl && actions.by_url[postUrl]?.status === "REJECTED") return true;
  if (textKey && actions.by_text_key[textKey]?.status === "REJECTED") return true;

  return false;
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

      unique.push(p);
    }
  }
  return unique;
}

function savePosts(posts) {
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

function getPostsPaged({ status = "PENDING", category = "ALL", page = 1, limit = 50 }) {
  let all = loadPosts();

  // Strict filtering for PENDING review: exclude POSTED, REJECTED, COMPETITOR_RADAR, and Blacklisted items
  if (status === "PENDING") {
    all = all.filter(p => p.status === "PENDING" && !p.manual_post && !p.competitor_intel && p.source_category !== "M2P LOS Competitors & Tech" && !isPostBlacklisted(p.post_url, p.post_text));
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
  const stats = {
    pending: 0,
    approved: 0,
    posted: 0,
    rejected: 0,
    sources_count: sources.length,
    total: posts.length,
    last_scrape: posts.length > 0 ? posts[0].scraped_at : new Date().toISOString()
  };
  for (const p of posts) {
    if (p.status === "PENDING" && !p.manual_post && !p.competitor_intel && p.source_category !== "M2P LOS Competitors & Tech") stats.pending++;
    else if (p.status === "APPROVED") stats.approved++;
    else if (p.status === "POSTED") stats.posted++;
    else if (p.status === "REJECTED") stats.rejected++;
  }
  return stats;
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
  isPostBlacklisted
};
