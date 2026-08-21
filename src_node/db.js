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

function loadPosts() {
  const data = readCleanJson(POSTS_FILE);
  return Array.isArray(data) ? data : [];
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
}

function postExists(postUrl) {
  const posts = loadPosts();
  return posts.some(p => p.post_url === postUrl);
}

function insertPost(postData) {
  const posts = loadPosts();
  if (posts.some(p => p.post_url === postData.post_url)) {
    return null;
  }
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
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
    status: "PENDING",
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

function approveComment(postId, selectedStyle, approvedText) {
  const posts = loadPosts();
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.status = "APPROVED";
    post.selected_style = selectedStyle;
    post.approved_comment = approvedText;
    savePosts(posts);
    return post;
  }
  return null;
}

function updatePostComments(postId, newComments) {
  const posts = loadPosts();
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.generated_comments = newComments;
    savePosts(posts);
    return post;
  }
  return null;
}

function markPostStatus(postId, status, errorMsg = null) {
  const posts = loadPosts();
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.status = status;
    if (status === "POSTED") {
      post.posted_at = new Date().toISOString();
    }
    if (errorMsg) {
      post.error_message = errorMsg;
    }
    savePosts(posts);
    return post;
  }
  return null;
}

function getStats() {
  const posts = loadPosts();
  const stats = { PENDING: 0, APPROVED: 0, POSTED: 0, REJECTED: 0, TOTAL: posts.length };
  posts.forEach(p => {
    if (stats[p.status] !== undefined) {
      stats[p.status]++;
    }
  });
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
  insertPost,
  approveComment,
  updatePostComments,
  markPostStatus,
  getStats,
  loadSources,
  saveSources,
  loadPersona,
  savePersona
};
