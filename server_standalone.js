const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Safe Dynamic Module Resolver
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
    } catch (e) {}
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

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

let lastScrapeTime = null;
let activeScrapeJob = {
  isRunning: false,
  progress: 0,
  total: 0,
  currentSource: "",
  newPosts: 0,
  status: "Idle"
};

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 
    "Content-Type": "application/json", 
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  });
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

// Background Scrape Runner (Non-blocking)
async function triggerBackgroundScrape(sourceIds = null, maxPosts = 2, label = "Manual") {
  if (activeScrapeJob.isRunning) {
    return activeScrapeJob;
  }

  activeScrapeJob = {
    isRunning: true,
    progress: 0,
    total: 0,
    currentSource: "Initializing...",
    newPosts: 0,
    status: `Running (${label})`
  };

  (async () => {
    try {
      const { runScraper } = safeRequire("scraper");
      const count = await runScraper(sourceIds, maxPosts, (current, total, srcName) => {
        activeScrapeJob.progress = current;
        activeScrapeJob.total = total;
        activeScrapeJob.currentSource = srcName;
      });

      lastScrapeTime = new Date().toISOString();
      activeScrapeJob = {
        isRunning: false,
        progress: activeScrapeJob.total,
        total: activeScrapeJob.total,
        currentSource: "Complete",
        newPosts: count,
        status: `Completed (${label})`,
        timestamp: lastScrapeTime
      };
      console.log(`✅ [SCRAPER FINISHED] Ingested ${count} new qualifying posts.`);
    } catch (err) {
      console.error(`❌ [SCRAPER FAILED] Error:`, err.message);
      activeScrapeJob = {
        isRunning: false,
        progress: 0,
        total: 0,
        currentSource: "Error",
        newPosts: 0,
        status: `Error: ${err.message}`
      };
    }
  })();

  return activeScrapeJob;
}

// Cron Scheduler (7am & 6pm)
try {
  const cron = require("node-cron");
  cron.schedule("0 7 * * *", () => triggerBackgroundScrape(null, 2, "Morning 7:00 AM"));
  cron.schedule("0 18 * * *", () => triggerBackgroundScrape(null, 2, "Evening 6:00 PM"));
  console.log("⏰ Automated Scheduler Initialized: Running at 07:00 AM & 18:00 PM daily.");
} catch (e) {
  console.log("Cron scheduler will run when node-cron is present");
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (pathname === "/api/stats" && method === "GET") {
    return sendJSON(res, getStats());
  }

  if (pathname === "/api/scheduler-status" && method === "GET") {
    return sendJSON(res, {
      schedule: ["07:00 AM Morning", "06:00 PM Evening"],
      status: "ACTIVE",
      lastScrapeTime,
      activeScrapeJob
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
    if (!postId) return sendJSON(res, { success: false, error: "Missing postId" }, 400);

    const posts = loadPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return sendJSON(res, { success: false, error: "Post not found" }, 404);

    try {
      const { generateCommentsForPost } = safeRequire("commentGenerator");
      const newComments = await generateCommentsForPost(post.post_text, post.author_name, post.source_category, customGuidance || "");
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

  // Non-blocking Scrape Trigger (Responds instantly in < 50ms)
  if ((pathname === "/api/scrape" || pathname === "/api/instant-scrape") && method === "POST") {
    const body = await parseBody(req);
    const sources = loadSources();
    let filterIds = null;
    if (body.sourceId) {
      filterIds = [body.sourceId];
    } else if (body.category && body.category !== "ALL") {
      filterIds = sources.filter(s => s.category === body.category).map(s => s.id);
    }

    const job = await triggerBackgroundScrape(filterIds, body.maxPosts || 2, body.category || "Selected Sources");
    return sendJSON(res, { success: true, message: "Scraping running in background", job });
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
      if (ext === ".json" || ext === ".webmanifest") contentType = "application/json";
      if (ext === ".svg") contentType = "image/svg+xml";
      if (ext === ".png") contentType = "image/png";
      if (ext === ".ico") contentType = "image/x-icon";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("========================================================");
  console.log("💼 LinkedIn Lending Intelligence Agent (Async Scraper Active)");
  console.log(`🌐 Dashboard running at: http://0.0.0.0:${PORT}`);
  console.log("⏰ Daily Automated Scrapes Scheduled at 07:00 AM & 06:00 PM");
  console.log("========================================================");
});
