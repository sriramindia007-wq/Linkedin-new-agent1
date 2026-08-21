import argparse
import asyncio
from src.linkedin_scraper import run_scraper
from src.database import get_stats

def main():
    parser = argparse.ArgumentParser(description="LinkedIn Lending Intelligence Scraper & Comment Pipeline")
    parser.add_argument("--sources", type=str, default="all", help="Comma-separated source IDs or 'all'")
    parser.add_argument("--max-posts", type=int, default=2, help="Max posts to scrape per source (<48h)")
    args = parser.parse_args()

    source_ids = None if args.sources.lower() == "all" else [s.strip() for s in args.sources.split(",")]
    
    print("=================================================================")
    print("🚀 STARTING LINKEDIN SCRAPER & COMMENT GENERATOR")
    print(f"Targeting: {args.sources} | Max posts per target: {args.max_posts}")
    print("=================================================================\n")
    
    def on_progress(current, total, name):
        print(f"[{current}/{total}] Scraping source: {name}...")

    new_posts = asyncio.run(run_scraper(
        selected_source_ids=source_ids,
        max_posts_per_source=args.max_posts,
        progress_callback=on_progress
    ))
    
    print("\n=================================================================")
    print(f"✅ Scraping completed! Extracted and generated AI comments for {new_posts} new posts.")
    stats = get_stats()
    print(f"📊 Current Database Stats: {stats}")
    print("👉 Open the dashboard with: streamlit run app.py")
    print("=================================================================")

if __name__ == "__main__":
    main()
