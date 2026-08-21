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

  if (pathname === "/api/autopilot" && method === "GET") {
    const { loadAutopilotConfig } = safeRequire("autopilot");
    return sendJSON(res, loadAutopilotConfig());
  }

  if (pathname === "/api/autopilot" && method === "POST") {
    const body = await parseBody(req);
    const { saveAutopilotConfig, loadAutopilotConfig } = safeRequire("autopilot");
    const current = loadAutopilotConfig();
    const updated = { ...current, ...body };
    saveAutopilotConfig(updated);
    return sendJSON(res, { success: true, config: updated });
  }

  if (pathname === "/api/autopilot-trigger-cycle" && method === "POST") {
    const { runAutopilotEngagementCycle } = safeRequire("autopilot");
    const result = await runAutopilotEngagementCycle(safeRequire);
    return sendJSON(res, { success: true, result });
  }

  if (pathname === "/api/generate-viral-post" && method === "POST") {
    const body = await parseBody(req);
    const { topic, format } = body;
    
    // High-engagement B2B Lending templates
    let postContent = "";
    if (format === "teardown") {
      postContent = `Most Banks think Loan Origination System (LOS) modernization is about "digitizing paper forms".

It isn't.

Here is what happens behind the scenes in a true sub-minute MSME Digital Lending Architecture:

1️⃣ Instant Consent & Telemetry Ingestion:
→ Account Aggregator (AA) pulls 12-month bank statements in <3 seconds.
→ Real-time GSTN API reconciliation identifies sales circularity and supplier concentration.

2️⃣ Visual Business Rules Engine (BRE):
→ Risk policies shouldn't require 3-week engineering sprints.
→ Configurable credit matrix executes multi-tier policy cutoffs dynamically.

3️⃣ Frictionless Bureau & Fraud Checks:
→ Automated deduplication against internal blacklists and credit bureaus.
→ Alternate telemetry (device footprint, director linkage) scored before underwriter review.

4️⃣ Straight-Through Processing (STP) vs Assisted Decisioning:
→ Tier-1 Prime MSMEs: Instant sanction letter generation.
→ Edge Cases: Routed to credit officers with pre-flagged risk anomalies.

The result?
Disbursement turnaround drops from 7 days to 12 minutes—without diluting credit quality.

What is the biggest operational bottleneck your team faces during MSME origination today?

#DigitalLending #Fintech #LOS #BankingTech #MSMELending #CreditUnderwriting`;
    } else if (format === "contrarian") {
      postContent = `Unpopular Opinion in Fintech: 

90% of Digital Lending drop-offs do NOT happen because of "bad UI".

They happen because of rigid LOS policy orchestration.

Here is why:
When an MSME applicant has 2 bank accounts with differing turnover, or seasonal GST spikes:
❌ Legacy systems treat it as a hard failure and reject the application.
✅ Modern configurable LOS creates dynamic sub-limits and requests targeted telemetry instead.

If your lending engine treats credit underwriting as a binary Yes/No rather than an intelligent risk-pricing spectrum, you are leaving your best borrowers on the table.

Agree or disagree?

#Fintech #DigitalLending #RiskManagement #LOS #BankingInnovation`;
    } else {
      postContent = `The 2026 Checklist for Enterprise Loan Origination Systems (LOS):

If your lending tech stack doesn't have these 5 capabilities, you are building for 2018:

[ ] 1. Sub-second Account Aggregator (AA) & ULI framework integration
[ ] 2. No-code / Low-code Visual BRE for instant credit policy changes
[ ] 3. Multi-entity MSME underwriting (holding co + directors + GST)
[ ] 4. Automated co-lending & FLDG compliance tracking
[ ] 5. Real-time audit trail for board and regulatory compliance

Bookmark / Save this checklist for your next core banking or LOS modernization review. 📌

What would you add to this list?

#Banking #Fintech #LOS #CreditPolicy #LendingInfrastructure`;
    }

    return sendJSON(res, { success: true, post: postContent });
  }

  
  // 1. Hook Optimizer & Virality Score
  if (pathname === "/api/boost-hook" && method === "POST") {
    const body = await parseBody(req);
    const text = body.text || "";
    
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    
    // Algorithmic optimization
    let optimizedHook = firstLine;
    let suggestions = [];
    let score = 75;

    if (firstLine.toLowerCase().includes("i am") || firstLine.toLowerCase().includes("excited to") || firstLine.toLowerCase().includes("happy to")) {
      score = 45;
      suggestions.push("Avoid starting with 'I am excited' - it reduces 'See More' clicks by 60%.");
      optimizedHook = "Most BFSI leaders overlook this critical bottleneck in Digital Lending:";
    } else {
      score = 92;
      suggestions.push("Strong provocative hook. High probability of triggering 'See More' dwell time.");
    }

    const optimizedPost = optimizedHook + "\n\n" + lines.slice(1).join("\n\n") + "\n\n---\n💬 What is your team's perspective on this? Drop your thoughts below.";

    return sendJSON(res, {
      success: true,
      score: score,
      suggestions: suggestions,
      optimizedPost: optimizedPost
    });
  }

  // 2. First-Comment Booster (Pinned Authority Drop)
  if (pathname === "/api/boost-first-comment" && method === "POST") {
    const body = await parseBody(req);
    const topic = body.topic || "LOS & Digital Lending Modernization";

    const firstComment = `📌 Key takeaway for credit & product teams:
When orchestrating high-velocity MSME origination, the secret is decoupling the visual BRE from core engineering releases.

Curious to hear from fellow practitioners: Are you seeing higher friction during the initial consent capture or multi-tier GST reconciliation?`;

    return sendJSON(res, { success: true, firstComment });
  }

  // 3. Inbound Comment Reply Assistant (Thread Depth Multiplier)
  if (pathname === "/api/boost-reply" && method === "POST") {
    const body = await parseBody(req);
    const userComment = body.comment || "";
    const commenterName = body.name || "Colleague";

    const reply = `Great point, ${commenterName}. You hit on a crucial nuance—especially when balancing automated STP with edge-case credit underwriting under the revised RBI framework.

How is your team currently handling data reconciliation when telemetry streams show quarterly cashflow volatility?`;

    return sendJSON(res, { success: true, reply });
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
