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
  savePosts,
  insertPost,
  approveComment, 
  updatePostComments,
  markPostStatus, 
  markPostAsManuallyPosted,
  markPostAsCompetitor,
  recordPersistedAction,
  getPostsPaged,
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
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma, Authorization, X-Requested-With, X-Auth-Token"
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

// 1. Specialized Agent: Market News Crawler (4 RSS Financial Streams, ~5s)
async function triggerNewsCrawlJob(label = "Market News") {
  if (activeScrapeJob.isRunning) {
    console.log(`ℹ️ [News Agent] Crawler already running: "${activeScrapeJob.status}".`);
    return activeScrapeJob;
  }
  const startTime = Date.now();
  const { SEARCH_STREAMS } = safeRequire("externalNewsEngine") || {};
  const totalStreams = (SEARCH_STREAMS && SEARCH_STREAMS.length) || 12;

  activeScrapeJob = {
    isRunning: true,
    channel: "NEWS",
    progress: 0,
    total: totalStreams,
    currentSource: "Scanning 12 Live Indian Financial News Streams (Mint, ETBFSI, Financial Express, Business Standard, Reuters)...",
    newPosts: 0,
    status: `Running (${label})`,
    startTime: new Date().toISOString()
  };

  (async () => {
    let count = 0;
    try {
      const { fetchAllExternalNews } = safeRequire("externalNewsEngine");
      if (fetchAllExternalNews) {
        const res = await fetchAllExternalNews();
        count = res?.count || 0;
      }
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      lastScrapeTime = new Date().toISOString();
      activeScrapeJob = {
        isRunning: false,
        channel: "NEWS",
        progress: totalStreams,
        total: totalStreams,
        currentSource: "Complete",
        newPosts: count,
        breakdown: { news: count, governance: 0, lending: 0 },
        status: `Completed (${label}) in ${elapsedSec}s`,
        timestamp: lastScrapeTime,
        elapsedSeconds: elapsedSec,
        justCompleted: true
      };
      console.log(`✅ [Market News Agent] Scan complete in ${elapsedSec}s across ${totalStreams} streams: +${count} articles.`);
    } catch (e) {
      activeScrapeJob.status = `Error: ${e.message}`;
      activeScrapeJob.isRunning = false;
    }
  })();
  return activeScrapeJob;
}

// 2. Specialized Agent: Boardroom & Governance Crawler (All 161+ IICA & Independent Director Sources)
async function triggerGovernanceCrawlJob(label = "Boardroom & Governance") {
  if (activeScrapeJob.isRunning) {
    console.log(`ℹ️ [Governance Agent] Crawler already running: "${activeScrapeJob.status}".`);
    return activeScrapeJob;
  }
  const startTime = Date.now();
  const { getAllGovernanceSources, scrapeBoardAndGovernance } = safeRequire("boardGovernanceAgent") || {};
  const allGovSources = getAllGovernanceSources ? getAllGovernanceSources() : [];
  const totalCount = allGovSources.length + 1; // All sources + Live IICA Search stream

  activeScrapeJob = {
    isRunning: true,
    channel: "GOVERNANCE",
    progress: 0,
    total: totalCount,
    currentSource: `Scanning ${allGovSources.length} IICA & Curated Independent Directors...`,
    newPosts: 0,
    status: `Running (${label})`,
    startTime: new Date().toISOString()
  };

  (async () => {
    let count = 0;
    try {
      if (scrapeBoardAndGovernance) {
        const res = await scrapeBoardAndGovernance((current, total, srcName) => {
          activeScrapeJob.progress = current;
          activeScrapeJob.total = total;
          activeScrapeJob.currentSource = srcName || "Scanning IICA & Boardroom Leaders...";
        });
        count = typeof res === "number" ? res : (res?.count || 0);
      }
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      lastScrapeTime = new Date().toISOString();
      activeScrapeJob = {
        isRunning: false,
        channel: "GOVERNANCE",
        progress: activeScrapeJob.total,
        total: activeScrapeJob.total,
        currentSource: "Complete",
        newPosts: count,
        breakdown: { news: 0, governance: count, lending: 0 },
        status: `Completed (${label}) in ${elapsedSec}s`,
        timestamp: lastScrapeTime,
        elapsedSeconds: elapsedSec,
        justCompleted: true
      };
      console.log(`✅ [Boardroom Agent] Scan complete in ${elapsedSec}s across ${totalCount} sources: +${count} posts.`);
    } catch (e) {
      activeScrapeJob.status = `Error: ${e.message}`;
      activeScrapeJob.isRunning = false;
    }
  })();
  return activeScrapeJob;
}

