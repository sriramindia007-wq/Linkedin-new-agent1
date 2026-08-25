const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadSources, saveSources } = require('./db');

const SESSION_DIR = path.resolve(__dirname.includes('src_node') || __dirname.includes('src') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));

function canonicalUrl(url) {
  if (!url) return '';
  return url.trim().toLowerCase().split('?')[0].replace(/\/+$/, '');
}

/**
 * Synchronizes Sriram's 1st-degree connections and followed entities
 */
async function syncSriramFollowingNetwork() {
  console.log('🔄 [Network Discovery Agent] Synchronizing Sriram\'s 1st-degree connections & following network...');
  let context;
  const newDiscoveredSources = [];

  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    // 1. Scan 1st-Degree Recent Connections
    console.log('  -> Scanning /mynetwork/invite-connect/connections/ (Recent Connections)...');
    try {
      await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      for (let s = 0; s < 8; s++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (e) {
      console.log('  -> Warning navigating to connections:', e.message);
    }

    const connections = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('li.mn-connection-card, div.mn-connection-card__details, a[href*="/in/"]');
      cards.forEach(el => {
        let nameEl = el.querySelector('.mn-connection-card__name, span.actor-name') || el;
        let titleEl = el.querySelector('.mn-connection-card__occupation, .mn-connection-card__details span') || null;
        let linkEl = el.tagName === 'A' ? el : el.querySelector('a[href*="/in/"]');

        let name = nameEl ? nameEl.innerText.trim().split('\n')[0] : '';
        let headline = titleEl ? titleEl.innerText.trim() : '';
        let href = linkEl ? linkEl.href : '';

        if (name && href && !href.includes('/mini-profile') && !href.includes('/overlay') && !href.includes('/company/')) {
          const cleanUrl = href.split('?')[0].replace(/\/+$/, '') + '/recent-activity/all/';
          items.push({ name, headline, url: cleanUrl, type: 'individual' });
        }
      });
      return items;
    });
    console.log(`  -> Found ${connections.length} 1st-degree connection links.`);

    // 2. Scan Followed People
    console.log('  -> Scanning /mynetwork/network-manager/people-follow/following/...');
    try {
      await page.goto('https://www.linkedin.com/mynetwork/network-manager/people-follow/following/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      for (let s = 0; s < 6; s++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (e) {}

    const followedPeople = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/in/"]');
      links.forEach(a => {
        const href = a.href;
        const name = a.innerText.trim().split('\n')[0];
        if (href && name && name.length >= 3 && !href.includes('/mini-profile') && !href.includes('/overlay')) {
          const cleanUrl = href.split('?')[0].replace(/\/+$/, '') + '/recent-activity/all/';
          items.push({ name, headline: '', url: cleanUrl, type: 'individual' });
        }
      });
      return items;
    });

    // 3. Scan Followed Companies
    console.log('  -> Scanning /mynetwork/network-manager/company/...');
    try {
      await page.goto('https://www.linkedin.com/mynetwork/network-manager/company/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      for (let s = 0; s < 6; s++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (e) {}

    const companies = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/company/"]');
      links.forEach(a => {
        const href = a.href;
        const name = a.innerText.trim().split('\n')[0];
        if (href && name && name.length >= 2 && !href.includes('/jobs') && !href.includes('/people')) {
          const cleanUrl = href.split('?')[0].replace(/\/+$/, '') + '/posts/';
          items.push({ name, headline: '', url: cleanUrl, type: 'company' });
        }
      });
      return items;
    });

    await context.close();

    // 4. Merge into sources.json with Intelligent Classification
    const allDiscovered = [...connections, ...followedPeople, ...companies];
    const currentSources = loadSources();
    const sourceMap = new Map();
    currentSources.forEach(s => {
      sourceMap.set(canonicalUrl(s.url) || s.id, s);
    });

    let addedCount = 0;

    allDiscovered.forEach(item => {
      const key = canonicalUrl(item.url);
      if (key && !sourceMap.has(key) && item.name.length >= 3) {
        // Classify Category
        const textToAnalyze = `${item.name} ${item.headline || ''}`.toLowerCase();
        let category = "Sriram Followed Network";

        if (/director|board|iica|iod|independent\s+director|governance|audit\s+committee/i.test(textToAnalyze)) {
          category = "Board Leadership & Governance";
        } else if (/los|lending|credit|underwriting|nbfc|fintech|banking|loan/i.test(textToAnalyze)) {
          category = "Digital Lending & Credit";
        }

        const newSrc = {
          id: item.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substring(2, 5),
          name: item.name,
          category: category,
          type: item.type || "individual",
          url: item.url,
          role_type: "1st-Degree Connection / Followed",
          segment: "Network Sync",
          active: true
        };

        sourceMap.set(key, newSrc);
        newDiscoveredSources.push(newSrc);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      const updatedList = Array.from(sourceMap.values());
      saveSources(updatedList);

      // Mirror to all data paths
      const targetPaths = ['./data/sources.json', './src_node/sources.json', './src_node/data/sources.json'];
      targetPaths.forEach(p => {
        try {
          const dir = path.dirname(p);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(p, JSON.stringify(updatedList, null, 2));
        } catch (e) {}
      });

      console.log(`🎉 [Network Discovery Agent] Ingested ${addedCount} brand-new connections/pages! Total target sources: ${updatedList.length}`);
    } else {
      console.log('✅ [Network Discovery Agent] Network catalog is fully up to date.');
    }

    return { success: true, addedCount, total: sourceMap.size };
  } catch (err) {
    console.error('❌ [Network Discovery Agent] Error:', err.message);
    if (context) await context.close();
    return { success: false, error: err.message };
  }
}

module.exports = {
  syncSriramFollowingNetwork
};
