const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const SESSION_DIR = path.join(__dirname, "session_data");

async function launchBrowser() {
  const options = {
    headless: false,
    viewport: { width: 1280, height: 850 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  // Try Chrome first, then Edge, then default Chromium
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
  console.log("🔐 LINKEDIN PERSISTENT SESSION SETUP");
  console.log("=================================================================");
  console.log(`Session data directory:\n${SESSION_DIR}\n`);
  console.log("1. Opening browser window...");
  console.log("2. Please enter your LinkedIn credentials and complete MFA (if any).");
  console.log("3. Once you see your LinkedIn Feed, return here and press ENTER.");
  console.log("=================================================================\n");

  let context;
  try {
    context = await launchBrowser();
    const page = context.pages().length ? context.pages()[0] : await context.newPage();
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question("👉 Press ENTER here in this terminal after you have logged in to LinkedIn...", () => {
        rl.close();
        resolve();
      });
    });

    console.log("\n✅ LinkedIn session cookies saved successfully in session_data/!");
    console.log("You can now use automated scraping and 1-click comment posting.");
    await context.close();
  } catch (err) {
    console.error("\n❌ Error launching browser:", err.message);
    if (context) await context.close().catch(() => {});
  }
}

setupSession();
