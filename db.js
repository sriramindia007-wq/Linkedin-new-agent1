const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const SOURCES_FILE = path.join(DATA_DIR, "sources.json");
const PERSONA_FILE = path.join(DATA_DIR, "persona.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
  return str.trim().substring(0, 80).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function loadPosts() {
  const data = readCleanJson(POSTS_FILE);
  if (!Array.isArray(data)) return [];
  
  // Deduplicate on read
  const seen = new Set();
  const unique = [];
  for (const p of data) {
    const k = normalizeKey(p.post_text) || p.post_url;
    if (k && !seen.has(k)) {
      seen.add(k);
      unique.push(p);
    }
  }
  return unique;
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
}

function postExists(postUrl, authorName = "", postText = "") {
  const posts = loadPosts();
  const textKey = normalizeKey(postText);
  return posts.some(p => {
    if (postUrl && p.post_url && p.post_url === postUrl) return true;
    if (textKey && normalizeKey(p.post_text) === textKey) return true;
    return false;
  });
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
    if (errorMsg) p.error_message = errorMsg;
    savePosts(posts);
  }
  return p;
}

function getStats() {
  const posts = loadPosts();
  const sources = loadSources();
  return {
    pending: posts.filter(p => p.status === "PENDING").length,
    approved: posts.filter(p => p.status === "APPROVED").length,
    posted: posts.filter(p => p.status === "POSTED").length,
    rejected: posts.filter(p => p.status === "REJECTED").length,
    sources_count: sources.length,
    total: posts.length
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
  return readCleanJson(PERSONA_FILE) || {};
}

function savePersona(persona) {
  fs.writeFileSync(PERSONA_FILE, JSON.stringify(persona, null, 2), "utf-8");
}

module.exports = {
  loadPosts,
  savePosts,
  postExists,
  insertPost,
  updatePostComments,
  approveComment,
  markPostStatus,
  getStats,
  loadSources,
  saveSources,
  loadPersona,
  savePersona
};
