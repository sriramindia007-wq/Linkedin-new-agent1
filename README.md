# 💼 LinkedIn Lending Intelligence & AI Comment Automation Agent

An automated pipeline designed to monitor **40 targeted sources** across the lending and loan origination system (LOS) ecosystem:
- **M2P LOS Competitors & Platforms** (Perfios, Pennant, Finflux, Nucleus, Lentra, Decimal, etc.)
- **MSME & Digital Lending NBFCs** (Lendingkart, NeoGrowth, Aye Finance, Kinara Capital, InCred, Ugro, etc.)
- **AI Underwriting & Credit Risk Tech** (ScoreData, Arya.ai, Jocata, Tartan, HyperVerge, Karza, etc.)
- **Leading Banks & Regulators** (HDFC Bank, ICICI Bank, Axis Bank, RBI Innovation Hub, etc.)
- **Industry Thought Leaders**

---

## ⚡ Key Features

1. **Strict 48-Hour Filter**: Only extracts posts published in the last 48 hours.
2. **Lending Domain AI Persona**: Uses Gemini API calibrated for credit underwriting, MSME cashflow, co-lending, and LOS workflows.
3. **3 Custom Comment Styles per Post**:
   - 💡 **Insightful Value-Add**
   - ❓ **Thought-Provoking Question**
   - 📊 **Executive / Strategic Synthesis**
4. **Interactive Streamlit Dashboard**: Review, edit, select styles, and approve comments in real time.
5. **Safe Automated Posting**: Human-like keystroke delays and persistent session storage.

---

## 🚀 Quick Setup & Usage

### 1. Install Dependencies
```bash
cd linkedin_lending_agent
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` and add your Gemini API Key:
```bash
copy .env.example .env
```

### 3. One-Time LinkedIn Login
Run the setup script to open a browser window and save your persistent session cookies:
```bash
python setup_session.py
```

### 4. Launch the Approval Dashboard
```bash
streamlit run app.py
```

### 5. (Optional) Run CLI Scraper Pipeline
```bash
python run_pipeline.py --sources all --max-posts 2
```