// 3. Specialized Agent: Lending Ecosystem Scraper (Targeted Category / Selection)
async function triggerLendingScrapeJob(sourceIds = null, maxPosts = 2, label = "Lending Review") {
  if (activeScrapeJob.isRunning) {
    console.log(`ℹ️ [Lending Agent] Crawler already running: "${activeScrapeJob.status}".`);
    return activeScrapeJob;
  }
  const startTime = Date.now();
  const allSources = loadSources();
  const targetSources = sourceIds ? allSources.filter(s => sourceIds.includes(s.id)) : allSources;

  activeScrapeJob = {
    isRunning: true,
    channel: "LENDING",
    progress: 0,
    total: targetSources.length,
    currentSource: "Scanning Lending Ecosystem...",
    newPosts: 0,
    status: `Running (${label})`,
    startTime: new Date().toISOString()
  };

  (async () => {
    let count = 0;
    try {
      const { runScraper } = safeRequire("scraper");
      if (runScraper) {
        const scraperCount = await runScraper(sourceIds, maxPosts, (current, total, srcName) => {
          activeScrapeJob.progress = current;
          activeScrapeJob.total = total;
          activeScrapeJob.currentSource = srcName || "Scanning Lending Ecosystem...";
        });
        if (typeof scraperCount === "number") count = scraperCount;
      }
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      lastScrapeTime = new Date().toISOString();
      activeScrapeJob = {
        isRunning: false,
        channel: "LENDING",
        progress: activeScrapeJob.total,
        total: activeScrapeJob.total,
        currentSource: "Complete",
        newPosts: count,
        breakdown: { news: 0, governance: 0, lending: count },
        status: `Completed (${label}) in ${elapsedSec}s`,
        timestamp: lastScrapeTime,
        elapsedSeconds: elapsedSec,
        justCompleted: true
      };
      console.log(`✅ [Lending Agent] Scan complete in ${elapsedSec}s: +${count} posts.`);
    } catch (e) {
      activeScrapeJob.status = `Error: ${e.message}`;
      activeScrapeJob.isRunning = false;
    }
  })();
  return activeScrapeJob;
}

// 4. Parallel Scheduled Sweep (07:00 AM & 06:00 PM IST: News, Governance & Lending run concurrently in parallel)
async function triggerScheduledParallelSweep(label = "Daily Scheduled Sweep") {
  if (activeScrapeJob.isRunning) return activeScrapeJob;
  const startTime = Date.now();

  activeScrapeJob = {
    isRunning: true,
    channel: "PARALLEL_ALL",
    progress: 0,
    total: 35,
    currentSource: "Running Market News, Boardroom Governance & Lending in Parallel...",
    newPosts: 0,
    status: `Running (${label})`,
    startTime: new Date().toISOString()
  };

  (async () => {
    let newsCount = 0;
    let govCount = 0;
    let lendingCount = 0;

    try {
      const { fetchAllExternalNews } = safeRequire("externalNewsEngine");
      const { scrapeBoardAndGovernance } = safeRequire("boardGovernanceAgent");

      // Execute News and Board Governance concurrently in parallel
      const results = await Promise.allSettled([
        fetchAllExternalNews ? fetchAllExternalNews() : Promise.resolve({ count: 0 }),
        scrapeBoardAndGovernance ? scrapeBoardAndGovernance() : Promise.resolve(0)
      ]);

      if (results[0].status === "fulfilled") {
        newsCount = results[0].value?.count || 0;
      }
      if (results[1].status === "fulfilled") {
        govCount = typeof results[1].value === "number" ? results[1].value : (results[1].value?.count || 0);
      }

      const totalNew = newsCount + govCount + lendingCount;
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      lastScrapeTime = new Date().toISOString();
      activeScrapeJob = {
        isRunning: false,
        channel: "PARALLEL_ALL",
        progress: 35,
        total: 35,
        currentSource: "Complete",
        newPosts: totalNew,
        breakdown: { news: newsCount, governance: govCount, lending: lendingCount },
        status: `Completed (${label}) in ${elapsedSec}s`,
        timestamp: lastScrapeTime,
        elapsedSeconds: elapsedSec,
        justCompleted: true
      };
      console.log(`✅ [Scheduled Parallel Sweep] Finished in ${elapsedSec}s. News (+${newsCount}), Governance (+${govCount}). Total: +${totalNew}`);
    } catch (e) {
      activeScrapeJob.status = `Error: ${e.message}`;
      activeScrapeJob.isRunning = false;
    }
  })();
  return activeScrapeJob;
}

