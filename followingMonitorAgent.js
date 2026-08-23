const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadSources, saveSources } = require('./db');

const SESSION_DIR = path.join(__dirname, 'session_data');

function canonicalUrl(url) {
  if (!url) return '';
  return url.trim().toLowerCase().split('?')[0].replace(/\/+$/, '');
}

/**
 * Synchronizes Sriram's followed LinkedIn companies and people
 */
async function syncSriramFollowingNetwork() {
  console.log('🔄 [Following Monitor Agent] Synchronizing Sriram\'s LinkedIn following network...');
  let context;
  const newDiscoveredSources = [];

  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 }
    });

    const page = await context.newPage();

    // 1. Scan Followed Companies
    await page.goto('https://www.linkedin.com/mynetwork/network-manager/company/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    for (let s = 0; s < 6; s++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(r => setTimeout(r, 800));
    }

    const companies = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/company/"]');
      links.forEach(a => {
        const href = a.href;
        const name = a.innerText.trim();
        if (href && name && name.length >= 2 && !href.includes('/jobs') && !href.includes('/people')) {
          const cleanUrl = href.split('?')[0].replace(/\/+$/, '') + '/posts/';
          items.push({ name, url: cleanUrl });
        }
      });
      return items;
    });

    // 2. Scan Followed People
    await page.goto('https://www.linkedin.com/mynetwork/network-manager/people-follow/following/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    for (let s = 0; s < 6; s++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(r => setTimeout(r, 800));
    }

    const people = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/in/"]');
      links.forEach(a => {
        const href = a.href;
        const name = a.innerText.trim();
        if (href && name && name.length >= 3 && !href.includes('/mini-profile') && !href.includes('/overlay')) {
          const cleanUrl = href.split('?')[0].replace(/\/+$/, '') + '/recent-activity/all/';
          items.push({ name, url: cleanUrl });
        }
      });
      return items;
    });

    await context.close();

    // 3. Merge into sources.json
    const currentSources = loadSources();
    const sourceMap = new Map();
    currentSources.forEach(s => {
      sourceMap.set(canonicalUrl(s.url) || s.id, s);
    });

    let addedCount = 0;

    companies.forEach(c => {
      const key = canonicalUrl(c.url);
      if (key && !sourceMap.has(key)) {
        const newSrc = {
          id: c.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: c.name,
          category: "Sriram Followed Pages",
          type: "company",
          url: c.url,
          role_type: "LinkedIn Followed Entity",
          segment: "Followed Company",
          active: true
        };
        sourceMap.set(key, newSrc);
        newDiscoveredSources.push(newSrc);
        addedCount++;
      }
    });

    people.forEach(p => {
      const key = canonicalUrl(p.url);
      if (key && !sourceMap.has(key)) {
        const newSrc = {
          id: p.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: p.name,
          category: "Sriram Followed Leaders",
          type: "person",
          url: p.url,
          role_type: "LinkedIn Followed Connection / Leader",
          segment: "Followed Leader",
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
      console.log(`✅ [Following Monitor Agent] Successfully merged ${addedCount} new followed sources into catalog! Total: ${updatedList.length}`);
    } else {
      console.log(`ℹ️ [Following Monitor Agent] Following network is up to date (all ${companies.length + people.length} already in catalog).`);
    }

    return { totalSources: sourceMap.size, newlyAdded: addedCount };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    console.error('Error syncing following network:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  syncSriramFollowingNetwork
};
