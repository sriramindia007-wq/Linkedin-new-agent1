import asyncio
import random
from typing import Dict, Tuple
from playwright.async_api import async_playwright
from src.config import SESSION_DIR, HEADLESS_BROWSER
from src.database import mark_post_status

async def type_naturally(page, element, text: str):
    """Types characters with natural human-like jitter delays."""
    await element.click()
    await asyncio.sleep(0.5)
    for char in text:
        await page.keyboard.type(char)
        await asyncio.sleep(random.uniform(0.02, 0.06))
    await asyncio.sleep(0.8)

async def post_comment_to_linkedin(post_id: int, post_url: str, comment_text: str) -> Tuple[bool, str]:
    """
    Automates commenting on a specific LinkedIn post.
    """
    if not post_url or not comment_text:
        return False, "Missing post URL or comment text"
        
    try:
        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=str(SESSION_DIR),
                headless=HEADLESS_BROWSER,
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.pages[0] if context.pages else await context.new_page()
            
            # Navigate to post
            await page.goto(post_url, wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(random.uniform(2.5, 4.0))
            
            # Check login
            if "login" in page.url or "authwall" in page.url:
                await context.close()
                err = "LinkedIn session expired or not logged in. Please run setup_session.py"
                mark_post_status(post_id, "ERROR", error=err)
                return False, err
                
            # Locate comment action button if comment box is collapsed
            comment_btn = await page.query_selector("button[aria-label*='Comment'], button.comment-button, button.artdeco-button--tertiary")
            if comment_btn:
                try:
                    await comment_btn.click()
                    await asyncio.sleep(1.0)
                except Exception:
                    pass
                    
            # Locate comment text box
            comment_box = await page.query_selector("div.editor-content, div.ql-editor[role='textbox'], div[aria-label*='Add a comment'], div[role='textbox']")
            if not comment_box:
                # Try fallback selector
                comment_box = await page.query_selector("div[data-placeholder*='comment']")
                
            if not comment_box:
                await context.close()
                err = "Could not locate comment text area on LinkedIn post."
                mark_post_status(post_id, "ERROR", error=err)
                return False, err
                
            # Type comment naturally
            await type_naturally(page, comment_box, comment_text)
            
            # Locate Submit Button
            submit_btn = await page.query_selector("button.comments-comment-box__submit-button, button[type='submit'].artdeco-button--primary, button.comments-comment-box__submit-button--cr")
            if not submit_btn:
                # Try finding button by text
                submit_btn = await page.query_selector("button:has-text('Comment'), button:has-text('Post')")
                
            if not submit_btn:
                await context.close()
                err = "Could not locate submit button."
                mark_post_status(post_id, "ERROR", error=err)
                return False, err
                
            # Click submit
            await submit_btn.click()
            await asyncio.sleep(random.uniform(2.0, 3.5))
            
            # Mark success in database
            mark_post_status(post_id, "POSTED")
            await context.close()
            return True, "Comment successfully posted to LinkedIn!"
            
    except Exception as e:
        err = f"Failed to post comment: {str(e)}"
        mark_post_status(post_id, "ERROR", error=err)
        return False, err
