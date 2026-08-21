import pytest
from src.linkedin_scraper import is_within_timeframe
from src.comment_generator import generate_comments_for_post
from src.database import insert_post, get_posts, post_exists, approve_comment, mark_post_status, init_db

def test_relative_timeframe_48h():
    # Valid (<48h)
    assert is_within_timeframe("10m") is True
    assert is_within_timeframe("45 min") is True
    assert is_within_timeframe("1h") is True
    assert is_within_timeframe("23h") is True
    assert is_within_timeframe("1d") is True
    assert is_within_timeframe("2d") is True
    assert is_within_timeframe("yesterday") is True
    assert is_within_timeframe("just now") is True
    
    # Invalid (>=48h)
    assert is_within_timeframe("3d") is False
    assert is_within_timeframe("5d") is False
    assert is_within_timeframe("1w") is False
    assert is_within_timeframe("2w") is False
    assert is_within_timeframe("1mo") is False
    assert is_within_timeframe("1yr") is False

def test_comment_generation():
    post_text = "We are transforming MSME credit through cashflow underwriting and automated GST analysis for faster loan approvals."
    comments = generate_comments_for_post(post_text, "Lending Leader", "MSME & Digital Lending NBFCs")
    
    assert "value_add" in comments
    assert "provocative_question" in comments
    assert "executive_perspective" in comments
    assert len(comments["value_add"]) > 20
    assert len(comments["provocative_question"]) > 20

def test_database_lifecycle():
    init_db()
    test_url = "https://www.linkedin.com/feed/update/urn:li:activity:9999999999/"
    
    # Insert
    post_id = insert_post(
        source_id="test-perfios",
        source_name="Perfios",
        source_category="M2P LOS Competitors",
        author_name="Test Author",
        author_headline="VP Lending",
        post_url=test_url,
        post_text="Sample loan origination system post discussing STP and co-lending.",
        published_relative="4h",
        generated_comments={"value_add": "Great LOS perspective."}
    )
    
    assert post_exists(test_url) is True
    
    # Approve
    approve_comment(post_id, "💡 Insightful Value-Add", "Approved test comment")
    approved = get_posts(status="APPROVED")
    assert any(p["id"] == post_id for p in approved)
    
    # Mark posted
    mark_post_status(post_id, "POSTED")
    posted = get_posts(status="POSTED")
    assert any(p["id"] == post_id for p in posted)
