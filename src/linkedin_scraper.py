import re
import time
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from playwright.async_api import async_playwright, BrowserContext, Page

from src.config import SESSION_DIR, HEADLESS_BROWSER, SCRAPE_DELAY_SECONDS, load_sources, MAX_POST_AGE_HOURS
from src.database import post_exists, insert_post, init_db
from src.comment_generator import generate_comments_for_post

def is_within_timeframe(time_str: str, max_hours: int = 48) -> bool:
    """
    Parses LinkedIn relative time strings (e.g., '2h', '1d', '2d', 'yesterday', '3d', '1w').
    Returns True if the post is within max_hours (default 48h).
    """
    if not time_str:
        return True # Default to include if undetermined
        
    s = time_str.lower().strip()
    
    # Minutes / Seconds / Just now
    if "just now" in s or "m" in s or "min" in s or "s" in s and not "y" in s:
        # Match '10m', '45 min'
        if re.search(r"^\d+\s*(m|min|s)", s):
            return True
            
    # Hours
    h_match = re.search(r"(\d+)\s*(h|hr|hour)", s)
    if h_match:
        hours = int(h_match.group(1))
        return hours <= max_hours
        
    # Days
    d_match = re.search(r"(\d+)\s*(d|day)", s)
    if d_match:
        days = int(d_match.group(1))
        return (days * 24) <= max_hours
        
    if "yesterday" in s:
        return True
        
    # Weeks, Months, Years -> Exceeds 48 hours
    if any(w in s for w in ["w", "wk", "week", "mo", "month", "yr", "year"]):
        return False
        
    return True

async def extract_posts_from_page(page: Page, source: dict, max_posts: int = 5) -> List[Dict]:
    posts_data = []
    
    # Scroll slightly to trigger lazy-loaded posts
    for _ in range(3):
        await page.mouse.wheel(0, 800)
        await asyncio.sleep(1.5)
        
    # Find all post feed cards
    post_elements = await page.query_selector_all("div.feed-shared-update-v2, div[data-urn*='urn:li:activity'], div.update-components-actor")
    
    # Alternate selector for activity feed
    if not post_elements:
        post_elements = await page.query_selector_all("div[data-urn]")
        
    for elem in post_elements[:max_posts * 2]:
        try:
            # Click "...see more" if present to expand full text
            see_more_button = await elem.query_selector("button.feed-shared-inline-show-more-text__see-more-less-toggle, button.see-more")
            if see_more_button:
                try:
                    await see_more_button.click(timeout=1000)
                    await asyncio.sleep(0.3)
                except Exception:
                    pass

            # Extract post text
            text_elem = await elem.query_selector(".feed-shared-update-v2__description, .feed-shared-text, .update-components-text, .break-words")
            post_text = await text_elem.inner_text() if text_elem else ""
            post_text = post_text.strip()
            
            if not post_text or len(post_text) < 30:
                continue

            # Extract author name
            author_elem = await elem.query_selector(".update-components-actor__name, .feed-shared-actor__name, span[aria-hidden='true']")
            author_name = await author_elem.inner_text() if author_elem else source.get("name", "LinkedIn Source")
            author_name = author_name.split("\n")[0].strip()

            # Extract relative timestamp
            time_elem = await elem.query_selector(".update-components-actor__sub-description, .feed-shared-actor__sub-description, time, span.visually-hidden")
            time_text = await time_elem.inner_text() if time_elem else "1d"
            time_text = time_text.split("•")[0].strip()

            # Check 48-hour limit
            if not is_within_timeframe(time_text, MAX_POST_AGE_HOURS):
                continue

            # Extract post URL
            link_elem = await elem.query_selector("a[href*='/feed/update/urn:li:activity:'], a[href*='/activity/'], a.app-aware-link")
            post_url = ""
            if link_elem:
                href = await link_elem.get_attribute("href")
                if href:
                    post_url = href.split("?")[0]
                    if not post_url.startswith("http"):
                        post_url = "https://www.linkedin.com" + post_url
            
            if not post_url:
                # Generate unique synthetic key if URL not directly exposed
                post_url = f"{source.get('url')}#post_{hash(post_text[:100])}"

            # Check if already processed
            if post_exists(post_url):
                continue

            posts_data.append({
                "source_id": source.get("id", "source"),
                "source_name": source.get("name", author_name),
                "source_category": source.get("category", "Lending"),
                "author_name": author_name,
                "author_headline": source.get("category", ""),
                "post_url": post_url,
                "post_text": post_text,
                "published_relative": time_text
            })
            
            if len(posts_data) >= max_posts:
                break
                
        except Exception as e:
            continue
            
    return posts_data

async def run_scraper(selected_source_ids: Optional[List[str]] = None, max_posts_per_source: int = 3, progress_callback=None):
    """
    Scrapes posts from specified sources or all active sources.
    """
    init_db()
    sources = load_sources()
    
    if selected_source_ids:
        active_sources = [s for s in sources if s.get("id") in selected_source_ids]
    else:
        active_sources = [s for s in sources if s.get("active", True)]
        
    total_sources = len(active_sources)
    scraped_new_posts = 0
    
    async with async_playwright() as p:
        # Launch persistent browser context
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(SESSION_DIR),
            headless=HEADLESS_BROWSER,
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.pages[0] if context.pages else await context.new_page()
        
        for idx, src in enumerate(active_sources):
            try:
                if progress_callback:
                    progress_callback(idx + 1, total_sources, src.get("name"))
                    
                target_url = src.get("url")
                await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(SCRAPE_DELAY_SECONDS)
                
                # Check if redirected to login page
                if "login" in page.url or "authwall" in page.url:
                    print(f"Session not logged in or authwall detected at {target_url}. Please run setup_session.py.")
                    break

                posts = await extract_posts_from_page(page, src, max_posts=max_posts_per_source)
                
                for p_data in posts:
                    # Generate AI comments
                    comments = generate_comments_for_post(
                        p_data["post_text"], 
                        p_data["author_name"], 
                        p_data["source_category"]
                    )
                    
                    insert_post(
                        source_id=p_data["source_id"],
                        source_name=p_data["source_name"],
                        source_category=p_data["source_category"],
                        author_name=p_data["author_name"],
                        author_headline=p_data["author_headline"],
                        post_url=p_data["post_url"],
                        post_text=p_data["post_text"],
                        published_relative=p_data["published_relative"],
                        generated_comments=comments
                    )
                    scraped_new_posts += 1
                    
            except Exception as e:
                print(f"Error scraping {src.get('name')}: {e}")
                continue
                
        await context.close()
        
    return scraped_new_posts
