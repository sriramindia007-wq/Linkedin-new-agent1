const fs = require('fs');
const path = require('path');
const { generateCommentsForPost } = require('./commentGenerator');
const { calculateRelevance } = require('./relevanceScorer');
const { analyzeLendingRelevance } = require('./lendingRelevanceAgent');
const { loadPosts, savePosts, postExists } = require('./db');

const NEWS_SOURCES = [
  { name: "ETBFSI (Economic Times)", url: "https://www.linkedin.com/company/etbfsi/posts/", category: "Fintech & Lending News" },
  { name: "LiveMint Banking & Finance", url: "https://www.linkedin.com/company/livemint/posts/", category: "Fintech & Lending News" },
  { name: "Moneycontrol Banking & Finance", url: "https://www.linkedin.com/company/moneycontrol/posts/", category: "Fintech & Lending News" },
  { name: "Business Standard Banking", url: "https://www.linkedin.com/company/business-standard/posts/", category: "Fintech & Lending News" },
  { name: "Inc42 Fintech & Funding", url: "https://www.linkedin.com/company/inc42/posts/", category: "Fintech & Lending News" },
  { name: "YourStory Fintech", url: "https://www.linkedin.com/company/yourstorycom/posts/", category: "Fintech & Lending News" },
  { name: "Entrackr Fintech", url: "https://www.linkedin.com/company/entrackr/posts/", category: "Fintech & Lending News" },
  { name: "FinSamudra (BFSI Insights)", url: "https://www.linkedin.com/company/finsamudra/posts/", category: "Fintech & Lending News" },
  { name: "GenCFO India", url: "https://www.linkedin.com/company/gencfo/posts/", category: "Fintech & Lending News" },
  { name: "BankNBFC.com", url: "https://www.linkedin.com/company/banknbfc-com/posts/", category: "Fintech & Lending News" }
];

async function scrapeNewsAndFunding() {
  console.log("📰 [News Agent] Starting Ingestion for Lending News, NBFC Funding, IPOs & RBI Policy...");
  const currentPosts = loadPosts();
  let addedCount = 0;

  try {
    const { chromium } = require("playwright");
    const SESSION_DIR = path.resolve(__dirname.includes('src_node') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));
    const context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 }
    });

    const page = await context.newPage();

    for (const src of NEWS_SOURCES) {
      if (!src.url) continue;
      try {
        console.log(`[News Agent] Scanning ${src.name}...`);
        await page.goto(src.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 800));

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

          const check = analyzeLendingRelevance(item.text, src.name, src.category);
          const isFundingOrNews = /funding|series\s+[a-e]|debt|ipo|listing|rbi|growth|loan|nbfc|npa|credit|los|bre/i.test(item.text);
          if (!check.isRelevant && !isFundingOrNews) continue;

          console.log(`[News Agent] Generating analysis & comments for: ${src.name} (${item.actId})...`);
          const comments = await generateCommentsForPost(item.text, src.name, "Fintech & Lending News");
          const score = calculateRelevance(item.text, "Fintech & Lending News", src.name);

          const postObj = {
            id: `news_${item.actId}`,
            source_id: src.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            source_name: src.name,
            source_category: "Fintech & Lending News",
            author_name: src.name,
            author_headline: `${src.name} • Financial News & Markets`,
            post_url: directUrl,
            post_text: item.text,
            published_relative: item.time || "1d",
            scraped_at: new Date().toISOString(),
            status: "PENDING",
            news_type: isFundingOrNews ? "Funding / Market Intel" : "Lending News",
            priority_score: Math.max(90, score.score || 90),
            impact_badge: "📰 Market Intel",
            post_type_badge: "💼 Funding, IPO & Lending News",
            badge_color: "info",
            relevance_tags: ["Funding", "BFSI News", "Fintech", "Policy"],
            generated_comments: comments
          };

          currentPosts.unshift(postObj);
          addedCount++;
        }
      } catch (err) {
        console.log(`[News Agent] Error scanning ${src.name}: ${err.message}`);
      }
    }

    await context.close();
  } catch (e) {
    console.error("[News Agent] Playwright error:", e.message);
  }

  if (addedCount > 0) {
    savePosts(currentPosts);
    console.log(`🎉 [News Agent] Ingested ${addedCount} fresh financial news & funding posts!`);
  }
  return { success: true, addedCount };
}

module.exports = {
  scrapeNewsAndFunding,
  NEWS_SOURCES
};
