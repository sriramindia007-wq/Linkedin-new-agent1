const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { markPostStatus } = require("./db");

const SESSION_DIR = path.resolve(__dirname.includes('src_node') || __dirname.includes('src') ? path.join(__dirname, '..', 'session_data') : path.join(__dirname, 'session_data'));
const HEADLESS = process.env.HEADLESS_BROWSER !== "false";

async function launchPosterContext() {
  const isLinux = process.platform === "linux";
  const chromiumArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer"
  ];

  const options = {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    args: chromiumArgs
  };

  let context;
  if (!isLinux) {
    try {
      context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "chrome" });
    } catch (e) {
      try {
        context = await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "msedge" });
      } catch (e2) {
        context = await chromium.launchPersistentContext(SESSION_DIR, options);
      }
    }
  } else {
    try {
      context = await chromium.launchPersistentContext(SESSION_DIR, options);
    } catch (e) {
      const browser = await chromium.launch({ headless: true, args: chromiumArgs });
      context = await browser.newContext(options);
    }
  }

  // Load session_cookies.json into cloud/Docker context
  const cookiePath = path.resolve(__dirname.includes('src_node') ? path.join(__dirname, '..', 'session_cookies.json') : path.join(__dirname, 'session_cookies.json'));
  if (fs.existsSync(cookiePath)) {
    try {
      const raw = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(raw);
      if (Array.isArray(cookies) && cookies.length > 0) {
        await context.addCookies(cookies);
        console.log(`[Poster] Loaded ${cookies.length} session cookies into context.`);
      }
    } catch (err) {}
  }

  return context;
}

