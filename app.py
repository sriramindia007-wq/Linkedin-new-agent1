import streamlit as st
import asyncio
import pandas as pd
from datetime import datetime

from src.config import load_sources, save_sources, load_persona, save_persona, GEMINI_API_KEY
from src.database import get_posts, approve_comment, mark_post_status, get_stats, init_db, update_generated_comments
from src.comment_generator import generate_comments_for_post
from src.linkedin_scraper import run_scraper
from src.linkedin_poster import post_comment_to_linkedin

st.set_page_config(
    page_title="LinkedIn Lending Intelligence & Comment Agent",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded"
)

init_db()

# Custom CSS for styling
st.markdown("""
<style>
    .metric-card {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        border-left: 4px solid #0077b5;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .post-card {
        background: #ffffff;
        border-radius: 10px;
        border: 1px solid #e0e0e0;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .source-badge {
        background: #e1f0fa;
        color: #0077b5;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
    }
    .time-badge {
        background: #eef2f6;
        color: #555;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
    }
</style>
""", unsafe_allow_html=True)

# ----------------- SIDEBAR -----------------
with st.sidebar:
    st.image("https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png", width=45)
    st.title("Lending Intelligence")
    st.caption("Targeted MSME & Digital Lending Comment Engine")
    
    st.markdown("---")
    stats = get_stats()
    c1, c2 = st.columns(2)
    c1.metric("Pending Review", stats.get("PENDING", 0))
    c2.metric("Approved", stats.get("APPROVED", 0))
    c3, c4 = st.columns(2)
    c3.metric("Posted", stats.get("POSTED", 0))
    c4.metric("Total Scraped", stats.get("TOTAL", 0))
    
    st.markdown("---")
    st.subheader("⚡ Scraper Actions")
    
    sources = load_sources()
    categories = sorted(list(set(s.get("category", "General") for s in sources)))
    selected_cat = st.selectbox("Select Target Domain", ["ALL"] + categories)
    
    if st.button("🚀 Scrape Recent Posts (<48h)", type="primary", use_container_width=True):
        with st.spinner("Scraping target LinkedIn sources & generating AI comments..."):
            filter_ids = None
            if selected_cat != "ALL":
                filter_ids = [s["id"] for s in sources if s.get("category") == selected_cat]
            
            try:
                scraped_count = asyncio.run(run_scraper(selected_source_ids=filter_ids, max_posts_per_source=2))
                st.success(f"✅ Scraping completed! Found {scraped_count} new posts.")
                st.rerun()
            except Exception as e:
                st.error(f"Scraping error: {e}")
                
    st.markdown("---")
    st.info("💡 **Tip**: Make sure you have logged in once via `python setup_session.py` to persist cookies.")

# ----------------- MAIN TABS -----------------
tab_review, tab_approved, tab_history, tab_sources, tab_persona = st.tabs([
    "📥 Review & Approve", 
    "✅ Queued for Posting", 
    "📜 Posted History", 
    "🎯 Monitored Sources (40)", 
    "⚙️ Persona & Rules"
])

# ================= TAB 1: REVIEW & APPROVE =================
with tab_review:
    st.subheader("Pending LinkedIn Posts (Last 48 Hours)")
    
    filter_col1, filter_col2, filter_col3 = st.columns([2, 2, 3])
    with filter_col1:
        cat_filter = st.selectbox("Filter Category", ["ALL"] + categories, key="review_cat_filter")
    with filter_col2:
        search_query = st.text_input("Search keywords / author", "", key="review_search")
        
    posts = get_posts(status="PENDING", category=cat_filter, search=search_query, limit=50)
    
    if not posts:
        st.info("🎉 No pending posts requiring review! Click **'Scrape Recent Posts'** in the sidebar to fetch the latest 48h posts.")
    else:
        st.write(f"Showing **{len(posts)}** pending posts for approval:")
        
        for post in posts:
            with st.container():
                st.markdown(f"""
                <div class="post-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong>{post['author_name']}</strong> 
                            <span style="color: #666; font-size: 0.9em;">({post['source_name']})</span>
                        </div>
                        <div>
                            <span class="source-badge">{post['source_category']}</span>
                            <span class="time-badge">🕒 {post['published_relative']}</span>
                        </div>
                    </div>
                    <div style="background: #fafafa; padding: 12px; border-radius: 6px; font-size: 0.95em; line-height: 1.5; margin-bottom: 15px; border-left: 3px solid #0077b5;">
                        {post['post_text']}
                    </div>
                </div>
                """, unsafe_allow_html=True)
                
                # Check / regenerate comments if missing
                generated = post.get("generated_comments") or {}
                if not generated:
                    generated = generate_comments_for_post(post["post_text"], post["author_name"], post["source_category"])
                    update_generated_comments(post["id"], generated)

                # Comment Selection Options
                style_options = {
                    "💡 Insightful Value-Add": generated.get("value_add", ""),
                    "❓ Thought-Provoking Question": generated.get("provocative_question", ""),
                    "📊 Strategic Synthesis": generated.get("executive_perspective", "")
                }
                
                col_opt, col_act = st.columns([3, 1])
                
                with col_opt:
                    chosen_style_label = st.radio(
                        "Select AI Comment Style:",
                        list(style_options.keys()),
                        key=f"style_radio_{post['id']}"
                    )
                    default_text = style_options[chosen_style_label]
                    
                    edited_comment = st.text_area(
                        "Edit Comment before approval:",
                        value=default_text,
                        height=100,
                        key=f"comment_text_{post['id']}"
                    )
                    
                with col_act:
                    st.write("**Actions**")
                    if post.get("post_url") and post["post_url"].startswith("http"):
                        st.markdown(f"[🔗 Open on LinkedIn]({post['post_url']})")
                        
                    # Action 1: Approve & Post Immediately
                    if st.button("🚀 Approve & Post", key=f"post_now_{post['id']}", type="primary", use_container_width=True):
                        approve_comment(post["id"], chosen_style_label, edited_comment)
                        with st.spinner("Posting comment to LinkedIn..."):
                            success, msg = asyncio.run(post_comment_to_linkedin(post["id"], post["post_url"], edited_comment))
                            if success:
                                st.success(msg)
                                st.rerun()
                            else:
                                st.error(msg)
                                
                    # Action 2: Approve for Queue
                    if st.button("⏳ Approve to Queue", key=f"queue_{post['id']}", use_container_width=True):
                        approve_comment(post["id"], chosen_style_label, edited_comment)
                        st.success("Added to Queued Posts!")
                        st.rerun()
                        
                    # Action 3: Dismiss
                    if st.button("❌ Dismiss", key=f"dismiss_{post['id']}", use_container_width=True):
                        mark_post_status(post["id"], "REJECTED")
                        st.rerun()
                        
                st.markdown("---")

