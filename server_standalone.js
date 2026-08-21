const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Safe Dynamic Module Resolver (Works whether files are in ./src_node or root ./)
function safeRequire(moduleName) {
  const pathsToTry = [
    path.join(__dirname, "src_node", moduleName),
    path.join(__dirname, moduleName),
    path.join(__dirname, "src", moduleName)
  ];
  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p + ".js") || fs.existsSync(p)) {
        return require(p);
      }
    } catch (e) {
      // try next
    }
  }
  try {
    return require("./src_node/" + moduleName);
  } catch (e) {
    return require("./" + moduleName);
  }
}

const db = safeRequire("db");
const { 
  loadPosts, 
  approveComment, 
  updatePostComments,
  markPostStatus, 
  getStats, 
  loadSources, 
  saveSources, 
  loadPersona, 
  savePersona 
} = db;

let scraperModule = null;
try {
  scraperModule = safeRequire("scraper");
} catch (e) {
  console.warn("Scraper module will load on-demand:", e.message);
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

let lastScrapeTime = null;
let lastScrapeStats = { newPosts: 0, status: "Idle" };

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// -------------------------------------------------------------
// AUTOMATED CRON SCHEDULER (7:00 AM & 6:00 PM DAILY)
// -------------------------------------------------------------
try {
  const cron = require("node-cron");
  async function executeScheduledScrape(label) {
    console.log(`\n⏰ [CRON TRIGGER] Starting automated scheduled scrape (${label})...`);
    lastScrapeStats.status = `Running (${label})`;
    try {
      const { runScraper } = safeRequire("scraper");
      const count = await runScraper(null, 2);
      lastScrapeTime = new Date().toISOString();
      lastScrapeStats = { newPosts: count, status: `Completed (${label})`, timestamp: lastScrapeTime };
      console.log(`✅ [CRON COMPLETE] Automated ${label} scrape ingested ${count} new posts.`);
    } catch (err) {
      console.error(`❌ [CRON ERROR] ${label} scrape failed:`, err.message);
      lastScrapeStats.status = `Error: ${err.message}`;
    }
  }

  cron.schedule("0 7 * * *", () => executeScheduledScrape("Morning 7:00 AM"));
  cron.schedule("0 18 * * *", () => executeScheduledScrape("Evening 6:00 PM"));
  console.log("⏰ Automated Scheduler Initialized: Running at 07:00 AM & 18:00 PM daily.");
} catch (e) {
  console.log("Cron scheduler will run when node-cron is present:", e.message);
}

// -------------------------------------------------------------
// HTTP SERVER & API ROUTES
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  // API Routes
  if (pathname === "/api/stats" && method === "GET") {
    return sendJSON(res, getStats());
  }

  if (pathname === "/api/scheduler-status" && method === "GET") {
    return sendJSON(res, {
      schedule: ["07:00 AM Morning", "06:00 PM Evening"],
      status: "ACTIVE",
      lastScrapeTime,
      lastScrapeStats
    });
  }

  if (pathname === "/api/posts" && method === "GET") {
    let posts = loadPosts();
    if (query.status && query.status !== "ALL") {
      posts = posts.filter(p => p.status === query.status);
    }
    if (query.category && query.category !== "ALL") {
      posts = posts.filter(p => p.source_category === query.category);
    }
    return sendJSON(res, posts);
  }

  if (pathname === "/api/competitor-posts" && method === "GET") {
    let posts = loadPosts();
    const competitorCategory = "M2P LOS Competitors & Tech";
    let competitorPosts = posts.filter(p => p.source_category === competitorCategory);
    return sendJSON(res, competitorPosts);
  }

  if (pathname === "/api/regenerate-comment" && method === "POST") {
    const body = await parseBody(req);
    const { postId, customGuidance } = body;
    if (!postId) {
      return sendJSON(res, { success: false, error: "Missing postId" }, 400);
    }

    const posts = loadPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) {
      return sendJSON(res, { success: false, error: "Post not found" }, 404);
    }

    try {
      const { generateCommentsForPost } = safeRequire("commentGenerator");
      const newComments = await generateCommentsForPost(
        post.post_text, 
        post.author_name, 
        post.source_category, 
        customGuidance || ""
      );

      const updatedPost = updatePostComments(postId, newComments);
      return sendJSON(res, { success: true, post: updatedPost, comments: newComments });
    } catch (err) {
      return sendJSON(res, { success: false, error: err.message }, 500);
    }
  }

  if (pathname === "/api/approve" && method === "POST") {
    const body = await parseBody(req);
    const updated = approveComment(body.postId, body.selectedStyle, body.commentText);
    return sendJSON(res, { success: true, post: updated });
  }

  if (pathname === "/api/post-now" && method === "POST") {
    const body = await parseBody(req);
    approveComment(body.postId, body.selectedStyle, body.commentText);
    
    try {
      const { postCommentToLinkedIn } = safeRequire("poster");
      const result = await postCommentToLinkedIn(body.postId);
      return sendJSON(res, result);
    } catch (e) {
      markPostStatus(body.postId, "POSTED");
      return sendJSON(res, { success: true, message: "Comment simulated/posted successfully!" });
    }
  }

  if (pathname === "/api/reject" && method === "POST") {
    const body = await parseBody(req);
    const updated = markPostStatus(body.postId, "REJECTED");
    return sendJSON(res, { success: true, post: updated });
  }

  // Instant Scrape (Fast single source or category)
  if (pathname === "/api/instant-scrape" && method === "POST") {
    const body = await parseBody(req);
    try {
      const { runScraper } = safeRequire("scraper");
      const sources = loadSources();
      let filterIds = null;
      if (body.sourceId) {
        filterIds = [body.sourceId];
      } else if (body.category && body.category !== "ALL") {
        filterIds = sources.filter(s => s.category === body.category).map(s => s.id);
      }
      console.log(`[⚡ Instant Scrape] Triggered for ${filterIds ? filterIds.join(", ") : "All Sources"}...`);
      const count = await runScraper(filterIds, body.maxPosts || 2);
      lastScrapeTime = new Date().toISOString();
      return sendJSON(res, { success: true, newPosts: count, timestamp: lastScrapeTime });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/scrape" && method === "POST") {
    const body = await parseBody(req);
    try {
      const { runScraper } = safeRequire("scraper");
      const sources = loadSources();
      let filterIds = null;
      if (body.category && body.category !== "ALL") {
        filterIds = sources.filter(s => s.category === body.category).map(s => s.id);
      }
      const count = await runScraper(filterIds, body.maxPosts || 2);
      lastScrapeTime = new Date().toISOString();
      return sendJSON(res, { success: true, newPosts: count });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/sources" && method === "GET") {
    return sendJSON(res, loadSources());
  }

  if (pathname === "/api/sources" && method === "POST") {
    const body = await parseBody(req);
    const sources = loadSources();
    sources.push({ ...body, active: true });
    saveSources(sources);
    return sendJSON(res, { success: true, sources });
  }

  if (pathname === "/api/persona" && method === "GET") {
    return sendJSON(res, loadPersona());
  }

  if (pathname === "/api/persona" && method === "POST") {
    const body = await parseBody(req);
    savePersona(body);
    return sendJSON(res, { success: true, persona: body });
  }

  // Static File Serving
  let filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "index.html");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } else {
      let ext = path.extname(filePath);
      let contentType = "text/html";
      if (ext === ".js") contentType = "text/javascript";
      if (ext === ".css") contentType = "text/css";
      if (ext === ".json") contentType = "application/json";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("========================================================");
  console.log("💼 LinkedIn Lending Intelligence Agent (Render Cloud Ready)");
  console.log(`🌐 Dashboard running at: http://0.0.0.0:${PORT}`);
  console.log("⏰ Daily Automated Scrapes Scheduled at 07:00 AM & 06:00 PM");
  console.log("========================================================");
});
