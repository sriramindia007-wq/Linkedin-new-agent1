require("dotenv").config();
const express = require("express");
const path = require("path");
const { 
  loadPosts, 
  approveComment, 
  markPostStatus, 
  getStats, 
  loadSources, 
  saveSources, 
  loadPersona, 
  savePersona 
} = require("./src_node/db");
const { runScraper } = require("./src_node/scraper");
const { postCommentToLinkedin } = require("./src_node/poster");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API: Get Stats
app.get("/api/stats", (req, res) => {
  res.json(getStats());
});

// API: Get Posts with optional filtering
app.get("/api/posts", (req, res) => {
  const { status, category, search } = req.query;
  let posts = loadPosts();

  if (status && status !== "ALL") {
    posts = posts.filter(p => p.status === status);
  }
  if (category && category !== "ALL") {
    posts = posts.filter(p => p.source_category === category);
  }
  if (search) {
    const s = search.toLowerCase();
    posts = posts.filter(p => 
      (p.post_text && p.post_text.toLowerCase().includes(s)) ||
      (p.author_name && p.author_name.toLowerCase().includes(s)) ||
      (p.source_name && p.source_name.toLowerCase().includes(s))
    );
  }

  res.json(posts);
});

// API: Approve Comment
app.post("/api/approve", (req, res) => {
  const { postId, selectedStyle, approvedText } = req.body;
  if (!postId || !approvedText) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const updated = approveComment(postId, selectedStyle, approvedText);
  res.json({ success: true, post: updated });
});

// API: Post Comment directly
app.post("/api/post-now", async (req, res) => {
  const { postId, postUrl, commentText, selectedStyle } = req.body;
  if (!postId || !commentText) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  approveComment(postId, selectedStyle || "custom", commentText);
  const result = await postCommentToLinkedin(postId, postUrl, commentText);
  res.json(result);
});

// API: Reject / Dismiss Post
app.post("/api/reject", (req, res) => {
  const { postId } = req.body;
  const updated = markPostStatus(postId, "REJECTED");
  res.json({ success: true, post: updated });
});

// API: Trigger Scraper
let isScraping = false;
app.post("/api/scrape", async (req, res) => {
  if (isScraping) {
    return res.status(409).json({ error: "Scraping already in progress." });
  }
  const { category, maxPosts } = req.body;
  isScraping = true;

  try {
    const sources = loadSources();
    let filterIds = null;
    if (category && category !== "ALL") {
      filterIds = sources.filter(s => s.category === category).map(s => s.id);
    }
    const count = await runScraper(filterIds, maxPosts || 2);
    isScraping = false;
    res.json({ success: true, newPosts: count });
  } catch (err) {
    isScraping = false;
    res.status(500).json({ error: err.message });
  }
});

// API: Sources
app.get("/api/sources", (req, res) => {
  res.json(loadSources());
});

app.post("/api/sources", (req, res) => {
  const newSource = req.body;
  const sources = loadSources();
  sources.push({ ...newSource, active: true });
  saveSources(sources);
  res.json({ success: true, sources });
});

// API: Persona
app.get("/api/persona", (req, res) => {
  res.json(loadPersona());
});

app.post("/api/persona", (req, res) => {
  savePersona(req.body);
  res.json({ success: true, persona: req.body });
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`💼 LinkedIn Lending Intelligence Agent`);
  console.log(`🌐 Dashboard running at: http://localhost:${PORT}`);
  console.log(`========================================================`);
});