# ================= TAB 2: QUEUED FOR POSTING =================
with tab_approved:
    st.subheader("Approved Posts Ready to Publish")
    approved_posts = get_posts(status="APPROVED")
    
    if not approved_posts:
        st.info("No approved posts in queue. Approve posts from the 'Review & Approve' tab.")
    else:
        st.write(f"**{len(approved_posts)}** posts ready to post.")
        
        if st.button("🚀 Publish All Queued Posts Now", type="primary"):
            progress = st.progress(0)
            status_text = st.empty()
            
            for idx, p in enumerate(approved_posts):
                status_text.text(f"Posting {idx+1}/{len(approved_posts)}: {p['author_name']}...")
                success, msg = asyncio.run(post_comment_to_linkedin(p["id"], p["post_url"], p["approved_comment"]))
                progress.progress((idx + 1) / len(approved_posts))
                
            status_text.text("Batch posting completed!")
            st.rerun()
            
        for p in approved_posts:
            with st.expander(f"📌 {p['author_name']} ({p['source_category']}) - {p.get('published_relative', '')}"):
                st.markdown(f"**Original Post:** {p['post_text'][:250]}...")
                st.markdown(f"**Approved Comment:**")
                st.success(p.get("approved_comment", ""))
                if st.button(f"Post This Now", key=f"post_queued_{p['id']}"):
                    with st.spinner("Posting..."):
                        success, msg = asyncio.run(post_comment_to_linkedin(p["id"], p["post_url"], p["approved_comment"]))
                        if success:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)

# ================= TAB 3: POSTED HISTORY =================
with tab_history:
    st.subheader("Posted Comments History")
    posted_posts = get_posts(status="POSTED", limit=100)
    
    if not posted_posts:
        st.info("No comments posted yet.")
    else:
        df = pd.DataFrame([{
            "Author / Source": f"{p['author_name']} ({p['source_name']})",
            "Category": p["source_category"],
            "Posted Comment": p.get("approved_comment", ""),
            "Published At": p.get("posted_at", ""),
            "Post Link": p.get("post_url", "")
        } for p in posted_posts])
        st.dataframe(df, use_container_width=True)

# ================= TAB 4: MONITORED SOURCES =================
with tab_sources:
    st.subheader("Monitored LinkedIn Targets (40 Sources)")
    st.caption("Organized across MSME Lending, Digital Lending, M2P Competitors, AI Underwriting, and Leading Banks.")
    
    sources = load_sources()
    df_src = pd.DataFrame(sources)
    st.dataframe(df_src, use_container_width=True)
    
    with st.expander("➕ Add New LinkedIn Target Source"):
        with st.form("new_source_form"):
            c1, c2 = st.columns(2)
            new_id = c1.text_input("Source Identifier (slug, e.g. perfios-india)")
            new_name = c2.text_input("Company / Leader Name")
            new_cat = c1.selectbox("Category", categories + ["Other"])
            new_url = c2.text_input("LinkedIn Posts / Activity URL")
            new_type = c1.selectbox("Type", ["company", "person"])
            
            if st.form_submit_button("Add Target Source"):
                if new_id and new_name and new_url:
                    sources.append({
                        "id": new_id,
                        "name": new_name,
                        "category": new_cat,
                        "type": new_type,
                        "url": new_url,
                        "active": True
                    })
                    save_sources(sources)
                    st.success(f"Added {new_name} to monitored sources!")
                    st.rerun()

# ================= TAB 5: PERSONA & RULES =================
with tab_persona:
    st.subheader("Persona & Lending Thought Leadership Settings")
    persona = load_persona()
    
    with st.form("persona_form"):
        p_name = st.text_input("Your Professional Title / Persona Name", persona.get("user_name", ""))
        p_headline = st.text_input("LinkedIn Headline / Positioning", persona.get("linkedin_headline", ""))
        
        focus_areas_str = "\n".join(persona.get("focus_areas", []))
        p_focus = st.text_area("Core Domain Focus Areas (one per line)", value=focus_areas_str, height=150)
        
        rules_str = "\n".join(persona.get("tone_guidelines", {}).get("rules", []))
        p_rules = st.text_area("Tone & Guardrail Rules (one per line)", value=rules_str, height=150)
        
        if st.form_submit_button("💾 Save Persona Settings"):
            persona["user_name"] = p_name
            persona["linkedin_headline"] = p_headline
            persona["focus_areas"] = [f.strip() for f in p_focus.split("\n") if f.strip()]
            persona.setdefault("tone_guidelines", {})["rules"] = [r.strip() for r in p_rules.split("\n") if r.strip()]
            save_persona(persona)
            st.success("Persona configuration saved!")
