const path = require("path");
const { chromium } = require("playwright");
const { markPostStatus } = require("./db");

const SESSION_DIR = path.join(__dirname, "session_data");
const HEADLESS = process.env.HEADLESS_BROWSER !== "false";

async function launchPosterContext() {
  const options = {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };
  try {
    return await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "chrome" });
  } catch (e) {
    try {
      return await chromium.launchPersistentContext(SESSION_DIR, { ...options, channel: "msedge" });
    } catch (e2) {
      return await chromium.launchPersistentContext(SESSION_DIR, options);
    }
  }
}

async function postCommentToLinkedin(postId, postUrl, commentText) {
  if (!postUrl || !commentText) {
    return { success: false, message: "Missing post URL or comment text" };
  }

  let context;
  try {
    context = await launchPosterContext();
    const page = context.pages().length ? context.pages()[0] : await context.newPage();

    console.log(`[Poster] Navigating to ${postUrl}...`);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(r => setTimeout(r, 3500));

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
    await page.evaluate(() => window.scrollBy(0, 450));
    await new Promise(r => setTimeout(r, 1200));

    // Try clicking the comment action button to reveal input if collapsed
    try {
      const commentBtn = await page.$("button[aria-label*='Comment'], button.comment-button, button.artdeco-button--tertiary, button:has-text('Comment')");
      if (commentBtn) {
        await commentBtn.click().catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
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

    // Focus and click the editor
    await commentBox.click({ force: true }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // Type comment text with natural human jitter
    console.log(`[Poster] Typing executive comment (${commentText.length} chars)...`);
    for (const char of commentText) {
      await page.keyboard.type(char);
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 25) + 15));
    }
    await new Promise(r => setTimeout(r, 1500));

    // Locate the active Submit Comment button
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
            console.log(`[Poster] Located active submit button via selector: ${s}`);
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
    await submitBtn.click({ force: true });
    await new Promise(r => setTimeout(r, 5000));

    markPostStatus(postId, "POSTED");
    await context.close();
    console.log("[Poster] 🎉 Comment successfully published to LinkedIn!");
    return { success: true, message: "Comment successfully posted to LinkedIn!" };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    console.error("[Poster] Exception:", err.message);
    markPostStatus(postId, "ERROR", err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  postCommentToLinkedin,
  postCommentToLinkedIn: postCommentToLinkedin
};
