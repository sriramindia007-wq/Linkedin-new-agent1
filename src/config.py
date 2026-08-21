import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Base Paths
SRC_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SRC_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
SESSION_DIR = PROJECT_DIR / "session_data"

# Create directories if needed
DATA_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DIR.mkdir(parents=True, exist_ok=True)

# Files
SOURCES_FILE = DATA_DIR / "sources.json"
PERSONA_FILE = DATA_DIR / "persona.json"
DB_PATH = DATA_DIR / "posts.db"
ENV_FILE = PROJECT_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

# API Keys & Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MAX_POST_AGE_HOURS = int(os.getenv("MAX_POST_AGE_HOURS", "48"))
HEADLESS_BROWSER = os.getenv("HEADLESS_BROWSER", "true").lower() == "true"
SCRAPE_DELAY_SECONDS = float(os.getenv("SCRAPE_DELAY_SECONDS", "3.0"))

def load_sources():
    if SOURCES_FILE.exists():
        with open(SOURCES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_sources(sources):
    with open(SOURCES_FILE, "w", encoding="utf-8") as f:
        json.dump(sources, f, indent=2)

def load_persona():
    if PERSONA_FILE.exists():
        with open(PERSONA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "user_name": "Lending Leader",
        "focus_areas": ["MSME Lending", "Digital LOS", "Underwriting"],
        "tone_guidelines": {"style": "Insightful, analytical, professional"}
    }

def save_persona(persona):
    with open(PERSONA_FILE, "w", encoding="utf-8") as f:
        json.dump(persona, f, indent=2)
