const fs = require('fs');
const path = require('path');
const { generateCommentsForPost } = require('./commentGenerator');
const { calculateRelevance } = require('./relevanceScorer');
const { loadPosts, savePosts, postExists, insertPost, loadSources } = require('./db');

const CURATED_GOVERNANCE_SOURCES = [
  { name: "Indian Institute of Corporate Affairs (IICA)", url: "https://www.linkedin.com/company/iica-official/posts/", category: "Board Leadership & Governance" },
  { name: "Institute of Directors (IOD), India", url: "https://www.linkedin.com/company/institute-of-directors-india/posts/", category: "Board Leadership & Governance" },
  { name: "Board Stewardship Inc.", url: "https://www.linkedin.com/company/boardstewardship/posts/?feedView=all", category: "Board Leadership & Governance" },
  { name: "Society of Independent Directors (SID)", url: "https://www.linkedin.com/company/society-of-independent-directors/posts/", category: "Board Leadership & Governance" },
  { name: "InGovern Research Services", url: "https://www.linkedin.com/company/ingovern-research-services/posts/", category: "Board Leadership & Governance" },
  { name: "Excellence Enablers (M. Damodaran)", url: "https://www.linkedin.com/company/excellence-enablers/posts/", category: "Board Leadership & Governance" },
  { name: "Sasi Chemmenkottil", url: "https://www.linkedin.com/in/sasi-chemmenkottil/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Sriram Vijayakumar (Independent Director)", url: "https://www.linkedin.com/in/sriram-vijayakumar-id/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Lakshmikanth Chavali", url: "https://www.linkedin.com/in/lakshmikanthchavali/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Ravi R Iyer", url: "https://www.linkedin.com/in/ravi-r-iyer/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Sarika Technology Solutions (STS)", url: "https://www.linkedin.com/in/sarika-technology-solutions-sts-785205204/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Vasu Dasari (Independent Director)", url: "https://www.linkedin.com/in/vasu-dasari-id/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "V V Iyer", url: "https://www.linkedin.com/in/vviyers/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Narendrasinh Jhala", url: "https://www.linkedin.com/in/narendrasinhjhala/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "C Girish Kumar (Strategy & Leadership)", url: "https://www.linkedin.com/in/c-girish-kumar-strategy-leadership-consulting/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Gaurav Gupta (Independent Director)", url: "https://www.linkedin.com/in/gauravgupta-independentdirector/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Shobha Shah", url: "https://www.linkedin.com/in/shobha-shah/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Gopal CFO", url: "https://www.linkedin.com/in/gopalcfo/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Shailendra K Goel", url: "https://www.linkedin.com/in/shailendrakgoel/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Sapna Chand", url: "https://www.linkedin.com/in/sapnachand/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Venkatakrishnan Radhakrishnan", url: "https://www.linkedin.com/in/venkatakrishnan-radhakrishnan-ba356761/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "I N Murthy", url: "https://www.linkedin.com/in/inmurthy/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Smitaa Magi", url: "https://www.linkedin.com/in/smitaa-magi-898879157/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Dr. Dilip Kumar Mishra", url: "https://www.linkedin.com/in/dr-dilip-kumar-mishra-7a091b54/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Seema Bhatnagar", url: "https://www.linkedin.com/in/seema-bhatnagar-97156612/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Addapa S Kumar", url: "https://www.linkedin.com/in/addapaskumar/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Prashanth Pereira", url: "https://www.linkedin.com/in/prashanth-pereira-4693931/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "M. Damodaran (Ex-SEBI Chairman)", url: "https://www.linkedin.com/in/m-damodaran-70b97017/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Nawshir Mirza (Independent Director)", url: "https://www.linkedin.com/in/nawshir-mirza-03a08815/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Shailesh Haribhakti (Board Chairman)", url: "https://www.linkedin.com/in/shailesh-haribhakti-03610411/recent-activity/all/", category: "Board Leadership & Governance" },
  { name: "Rama Bijapurkar (Author & Independent Director)", url: "https://www.linkedin.com/in/rama-bijapurkar-a9010413/recent-activity/all/", category: "Board Leadership & Governance" }
];

function getAllGovernanceSources() {
  const seen = new Set();
  const list = [];

  function add(name, url, category, headline) {
    if (!url) return;
    const clean = url.trim().toLowerCase().split('?')[0].replace(/\/+$/, '');
    if (!clean || seen.has(clean)) return;
    seen.add(clean);

    let targetUrl = clean;
    if (clean.includes('/company/')) {
      if (!targetUrl.includes('/posts')) targetUrl = targetUrl + '/posts/';
    } else if (clean.includes('/in/')) {
      if (!targetUrl.includes('/recent-activity/')) targetUrl = targetUrl + '/recent-activity/all/';
    }

    list.push({
      name: name || "Independent Director / Governance Leader",
      url: targetUrl,
      category: "Board Leadership & Governance",
      headline: headline || `${name} • Corporate Governance & Board Leadership`
    });
  }

  // 1. Static Curated Foundation
  for (const src of CURATED_GOVERNANCE_SOURCES) {
    add(src.name, src.url, src.category, src.headline);
  }

  // 2. Dynamically extract all IICA, IOD, Board & Independent Directors from sources.json
  try {
    const all = loadSources ? loadSources() : [];
    for (const item of all) {
      const matchStr = `${item.category || ''} ${item.name || ''} ${item.role_type || ''} ${item.segment || ''}`.toLowerCase();
      const isGov = matchStr.includes('governance') || 
                    matchStr.includes('board') || 
                    matchStr.includes('director') || 
                    matchStr.includes('iica') || 
                    matchStr.includes('iod') || 
                    matchStr.includes('audit committee') ||
                    matchStr.includes('nomination committee') ||
                    matchStr.includes('fiduciary');
      if (isGov) {
        add(item.name, item.url, "Board Leadership & Governance", item.role_type || item.category);
      }
    }
  } catch (e) {}

  return list;
}

async function scrapeBoardAndGovernance(onProgress = null) {
  const allGovernanceSources = getAllGovernanceSources();
  console.log(`🏛️ [Governance Agent] Starting Ingestion for ${allGovernanceSources.length} IICA & Board Leadership Sources...`);
  let addedCount = 0;

  try {
    const { chromium } = require("playwright");
    const SESSION_DIR = path.resolve(__dirname.includes('src_node') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));
    const context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 }
    });

    const page = await context.newPage();

    // 1. Scan Profile Feeds across all 161+ IICA & Boardroom Leaders
    for (let i = 0; i < allGovernanceSources.length; i++) {
      const src = allGovernanceSources[i];
      if (onProgress) {
        onProgress(i + 1, allGovernanceSources.length + 2, src.name);
      }

      if (!src.url) continue;
      try {
        console.log(`[Governance Agent] [${i + 1}/${allGovernanceSources.length}] Scanning ${src.name}...`);
        await page.goto(src.url, { waitUntil: "domcontentloaded", timeout: 18000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 600));

        const updates = await page.evaluate(() => {
          const list = [];
          const cards = document.querySelectorAll('div.feed-shared-update-v2, div.occludable-update, div[data-urn*="activity:"]');
          cards.forEach(c => {
            let actId = '';
            const urn = c.getAttribute('data-urn') || c.getAttribute('data-id') || '';
            const m = urn.match(/activity:(\d{15,})/);
            if (m) actId = m[1];
            if (!actId) {
              const str = c.innerHTML || '';
              const m2 = str.match(/urn:li:activity:(\d{15,})/);
              if (m2) actId = m2[1];
            }
            const textEl = c.querySelector('div.update-components-text, .feed-shared-update-v2__description, span.break-words, .feed-shared-text');
            const text = textEl ? textEl.innerText.trim() : '';
            const timeEl = c.querySelector('span.update-components-actor__sub-description span[aria-hidden="true"], time');
            const time = timeEl ? timeEl.innerText.trim() : '1d';
            if (actId && text && text.length >= 40) list.push({ actId, text, time });
          });
          return list;
        });

        for (const item of updates) {
          const directUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${item.actId}/`;
          if (postExists(directUrl, src.name, item.text)) continue;

          // Check governance keywords
          const isGov = /board|director|independent\s+director|governance|iica|iod|audit\s+committee|risk\s+management\s+committee|compliance|sebi|esg|fiduciary|boardroom|appointment|trust|stakeholder/i.test(item.text);
          if (!isGov) continue;

          console.log(`[Governance Agent] Generating boardroom perspectives for: ${src.name}...`);
          const comments = await generateCommentsForPost(item.text, src.name, "Board Leadership & Governance");
          const score = calculateRelevance(item.text, "Board Leadership & Governance", src.name);

          const postObj = {
            id: `gov_${item.actId}`,
            source_id: src.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            source_name: src.name,
            source_category: "Board Leadership & Governance",
            author_name: src.name,
            author_headline: src.headline || `${src.name} • Corporate Governance & Board Leadership`,
            post_url: directUrl,
            post_text: item.text,
            published_relative: item.time || "1d",
            scraped_at: new Date().toISOString(),
            status: "PENDING",
            governance_type: "Corporate Governance & Board Oversight",
            priority_score: Math.max(92, score.score || 92),
            impact_badge: "🏛️ Boardroom Insight",
            post_type_badge: "🏛️ Corporate Governance & Board Oversight",
            badge_color: "warning",
            relevance_tags: ["Boardroom", "Governance", "IICA", "Risk Committee"],
            generated_comments: comments
          };

          insertPost(postObj);
          addedCount++;
        }
      } catch (err) {
        console.log(`[Governance Agent] Error scanning ${src.name}: ${err.message}`);
      }
    }

    // 2. Scan Live LinkedIn IICA & Independent Director Search Discovery Stream
    if (onProgress) {
      onProgress(allGovernanceSources.length + 1, allGovernanceSources.length + 2, "Live IICA & Independent Director Search Stream");
    }

    try {
      const searchUrl = 'https://www.linkedin.com/search/results/content/?keywords=%22IICA%22+OR+%22Independent+Director%22+OR+%22Corporate+Governance%22&sortBy=%22date_posted%22';
      console.log(`[Governance Agent] Scanning Global IICA Search Stream...`);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 800));
      }

      const searchPosts = await page.evaluate(() => {
        const list = [];
        const cards = document.querySelectorAll('div.feed-shared-update-v2, div.occludable-update, div[data-urn*="activity:"]');
        cards.forEach(c => {
          let actId = '';
          const urn = c.getAttribute('data-urn') || c.getAttribute('data-id') || '';
          const m = urn.match(/activity:(\d{15,})/);
          if (m) actId = m[1];
          if (!actId) {
            const str = c.innerHTML || '';
            const m2 = str.match(/urn:li:activity:(\d{15,})/);
            if (m2) actId = m2[1];
          }
          const authorEl = c.querySelector('.update-components-actor__name, .feed-shared-actor__name, span.actor-name');
          const author = authorEl ? authorEl.innerText.trim().split('\n')[0] : 'IICA Board Leader';
          const textEl = c.querySelector('div.update-components-text, .feed-shared-update-v2__description, span.break-words, .feed-shared-text');
          const text = textEl ? textEl.innerText.trim() : '';
          const timeEl = c.querySelector('span.update-components-actor__sub-description span[aria-hidden="true"], time');
          const time = timeEl ? timeEl.innerText.trim() : '1d';
          if (actId && text && text.length >= 40) list.push({ actId, author, text, time });
        });
        return list;
      });

      for (const item of searchPosts) {
        const directUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${item.actId}/`;
        if (postExists(directUrl, item.author, item.text)) continue;

        const isGov = /board|director|independent\s+director|governance|iica|iod|audit\s+committee|risk\s+management\s+committee|compliance|sebi|esg|fiduciary|boardroom|appointment/i.test(item.text);
        if (!isGov) continue;

        console.log(`[Governance Agent] Generating boardroom perspectives for stream post by: ${item.author}...`);
        const comments = await generateCommentsForPost(item.text, item.author, "Board Leadership & Governance");
        const score = calculateRelevance(item.text, "Board Leadership & Governance", item.author);

        const postObj = {
          id: `gov_${item.actId}`,
          source_id: item.author.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          source_name: item.author,
          source_category: "Board Leadership & Governance",
          author_name: item.author,
          author_headline: `${item.author} • IICA & Boardroom Leadership`,
          post_url: directUrl,
          post_text: item.text,
          published_relative: item.time || "1d",
          scraped_at: new Date().toISOString(),
          status: "PENDING",
          governance_type: "Corporate Governance & Board Oversight",
          priority_score: Math.max(92, score.score || 92),
          impact_badge: "🏛️ Boardroom Insight",
          post_type_badge: "🏛️ Corporate Governance & Board Oversight",
          badge_color: "warning",
          relevance_tags: ["Boardroom", "Governance", "IICA", "Risk Committee"],
          generated_comments: comments
        };

        insertPost(postObj);
        addedCount++;
      }
    } catch (searchErr) {
      console.log(`[Governance Agent] Search stream note:`, searchErr.message);
    }

    await context.close();
  } catch (e) {
    console.error("[Governance Agent] Playwright error:", e.message);
  }

  if (addedCount > 0) {
    console.log(`🎉 [Governance Agent] Ingested ${addedCount} fresh Boardroom & Governance posts!`);
  }
  return { success: true, count: addedCount, addedCount };
}

module.exports = {
  scrapeBoardAndGovernance,
  getAllGovernanceSources,
  GOVERNANCE_SOURCES: CURATED_GOVERNANCE_SOURCES
};
