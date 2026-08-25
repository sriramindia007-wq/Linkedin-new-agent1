const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SESSION_DIR = path.resolve(__dirname.includes('src_node') || __dirname.includes('src') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));
const COOKIE_FILE = path.resolve(__dirname.includes('src_node') ? path.join(__dirname, '..', 'session_cookies.json') : path.join(__dirname, 'session_cookies.json'));

/**
 * LINKEDIN SESSION GUARDIAN & KEEP-ALIVE AGENT
 * 
 * Automatically runs every 3 hours in the background:
 * 1. Checks if the current LinkedIn session is active.
 * 2. Refreshes the `li_at` and `JSESSIONID` tokens by pinging the feed headlessly.
 * 3. Saves fresh cookies to `session_cookies.json` for poster.js.
 * 4. Prevents the session from expiring or becoming dormant.
 */
async function refreshLinkedInSessionKeepAlive() {
  console.log('🛡️ [Session Guardian] Running automated LinkedIn session keep-alive ping...');
  
  if (!fs.existsSync(SESSION_DIR)) {
    console.log('⚠️ [Session Guardian] session_data directory not initialized yet. Run setup_session.js once to establish initial login.');
    return { status: 'NO_SESSION_DIR', message: 'Initial login required via setup_session.js' };
  }

  const chromiumArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  const options = {
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    args: chromiumArgs
  };

  let context;
  try {
    try {
      context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: 'chrome' });
    } catch (e1) {
      try {
        context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: 'msedge' });
      } catch (e2) {
        context = await chromium.launchPersistentContext(SESSION_DIR, options);
      }
    }

    const page = context.pages().length ? context.pages()[0] : await context.newPage();
    
    // Navigate gently to feed with reasonable timeout
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('authwall') || currentUrl.includes('checkpoint')) {
      console.warn('⚠️ [Session Guardian] LinkedIn session expired. Interactive login needed once via node setup_session.js.');
      await context.close();
      return { status: 'EXPIRED', message: 'Session expired, login required' };
    }

    // Extract refreshed cookies
    const cookies = await context.cookies();
    const liAt = cookies.find(c => c.name === 'li_at');

    if (liAt && liAt.value) {
      fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), 'utf-8');
      console.log(`✅ [Session Guardian] LinkedIn session verified active! Saved ${cookies.length} live cookies (li_at expires: ${new Date(liAt.expires * 1000).toLocaleDateString()}).`);
      await context.close();
      return { status: 'ACTIVE', cookiesCount: cookies.length, expires: liAt.expires };
    } else {
      console.log('ℹ️ [Session Guardian] Feed reachable but li_at cookie not found in context.');
      await context.close();
      return { status: 'PARTIAL', cookiesCount: cookies.length };
    }
  } catch (err) {
    console.error('❌ [Session Guardian] Keep-alive check encountered error:', err.message);
    if (context) {
      try { await context.close(); } catch (e) {}
    }
    return { status: 'ERROR', error: err.message };
  }
}

// Background Cron for Keep-Alive every 3 hours
let keepAliveInterval = null;
function startSessionKeepAliveDaemon() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  // Initial gentle check after 10s server startup
  setTimeout(() => {
    refreshLinkedInSessionKeepAlive().catch(() => {});
  }, 10000);

  // Every 3 hours (3 * 3600 * 1000 ms)
  keepAliveInterval = setInterval(() => {
    refreshLinkedInSessionKeepAlive().catch(() => {});
  }, 3 * 3600 * 1000);

  console.log('🛡️ [Session Guardian Daemon] Active — automated keep-alive heartbeat scheduled every 3 hours.');
}

module.exports = {
  refreshLinkedInSessionKeepAlive,
  startSessionKeepAliveDaemon
};