// Robust IST Cron Scheduler (07:00 AM & 06:00 PM IST)
try {
  const cron = require("node-cron");
  cron.schedule("0 7 * * *", () => triggerScheduledParallelSweep("Morning 07:00 AM IST"), { timezone: "Asia/Kolkata" });
  cron.schedule("0 18 * * *", () => triggerScheduledParallelSweep("Evening 06:00 PM IST"), { timezone: "Asia/Kolkata" });
  console.log("⏰ Automated Scheduler Initialized: Running parallel sweeps at 07:00 AM & 06:00 PM IST daily.");
} catch (e) {
  console.log("Using built-in IST heartbeat ticker for scheduling");
}

// Deterministic UTC+5.5 IST Time Extractor
function getDeterministicIST() {
  const now = new Date();
  const istDate = new Date(now.getTime() + (5.5 * 3600 * 1000) + (now.getTimezoneOffset() * 60000));
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  const hour = istDate.getHours();
  const minute = String(istDate.getMinutes()).padStart(2, "0");
  return {
    year, month, day, hour, minute,
    dateKey: `${year}-${month}-${day}`,
    formatted: `${day}/${month}/${year} ${String(hour).padStart(2, "0")}:${minute} IST`
  };
}

// Initialize completed runs tracker with current date to prevent unrequested boots
const initIst = getDeterministicIST();
let completedRuns = new Set([`${initIst.dateKey}_startup_guard`]);

function checkAndRunScheduledSlots() {
  try {
    const { pruneExpiredPendingPosts } = safeRequire("db");
    if (pruneExpiredPendingPosts) pruneExpiredPendingPosts();

    const ist = getDeterministicIST();
    const morningKey = `${ist.dateKey}_morning_0700`;
    const eveningKey = `${ist.dateKey}_evening_1800`;

    // Only fire at exact designated hour slots
    if (ist.hour === 7 && ist.minute < 5 && !completedRuns.has(morningKey)) {
      completedRuns.add(morningKey);
      console.log(`⏰ [IST CRON] Triggering Morning Parallel Sweep for ${ist.dateKey}`);
      triggerScheduledParallelSweep("Morning 07:00 AM IST");
    }

    if (ist.hour === 18 && ist.minute < 5 && !completedRuns.has(eveningKey)) {
      completedRuns.add(eveningKey);
      console.log(`⏰ [IST CRON] Triggering Evening Parallel Sweep for ${ist.dateKey}`);
      triggerScheduledParallelSweep("Evening 06:00 PM IST");
    }
  } catch (err) {
    console.error("Scheduler ticker error:", err.message);
  }
}

