import sqlite3
import json
from datetime import datetime
from src.config import DB_PATH

def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT,
            source_name TEXT,
            source_category TEXT,
            author_name TEXT,
            author_headline TEXT,
            post_url TEXT UNIQUE,
            post_text TEXT,
            published_relative TEXT,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'PENDING',
            generated_comments TEXT,
            selected_style TEXT,
            approved_comment TEXT,
            posted_at TIMESTAMP,
            error_message TEXT
        )
    """)
    conn.commit()
    conn.close()

def post_exists(post_url: str) -> bool:
    if not post_url:
        return False
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM posts WHERE post_url = ?", (post_url,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def insert_post(source_id, source_name, source_category, author_name, author_headline, post_url, post_text, published_relative, generated_comments=None):
    if post_exists(post_url):
        return None
    
    comments_json = json.dumps(generated_comments) if generated_comments else None
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO posts (
            source_id, source_name, source_category, author_name, author_headline,
            post_url, post_text, published_relative, generated_comments, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    """, (source_id, source_name, source_category, author_name, author_headline, post_url, post_text, published_relative, comments_json))
    
    post_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return post_id

def update_generated_comments(post_id: int, comments: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE posts SET generated_comments = ? WHERE id = ?", (json.dumps(comments), post_id))
    conn.commit()
    conn.close()

def approve_comment(post_id: int, selected_style: str, approved_text: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE posts 
        SET status = 'APPROVED', selected_style = ?, approved_comment = ?
        WHERE id = ?", (selected_style, approved_text, post_id))
    """, (selected_style, approved_text, post_id))
    conn.commit()
    conn.close()

def mark_post_status(post_id: int, status: str, error: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    posted_at = datetime.now().isoformat() if status == "POSTED" else None
    cursor.execute("""
        UPDATE posts 
        SET status = ?, posted_at = COALESCE(?, posted_at), error_message = ?
        WHERE id = ?
    """, (status, posted_at, error, post_id))
    conn.commit()
    conn.close()

def get_posts(status: str = None, category: str = None, search: str = None, limit: int = 100):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM posts WHERE 1=1"
    params = []
    
    if status and status != "ALL":
        query += " AND status = ?"
        params.append(status)
        
    if category and category != "ALL":
        query += " AND source_category = ?"
        params.append(category)
        
    if search:
        query += " AND (post_text LIKE ? OR author_name LIKE ? OR source_name LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])
        
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        if d.get("generated_comments"):
            try:
                d["generated_comments"] = json.loads(d["generated_comments"])
            except Exception:
                d["generated_comments"] = {}
        result.append(d)
    return result

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status, COUNT(*) as count FROM posts GROUP BY status")
    rows = cursor.fetchall()
    conn.close()
    
    stats = {"PENDING": 0, "APPROVED": 0, "POSTED": 0, "REJECTED": 0, "TOTAL": 0}
    for r in rows:
        st = r["status"]
        cnt = r["count"]
        stats[st] = cnt
        stats["TOTAL"] += cnt
    return stats

init_db()
