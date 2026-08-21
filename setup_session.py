import asyncio
from playwright.async_api import async_playwright
from src.config import SESSION_DIR

async def setup_linkedin_session():
    print("=================================================================")
    print("🔐 LINKEDIN PERSISTENT SESSION SETUP")
    print("=================================================================")
    print(f"Session data will be stored securely at:\n{SESSION_DIR}\n")
    print("Opening browser... Please log in to LinkedIn in the browser window.")
    print("Once you are on your LinkedIn Feed, return to this terminal and press ENTER.")
    print("=================================================================\n")
    
    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(SESSION_DIR),
            headless=False,
            viewport={"width": 1280, "height": 850}
        )
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
        
        # Keep waiting until user inputs or navigates to feed
        input("👉 Press ENTER here after you have successfully logged in to LinkedIn...")
        
        print("✅ Session cookies saved successfully! You can now use automated scraping & posting.")
        await context.close()

if __name__ == "__main__":
    asyncio.run(setup_linkedin_session())