// Check every 30 seconds
setInterval(checkAndRunScheduledSlots, 30000);

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma, Authorization, X-Requested-With, X-Auth-Token"
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
    const stats = getStats();
    stats.last_scrape = lastScrapeTime || (loadPosts().length > 0 ? loadPosts()[0].scraped_at : new Date().toISOString());
    return sendJSON(res, stats);
  }

  if (pathname === "/api/scheduler-status" && method === "GET") {
    return sendJSON(res, {
      schedule: ["07:00 AM Morning", "06:00 PM Evening"],
      status: "ACTIVE",
      lastScrapeTime: lastScrapeTime || (loadPosts().length > 0 ? loadPosts()[0].scraped_at : new Date().toISOString()),
      activeScrapeJob
    });
  }

  if (pathname === "/api/posts" && method === "GET") {
    const { getPostsPaged } = safeRequire("db");
    if (getPostsPaged) {
      const pagedResult = getPostsPaged({
        status: query.status || "PENDING",
        category: query.category || "ALL",
        page: parseInt(query.page, 10) || 1,
        limit: parseInt(query.limit, 10) || 50
      });
      return sendJSON(res, pagedResult);
    }

    let posts = loadPosts();
    
    // Always exclude REJECTED and POSTED from pending review
    posts = posts.filter(p => p.status !== "REJECTED" && p.status !== "POSTED" && p.status !== "COMPETITOR_RADAR");

    // Competitors are routed to the dedicated Competitor Radar tab
    if (!query.includeCompetitors) {
      posts = posts.filter(p => p.source_category !== "M2P LOS Competitors & Tech" && !p.competitor_intel);
    }

    if (query.status && query.status !== "ALL") {
      posts = posts.filter(p => p.status === query.status);
    }
    if (query.category && query.category !== "ALL") {
      posts = posts.filter(p => p.source_category === query.category);
    }
    return sendJSON(res, { posts: posts.slice(0, 50), total: posts.length, page: 1, totalPages: Math.ceil(posts.length / 50) });
  }

  if (pathname === "/api/sync-following" && method === "POST") {
    try {
      const { syncSriramFollowingNetwork } = safeRequire("followingMonitorAgent");
      if (syncSriramFollowingNetwork) {
        const result = await syncSriramFollowingNetwork();
        return sendJSON(res, { success: true, ...result });
      }
      return sendJSON(res, { success: false, error: "Following agent not found" }, 500);
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/posted-history" && method === "GET") {
    let posts = loadPosts();
    let history = posts.filter(p => p.status === "POSTED");
    history.sort((a, b) => new Date(b.posted_at || b.scraped_at) - new Date(a.posted_at || a.scraped_at));
    return sendJSON(res, history);
  }

  if (pathname === "/api/competitor-posts" && method === "GET") {
    let posts = loadPosts();
    const { isOlderThan3Days, isCompetitorPost } = safeRequire("db") || {};
    let competitorPosts = posts.filter(p => {
      if (p.status === "POSTED" || p.status === "REJECTED" || p.status === "EXPIRED") return false;
      if (isOlderThan3Days && isOlderThan3Days(p)) return false;
      return isCompetitorPost ? isCompetitorPost(p) : (p.source_category === "M2P LOS Competitors & Tech" || p.status === "COMPETITOR_RADAR");
    });
    return sendJSON(res, competitorPosts);
  }

  if (pathname === "/api/governance-posts" && method === "GET") {
    let posts = loadPosts();
    const { isOlderThan3Days, isGovernancePost } = safeRequire("db") || {};
    let govPosts = posts.filter(p => {
      if (p.status === "POSTED" || p.status === "REJECTED" || p.status === "EXPIRED") return false;
      if (isOlderThan3Days && isOlderThan3Days(p)) return false;
      return isGovernancePost ? isGovernancePost(p) : (p.source_category === "Board Leadership & Governance" || p.id.startsWith("gov_"));
    });
    return sendJSON(res, govPosts);
  }

  if (pathname === "/api/news-posts" && method === "GET") {
    const { loadMarketNews, fetchAllExternalNews } = safeRequire("externalNewsEngine") || {};
    let newsArticles = loadMarketNews ? loadMarketNews() : [];
    if (!newsArticles || newsArticles.length === 0) {
      if (fetchAllExternalNews) {
        fetchAllExternalNews().catch(e => console.error(e));
      }
    }
    const maxAge = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const noiseRegex = /\b(padres|baseball|rbi single|rbi double|homerun|cricket|marathon|fcnr|fixed deposit|nri deposit|celebration|bollywood|horoscope|ninth inning|somerset|dsl padres|border talks|space economy|house collapse|collapses|landslide|subsidence|reservoir|dam|earthquake|flood|drown|accident|murder|arrest|crime|police|court verdict|weather|rain|snow|temperature|road accident|highway accident|traffic|temple|festival|cinema|movie|actor|actress|box office|web series|gold rate today|gold price in chennai|gold jewelry|petrol|diesel)\b/i;

    const filtered = (newsArticles || []).filter(n => {
      if (n.status === "REJECTED" || n.status === "POSTED") return false;
      const pubTime = new Date(n.published_at || n.scraped_at).getTime();
      if ((now - pubTime) > maxAge) return false;
      if (noiseRegex.test((n.headline + ' ' + (n.publisher || '')).toLowerCase())) return false;
      return true;
    });

    return sendJSON(res, filtered);
  }

  if (pathname === "/api/trigger-news-scrape" && method === "POST") {
    try {
      const job = await triggerNewsCrawlJob("Manual Market News");
      return sendJSON(res, { success: true, message: "Market News crawler started in background", job });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/trigger-governance-scrape" && method === "POST") {
    try {
      const job = await triggerGovernanceCrawlJob("Manual Boardroom & Governance");
      return sendJSON(res, { success: true, message: "Boardroom & Governance crawler started in background", job });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/publish-news-to-linkedin" && method === "POST") {
    const body = await parseBody(req);
    const { articleId, repostText } = body;
    if (!repostText || !repostText.trim()) {
      return sendJSON(res, { success: false, error: "Missing repost text content" }, 400);
    }

    const { loadMarketNews, saveMarketNews } = safeRequire("externalNewsEngine") || {};
    let news = loadMarketNews ? loadMarketNews() : [];
    const item = news.find(n => n.id === articleId);

    try {
      const { publishStandalonePostToLinkedIn } = safeRequire("poster");
      if (!publishStandalonePostToLinkedIn) {
        return sendJSON(res, { success: false, error: "Post publisher module not found" }, 500);
      }

      const imagePath = item?.generated_takes?.image_path || "";
      const result = await publishStandalonePostToLinkedIn(repostText, item?.article_url || "", item?.publisher || "", imagePath);
      if (result.success) {
        if (item) {
          item.status = "POSTED";
          item.reposted_at = new Date().toISOString();
          item.repost_text = repostText;
          saveMarketNews(news);

          const { recordPersistedAction } = safeRequire("db") || {};
          if (recordPersistedAction) {
            recordPersistedAction(item, { status: "POSTED", reposted_at: item.reposted_at, repost_text: repostText });
          }
        }
        const { markPostAsManuallyPosted } = safeRequire("db");
        if (markPostAsManuallyPosted) {
          markPostAsManuallyPosted(articleId, repostText, `Published Post (${item?.publisher || 'Lending News'})`);
        }
        return sendJSON(res, { success: true, message: result.message || "Post successfully published to LinkedIn!" });
      } else {
        return sendJSON(res, { success: false, error: result.message || "Failed to publish post to LinkedIn" });
      }
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/mark-news-reposted" && method === "POST") {
    const body = await parseBody(req);
    const { articleId, repostText } = body;
    const { loadMarketNews, saveMarketNews } = safeRequire("externalNewsEngine") || {};
    let news = loadMarketNews ? loadMarketNews() : [];
    const item = news.find(n => n.id === articleId);
    if (item) {
      item.status = "POSTED";
      item.reposted_at = new Date().toISOString();
      item.repost_text = repostText;
      saveMarketNews(news);

      const { markPostAsManuallyPosted, recordPersistedAction } = safeRequire("db") || {};
      if (recordPersistedAction) {
        recordPersistedAction(item, { status: "POSTED", reposted_at: item.reposted_at, repost_text: repostText });
      }
      if (markPostAsManuallyPosted) {
        markPostAsManuallyPosted(articleId, repostText, `Authority Repost (${item.publisher || 'Media'})`);
      }
      return sendJSON(res, { success: true, message: "Marked as Reposted on LinkedIn!" });
    }
    return sendJSON(res, { success: false, error: "Article not found" }, 404);
  }

  if (pathname === "/api/skip-news" && method === "POST") {
    const body = await parseBody(req);
    const { articleId } = body;
    const { loadMarketNews, saveMarketNews } = safeRequire("externalNewsEngine") || {};
    let news = loadMarketNews ? loadMarketNews() : [];
    const item = news.find(n => n.id === articleId);
    if (item) {
      item.status = "REJECTED";
      saveMarketNews(news);

      // Lock skipped news article permanently into State Guardian Memory
      const { saveRejectedItem, recordPersistedAction, normalizeKey } = safeRequire("db") || {};
      if (saveRejectedItem) {
        if (item.article_url) saveRejectedItem(item.article_url);
        if (item.headline) saveRejectedItem(normalizeKey(item.headline));
      }
      if (recordPersistedAction) {
        recordPersistedAction(item, { status: "REJECTED" });
      }

      console.log(`🛡️ [State Guardian] Permanently memorized skipped news article: "${item.headline}"`);
      return sendJSON(res, { success: true, message: "Article permanently skipped and memorized" });
    }
    return sendJSON(res, { success: false, error: "Article not found" }, 404);
  }

  if (pathname === "/api/trigger-governance-scrape" && method === "POST") {
    try {
      const { scrapeBoardAndGovernance } = safeRequire("boardGovernanceAgent");
      if (scrapeBoardAndGovernance) {
        scrapeBoardAndGovernance().catch(e => console.error(e));
        return sendJSON(res, { success: true, message: "Board Leadership & Governance crawl launched!" });
      }
      return sendJSON(res, { success: false, error: "Governance agent not found" }, 500);
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  // 1-Click Move Post to Competitor Radar
  if (pathname === "/api/mark-as-competitor" && method === "POST") {
    const body = await parseBody(req);
    const { postId, note } = body;
    const post = markPostAsCompetitor(postId, note || "Flagged as Competitor Intel");
    if (!post) return sendJSON(res, { success: false, error: "Post not found" }, 404);
    return sendJSON(res, { success: true, message: "Moved to Competitor Radar!", post });
  }

  // --- POST SCHEDULER ENDPOINTS ---
  if (pathname === "/api/scheduled-posts" && method === "GET") {
    const { loadScheduledPosts } = safeRequire("schedulerEngine") || {};
    const list = loadScheduledPosts ? loadScheduledPosts() : [];
    return sendJSON(res, list);
  }

  if (pathname === "/api/schedule-post" && method === "POST") {
    try {
      const body = await parseBody(req);
      const { schedulePost } = safeRequire("schedulerEngine");
      if (!schedulePost) return sendJSON(res, { success: false, error: "Scheduler engine not loaded" }, 500);
      const item = schedulePost(body);
      return sendJSON(res, { success: true, message: "Post scheduled successfully!", item });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 400);
    }
  }

  if (pathname === "/api/cancel-scheduled-post" && method === "POST") {
    try {
      const body = await parseBody(req);
      const { cancelScheduledPost } = safeRequire("schedulerEngine");
      if (!cancelScheduledPost) return sendJSON(res, { success: false, error: "Scheduler engine not loaded" }, 500);
      const success = cancelScheduledPost(body.scheduleId);
      return sendJSON(res, { success, message: success ? "Scheduled post cancelled" : "Item not found" });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message }, 500);
    }
  }

  if (pathname === "/api/ml-learning-stats" && method === "GET") {
    const { loadMemory } = safeRequire("mlPreferenceEngine");
    const memory = loadMemory ? loadMemory() : {};
    return sendJSON(res, memory);
  }

  if (pathname === "/api/regenerate-comment" && method === "POST") {
    const body = await parseBody(req);
    const { postId, customGuidance } = body;
    if (!postId) return sendJSON(res, { success: false, error: "Missing postId" }, 400);

    const posts = loadPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return sendJSON(res, { success: false, error: "Post not found" }, 404);

    try {
      // Record user guidance to ML self-learning model
      if (customGuidance) {
        const { recordRegenerationGuidance } = safeRequire("mlPreferenceEngine");
        if (recordRegenerationGuidance) recordRegenerationGuidance(customGuidance, post.post_text);
      }

      const { generateCommentsForPost } = safeRequire("commentGenerator");
      const newComments = await generateCommentsForPost(post.post_text, post.author_name, post.source_category, customGuidance || "", postId);
      const updatedPost = updatePostComments(postId, newComments);
      return sendJSON(res, { success: true, post: updatedPost, comments: newComments });
    } catch (err) {
      return sendJSON(res, { success: false, error: err.message }, 500);
    }
  }

  if (pathname === "/api/approve" && method === "POST") {
    const body = await parseBody(req);
    const posts = loadPosts();
    const post = posts.find(p => p.id === body.postId);
    if (post) {
      const { recordApprovedComment } = safeRequire("mlPreferenceEngine");
      if (recordApprovedComment) recordApprovedComment(post, body.selectedStyle, body.commentText);
    }
    const updated = approveComment(body.postId, body.selectedStyle, body.commentText);
    return sendJSON(res, { success: true, post: updated });
  }

  if (pathname === "/api/post-now" && method === "POST") {
    const body = await parseBody(req);
    const { postId, selectedStyle, commentText } = body;
    if (!postId) return sendJSON(res, { success: false, error: "Missing postId" }, 400);

    const posts = loadPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return sendJSON(res, { success: false, error: "Post not found" }, 404);

    const finalComment = (commentText && commentText.trim().length > 0)
      ? commentText.trim()
      : (post.approved_comment || (post.generated_comments && post.generated_comments.value_add) || "");

    if (!finalComment) {
      return sendJSON(res, { success: false, error: "Please write or select a comment before posting." }, 400);
    }

    approveComment(postId, selectedStyle || "custom", finalComment);

    const { recordApprovedComment } = safeRequire("mlPreferenceEngine");
    if (recordApprovedComment) recordApprovedComment(post, selectedStyle || "custom", finalComment);

    try {
      const { postCommentToLinkedIn } = safeRequire("poster");
      const result = await postCommentToLinkedIn(postId, post.post_url, finalComment);
      if (result.success) {
        markPostStatus(postId, "POSTED");
        return sendJSON(res, { success: true, message: result.message || "Comment successfully posted to LinkedIn!" });
      } else {
        return sendJSON(res, { success: false, error: result.message || "Failed to post comment to LinkedIn" });
      }
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message || "Posting exception occurred" }, 500);
    }
  }

  // 1-Click Manual Post Tagging (Moves to Posted History with custom tag)
  if (pathname === "/api/mark-manually-posted" && method === "POST") {
    const body = await parseBody(req);
    const { postId, commentText, manualTag } = body;
    const post = markPostAsManuallyPosted(postId, commentText, manualTag || "Manually Posted on LinkedIn");
    if (!post) {
      return sendJSON(res, { success: false, error: "Post not found" }, 404);
    }

    const { recordApprovedComment } = safeRequire("mlPreferenceEngine");
    if (recordApprovedComment) recordApprovedComment(post, post.selected_style || "custom", commentText || post.approved_comment);

    return sendJSON(res, { success: true, message: "Marked as manually posted & moved to Posted History!", post });
  }

  // Force Reset Stuck Scraper Job
  if (pathname === "/api/reset-scraper" && method === "POST") {
    activeScrapeJob = {
      isRunning: false,
      progress: 0,
      total: 0,
      currentSource: "Ready",
      newPosts: 0,
      status: "Idle"
    };
    return sendJSON(res, { success: true, message: "Scraper state reset successfully." });
  }

  if ((pathname === "/api/reject" || pathname === "/api/skip") && method === "POST") {
    const body = await parseBody(req);
    const posts = loadPosts();
    const post = posts.find(p => p.id === body.postId);
    if (post) {
      const { recordSkippedPost } = safeRequire("mlPreferenceEngine");
      if (recordSkippedPost) recordSkippedPost(post);
    }
    const updated = markPostStatus(body.postId, "REJECTED");
    return sendJSON(res, { success: true, message: "Post skipped and blacklisted permanently", post: updated });
  }

  // 1-Click Single LinkedIn URL Ingestion
  if (pathname === "/api/ingest-url" && method === "POST") {
    const body = await parseBody(req);
    let targetUrl = (body.url || "").trim();
    if (!targetUrl) return sendJSON(res, { success: false, error: "Please provide a valid LinkedIn URL" }, 400);

    // Resolve shortlink if needed
    if (targetUrl.includes("lnkd.in")) {
      try {
        const resolved = await new Promise((resolve) => {
          https.get(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            resolve(res.headers.location || targetUrl);
          }).on("error", () => resolve(targetUrl));
        });
        targetUrl = resolved;
      } catch (e) {}
    }

    try {
      const { chromium } = require("playwright");
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));
      const extracted = await page.evaluate(() => {
        const textEl = document.querySelector("div.update-components-text, .feed-shared-update-v2__description, span.break-words, .feed-shared-text, .attributed-text-segment-list__content, article");
        const authorEl = document.querySelector(".update-components-actor__name, .feed-shared-actor__name, .update-components-actor__title span, a.app-aware-link, .base-main-card__title");
        const headEl = document.querySelector(".update-components-actor__description, .feed-shared-actor__description");
        const timeEl = document.querySelector("span.update-components-actor__sub-description, time");

        let text = textEl ? textEl.innerText.trim() : "";
        if (!text || text.length < 20) {
          const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content");
          if (ogDesc && ogDesc.length > 20) text = ogDesc;
        }

        let author = authorEl ? authorEl.innerText.trim() : "";
        if (!author) {
          const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
          if (ogTitle) author = ogTitle.split(" on LinkedIn")[0].replace("Post by ", "").trim();
        }

        return {
          author: author || "LinkedIn Creator",
          headline: headEl ? headEl.innerText.trim() : "Banking & Lending Voice",
          time: timeEl ? timeEl.innerText.trim() : "Recent (<48h)",
          text: text || document.title
        };
      });

      await browser.close();

      if (!extracted.text || extracted.text.length < 20) {
        return sendJSON(res, { success: false, error: "Could not extract text from this LinkedIn post" }, 400);
      }

      const { evaluatePostContext } = safeRequire("contentGatekeeper");
      const { calculateRelevance } = safeRequire("relevanceScorer");
      const { generateCommentsForPost } = safeRequire("commentGenerator");

      const validation = evaluatePostContext(extracted.text, extracted.author, "Direct Ingestion");
      const scoreResult = calculateRelevance(extracted.text, "Direct Ingestion", extracted.author, extracted.author);
      const comments = await generateCommentsForPost(extracted.text, extracted.author, "Direct Ingestion");

      const postItem = {
        id: `post_manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        source_id: "direct_ingest",
        source_name: extracted.author || "LinkedIn Post",
        source_category: "Direct Ingestion",
        author_name: extracted.author || "LinkedIn Author",
        author_headline: "LinkedIn Lending Voice",
        post_url: targetUrl,
        post_text: extracted.text,
        published_relative: extracted.time || "Recent",
        scraped_at: new Date().toISOString(),
        status: "PENDING",
        priority_score: scoreResult.score || scoreResult.priority_score || 90,
        impact_badge: scoreResult.impact_badge || "🔥 Top Priority",
        post_type_badge: validation.postTypeBadge || "⚡ Digital Lending & Credit",
        badge_color: "danger",
        relevance_tags: scoreResult.tags || scoreResult.relevance_tags || ["Lending", "Credit"],
        generated_comments: comments
      };

      insertPost(postItem);
      return sendJSON(res, { success: true, message: "Post successfully ingested & analyzed!", post: postItem });
    } catch (err) {
      return sendJSON(res, { success: false, error: "Ingestion failed: " + err.message }, 500);
    }
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

    const job = await triggerLendingScrapeJob(filterIds, body.maxPosts || 2, body.category || "Selected Sources");
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

  if (pathname === "/api/test-llm" && method === "POST") {
    const body = await parseBody(req);
    const { provider, apiKey } = body;
    if (!apiKey || apiKey.trim().length < 5) {
      return sendJSON(res, { success: false, error: "Please enter a valid API key" }, 400);
    }
    try {
      const { callGemini, callGroq, callOpenAI } = safeRequire("commentGenerator");
      const testPrompt = "You are Sriram Ganesan (Head of LOS Product, M2P Fintech). Return valid JSON: {\"value_add\": \"AI connection successful\", \"provocative_question\": \"Are workflows ready?\", \"executive_perspective\": \"Enterprise AI enabled.\"}";
      let result = null;
      if (provider === "gemini" || !provider) {
        result = await callGemini(apiKey.trim(), testPrompt);
      } else if (provider === "groq") {
        result = await callGroq(apiKey.trim(), testPrompt);
      } else if (provider === "openai") {
        result = await callOpenAI(apiKey.trim(), testPrompt);
      }
      return sendJSON(res, { success: true, message: "AI Connection Successful! Responses are active.", sample: result });
    } catch (err) {
      return sendJSON(res, { success: false, error: err.message }, 500);
    }
  }

  if (pathname === "/api/save-llm-settings" && method === "POST") {
    const body = await parseBody(req);
    const persona = loadPersona();
    persona.llm_provider = body.llm_provider || "gemini";
    if (body.gemini_api_key !== undefined) persona.gemini_api_key = body.gemini_api_key;
    if (body.groq_api_key !== undefined) persona.groq_api_key = body.groq_api_key;
    if (body.openai_api_key !== undefined) persona.openai_api_key = body.openai_api_key;
    savePersona(persona);

    // Save to .env if possible
    try {
      const envPath = path.join(__dirname, ".env");
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      if (persona.gemini_api_key) envContent += `\nGEMINI_API_KEY=${persona.gemini_api_key}`;
      if (persona.groq_api_key) envContent += `\nGROQ_API_KEY=${persona.groq_api_key}`;
      if (persona.openai_api_key) envContent += `\nOPENAI_API_KEY=${persona.openai_api_key}`;
      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    } catch (e) {}

    return sendJSON(res, { success: true, message: "LLM Settings saved successfully!", persona });
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
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      };
      if (contentType === "text/html") {
        headers["Clear-Site-Data"] = '"cache", "storage"';
      }
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("========================================================");
  console.log("💼 LinkedIn Lending Intelligence Agent (Async Scraper Active)");
  console.log(`🌐 Dashboard running at: http://0.0.0.0:${PORT}`);
  console.log("⏰ Daily Automated Scrapes Scheduled at 07:00 AM & 06:00 PM");
  
  // Start 30s background post scheduler daemon
  try {
    const { startSchedulerDaemon } = safeRequire("schedulerEngine") || {};
    if (startSchedulerDaemon) startSchedulerDaemon();
  } catch (e) {
    console.warn("Could not start scheduler daemon:", e.message);
  }

  // Start 3-hour automated LinkedIn session keep-alive daemon
  try {
    const { startSessionKeepAliveDaemon } = safeRequire("sessionKeepAliveAgent") || {};
    if (startSessionKeepAliveDaemon) startSessionKeepAliveDaemon();
  } catch (e) {
    console.warn("Could not start session keep alive daemon:", e.message);
  }
  console.log("========================================================");
});
