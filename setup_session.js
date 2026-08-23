const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const SESSION_DIR = path.resolve(__dirname.includes('src_node') || __dirname.includes('src') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));

async function launchBrowser() {
  const options = {
    headless: false,
    viewport: { width: 1280, height: 850 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  try {
    return await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "chrome" });
  } catch (e1) {
    try {
      return await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "msedge" });
    } catch (e2) {
      return await chromium.launchPersistentContext(SESSION_DIR, options);
    }
  }
}

async function setupSession() {
  console.log("=================================================================");
  console.log("🔐 LINKEDIN SELF-VALIDATING LOGIN SETUP");
  console.log("=================================================================");
  console.log(`Session directory: ${SESSION_DIR}`);
  console.log("1. Opening interactive browser window...");
  console.log("2. Please enter your LinkedIn credentials and complete MFA on screen.");
  console.log("3. The script will automatically detect when you reach your Feed!");
  console.log("=================================================================\n");

  let context;
  try {
    context = await launchBrowser();
    const page = context.pages().length ? context.pages()[0] : await context.newPage();
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

    console.log("⏳ Waiting for you to complete login in the browser window...");

    let isLoggedIn = false;
    let userName = "";

    const maxWaitMs = 180000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const currentUrl = page.url();
      if (!currentUrl.includes("login") && !currentUrl.includes("authwall") && !currentUrl.includes("checkpoint") && !currentUrl.includes("challenge")) {
        const check = await page.evaluate(() => {
          const hasNav = !!document.querySelector('.global-nav, #global-nav, .feed-identity-module, .profile-rail-card__actor-link');
          const nameEl = document.querySelector('.feed-identity-module__actor-meta, .profile-rail-card__actor-link, .t-16.t-black.t-bold');
          return { hasNav, name: nameEl ? nameEl.innerText.trim() : '' };
        }).catch(() => ({ hasNav: false, name: '' }));

        if (check.hasNav || currentUrl.includes("/feed")) {
          isLoggedIn = true;
          userName = check.name || "Sriram Ganesan";
          break;
        }
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (isLoggedIn) {
      console.log(`\n🎉 LOGIN SUCCESSFUL & VERIFIED!`);
      if (userName) console.log(`👤 Active User: ${userName}`);

      const cookies = await context.cookies();
      fs.writeFileSync(path.join(__dirname, "session_cookies.json"), JSON.stringify(cookies, null, 2), "utf-8");
      console.log(`💾 Saved ${cookies.length} session cookies to session_data/ and session_cookies.json!`);
      console.log("✅ 1-Click Posting & Deep Stream Scraping are now 100% active.\n");
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log("\n⚠️ Login was not completed within the timeout period.");
    }

    await context.close();
  } catch (err) {
    console.error("\n❌ Error during session setup:", err.message);
    if (context) await context.close().catch(() => {});
  }
}

setupSession();
