const path = require("path");
const { chromium } = require("playwright");
const { markPostStatus } = require("./db");

const SESSION_DIR = path.join(__dirname, "session_data");
const HEADLESS = process.env.HEADLESS_BROWSER !== "false";

async function launchPosterContext() {
  const options = {
    headless: HEADLESS,
    viewport: { width: 1280, height: 800 },
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
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    if (page.url().includes("login") || page.url().includes("authwall")) {
      await context.close();
      const err = "LinkedIn session expired. Please log in again using setup_session.js";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    const commentBtn = await page.$("button[aria-label*='Comment'], button.comment-button, button.artdeco-button--tertiary");
    if (commentBtn) {
      await commentBtn.click().catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }

    // 2026 LinkedIn Tiptap ProseMirror Editor
    let commentBox = await page.$("div.tiptap.ProseMirror, div[aria-label*='Text editor for creating comment'], div[contenteditable='true'][role='textbox'], div.editor-content, div[role='textbox']");
    if (!commentBox) {
      commentBox = await page.$("div[data-placeholder*='comment'], div.ql-editor[role='textbox']");
    }

    if (!commentBox) {
      await context.close();
      const err = "Could not locate comment text area on LinkedIn post.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    await commentBox.click();
    await new Promise(r => setTimeout(r, 500));

    // Natural human jitter typing
    for (const char of commentText) {
      await page.keyboard.type(char);
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 30) + 15));
    }
    await new Promise(r => setTimeout(r, 1000));

    // Locate the active Submit Comment button
    let submitBtn = await page.$("button:has-text('Comment'):not([disabled]):not([aria-label='Comment']), button:has-text('Post'):not([disabled]), button.comments-comment-box__submit-button, button[type='submit'].artdeco-button--primary");
    if (!submitBtn) {
      submitBtn = await page.$("button:has-text('Comment'), button:has-text('Post')");
    }

    if (!submitBtn) {
      await context.close();
      const err = "Could not locate submit button on LinkedIn.";
      markPostStatus(postId, "ERROR", err);
      return { success: false, message: err };
    }

    await submitBtn.click();
    await new Promise(r => setTimeout(r, 4000));

    markPostStatus(postId, "POSTED");
    await context.close();
    return { success: true, message: "Comment successfully posted to LinkedIn!" };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    markPostStatus(postId, "ERROR", err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  postCommentToLinkedin,
  postCommentToLinkedIn: postCommentToLinkedin
};
