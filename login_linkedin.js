const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = 'C:\\Users\\srira\\.gemini\\antigravity\\scratch\\linkedin-new-agent1-src\\Linkedin-new-agent1-main\\session_data';

async function main() {
  console.log('========================================================');
  console.log('🔑 LINKEDIN 1-TIME AUTHENTICATION SETUP');
  console.log('========================================================');
  console.log('1. A visible Chrome window is opening.');
  console.log('2. Please log into your LinkedIn account (Sriram Ganesan).');
  console.log('3. Once you see your LinkedIn feed, this window will automatically save your session and close.');
  console.log('========================================================\n');

  const options = {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  };

  let context;
  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: 'chrome' });
  } catch (e) {
    try {
      context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: 'msedge' });
    } catch (e2) {
      context = await chromium.launchPersistentContext(SESSION_DIR, options);
    }
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for login...');

  // Poll until li_at cookie is present
  let loggedIn = false;
  for (let i = 0; i < 180; i++) { // wait up to 3 minutes
    await new Promise(r => setTimeout(r, 1000));
    try {
      const cookies = await context.cookies('https://www.linkedin.com');
      const li_at = cookies.find(c => c.name === 'li_at');
      if (li_at && li_at.value && li_at.value.length > 10) {
        console.log('\n🎉 SUCCESS! LinkedIn session cookie (li_at) detected and saved to session_data.');
        loggedIn = true;
        break;
      }
    } catch (err) {}
  }

  if (loggedIn) {
    console.log('✅ Your LinkedIn scraper is now 100% authenticated. You can close the browser window.');
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('⚠️ Timed out waiting for login. Please run this again when ready.');
  }

  await context.close();
}

main().catch(err => console.error('Login error:', err.message));