async function postCommentToLinkedin(postId, postUrl, commentText) {
  if (!postUrl || !commentText) {
    return { success: false, message: "Missing post URL or comment text" };
  }

  const startTime = Date.now();
  let context;
  try {
    context = await launchPosterContext();
    const page = context.pages().length ? context.pages()[0] : await context.newPage();

    console.log(`[Poster] ⚡ Fast Navigating to ${postUrl}...`);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(async () => {
      await page.goto(postUrl, { waitUntil: "commit", timeout: 15000 });
    });
    await new Promise(r => setTimeout(r, 1200));

    // Check login, authwall, or guest sign-in modal
    const isGuestOrLoggedOut = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const hasSignInModal = !!document.querySelector('.contextual-sign-in-modal, .sign-in-form, a[href*="/login"]');
      const hasNav = !!document.querySelector('.global-nav__me, #global-nav, .feed-shared-actor');
      return !hasNav && (text.includes('Sign in') || text.includes('Join LinkedIn') || hasSignInModal);
    });

    if (page.url().includes("login") || page.url().includes("authwall") || isGuestOrLoggedOut) {
      await context.close();
      const err = "LinkedIn session expired. Please run `node setup_session.js` in your terminal to log in and refresh your cookies.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    // Check if comments are turned off
    const pageText = await page.evaluate(() => document.body.innerText || '');
    if (pageText.includes("Comments on this post have been limited") || pageText.includes("Comments are turned off")) {
      await context.close();
      const err = "Comments are disabled/limited on this LinkedIn post by the author.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    // Scroll slightly to trigger lazy-loaded comment container
    await page.evaluate(() => window.scrollBy(0, 350));
    await new Promise(r => setTimeout(r, 400));

    // Reveal collapsed comment box if present
    try {
      const commentBtn = await page.$("button[aria-label*='Comment'], button.comment-button, button.artdeco-button--tertiary, button:has-text('Comment')");
      if (commentBtn) {
        await commentBtn.click().catch(() => {});
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {}

    // Wait and locate the comment editor box across all LinkedIn 2026 variants
    const COMMENT_SELECTORS = [
      "div.tiptap.ProseMirror",
      "div[aria-label*='Text editor for creating comment']",
      "div[contenteditable='true'][role='textbox']",
      "div.comments-comment-box__editor",
      "div.ql-editor[role='textbox']",
      "div.editor-content",
      "div[data-placeholder*='comment']",
      "div[contenteditable='true']"
    ];

    let commentBox = null;
    for (const selector of COMMENT_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el) {
          const isVisible = await el.isVisible().catch(() => true);
          if (isVisible) {
            commentBox = el;
            console.log(`[Poster] Located comment box via selector: ${selector}`);
            break;
          }
        }
      } catch (e) {}
    }

    if (!commentBox) {
      const anyEditable = await page.$("[contenteditable='true']");
      if (anyEditable) commentBox = anyEditable;
    }

    if (!commentBox) {
      await context.close();
      const err = "Could not locate comment text area on LinkedIn post.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    // Focus editor and insert text instantly with native keyboard event
    await commentBox.click({ force: true }).catch(() => {});
    await new Promise(r => setTimeout(r, 200));

    console.log(`[Poster] ⚡ Fast Inserting comment (${commentText.length} chars)...`);
    await page.keyboard.insertText(commentText);
    await new Promise(r => setTimeout(r, 400));

    // Locate active Submit Comment button
    const SUBMIT_SELECTORS = [
      "button:has-text('Comment'):not([disabled]):not([aria-label='Comment'])",
      "button.comments-comment-box__submit-button:not([disabled])",
      "button[type='submit'].artdeco-button--primary:not([disabled])",
      "button:has-text('Post'):not([disabled])",
      "button.comments-comment-box__submit-button",
      "button:has-text('Comment'):not([disabled])"
    ];

    let submitBtn = null;
    for (const s of SUBMIT_SELECTORS) {
      try {
        const btn = await page.$(s);
        if (btn) {
          const disabled = await btn.isDisabled().catch(() => false);
          if (!disabled) {
            submitBtn = btn;
            console.log(`[Poster] Located active submit button: ${s}`);
            break;
          }
        }
      } catch (e) {}
    }

    if (!submitBtn) {
      submitBtn = await page.$("button:has-text('Comment'), button:has-text('Post')");
    }

    if (!submitBtn) {
      await context.close();
      const err = "Could not locate submit button on LinkedIn.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    console.log("[Poster] Submitting comment...");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    markPostStatus(postId, "POSTED");
    await context.close();
    console.log(`[Poster] 🎉 Comment successfully published to LinkedIn in ${duration}s!`);
    return { success: true, message: `Comment posted to LinkedIn in ${duration}s!` };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    console.error("[Poster] Exception:", err.message);
    markPostStatus(postId, "ERROR", err.message);
    return { success: false, message: err.message };
  }
}

async function publishStandalonePostToLinkedIn(postText) {
  if (!postText || !postText.trim()) {
    return { success: false, message: "Missing post text content" };
  }

  const startTime = Date.now();
  let context;
  try {
    context = await launchPosterContext();
    const page = context.pages().length ? context.pages()[0] : await context.newPage();

    console.log("[Poster] ⚡ Navigating to LinkedIn post composer...");
    await page.goto("https://www.linkedin.com/feed/?shareActive=true", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(async () => {
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "commit", timeout: 15000 });
    });
    await new Promise(r => setTimeout(r, 2000));

    // Check login state
    if (page.url().includes("login") || page.url().includes("authwall")) {
      await context.close();
      return { success: false, message: "LinkedIn session expired. Please run setup_session.js to re-authenticate." };
    }

    // Click "Start a post" if modal is not automatically open
    const trigger = await page.$("button.share-box-feed-entry__trigger, button:has-text('Start a post')");
    if (trigger) {
      await trigger.click().catch(() => {});
      await new Promise(r => setTimeout(r, 1200));
    }

    // Locate rich text editor
    const editor = await page.$("div.ql-editor, div[contenteditable='true'][role='textbox'], div.editor-content");
    if (!editor) {
      await context.close();
      return { success: false, message: "Could not locate LinkedIn post editor box." };
    }

    await editor.click({ force: true }).catch(() => {});
    await new Promise(r => setTimeout(r, 200));
    console.log(`[Poster] ⚡ Inserting standalone post (${postText.length} chars)...`);
    await page.keyboard.insertText(postText);
    await new Promise(r => setTimeout(r, 800));

    // Locate Post button
    const submitBtn = await page.$("button.share-actions__primary-action, button:has-text('Post'):not([disabled])");
    if (!submitBtn) {
      await context.close();
      return { success: false, message: "Could not locate active Post submit button." };
    }

    console.log("[Poster] Clicking Post submit button...");
    await submitBtn.click({ force: true });
    await new Promise(r => setTimeout(r, 3000));

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    await context.close();
    console.log(`[Poster] 🎉 Standalone post successfully published to LinkedIn in ${duration}s!`);
    return { success: true, message: `Post successfully published to LinkedIn in ${duration}s!` };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    console.error("[Poster] Standalone post exception:", err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  postCommentToLinkedin,
  postCommentToLinkedIn: postCommentToLinkedin,
  publishStandalonePostToLinkedIn
};
