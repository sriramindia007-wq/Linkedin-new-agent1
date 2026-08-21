import json
import re
from src.config import GEMINI_API_KEY, load_persona

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    try:
        import google.generativeai as genai_legacy
        HAS_GENAI_LEGACY = True
        HAS_GENAI = False
    except ImportError:
        HAS_GENAI = False
        HAS_GENAI_LEGACY = False

def build_prompt(post_text: str, author_name: str, source_category: str, persona: dict) -> str:
    user_name = persona.get("user_name", "Sriram Ganesan")
    headline = persona.get("linkedin_headline", "Head - LOS Product & Product Solutions | M2P Fintech")
    company = persona.get("company", "M2P Fintech")
    philosophy = persona.get("core_philosophy", "Technology should empower lenders—not replace their judgment.")
    focus_areas = ", ".join(persona.get("focus_areas", []))
    rules = "\n".join([f"- {r}" for r in persona.get("tone_guidelines", {}).get("rules", [])])
    
    prompt = f"""
You are {user_name}, {headline} at {company}.
Core Philosophy: "{philosophy}"
Domain Focus & Expertise: {focus_areas}

Voice & Quality Guardrails:
{rules}
- Return exactly 3 distinct comment styles based on the post.
- Keep each comment concise, substantive, and impactful (2 to 4 sentences max).
- Speak with the authority of an enterprise LOS product leader and governance strategist who collaborates daily with Banks, NBFCs, and MFIs.
- NEVER use generic filler phrases like "Great insights!", "Thanks for sharing!", or "Totally agree".
- Speak directly to credit policy configuration, BRE, workflow orchestration, risk governance, regulatory compliance (RBI guidelines, ULI, AA), or multi-asset origination realities.

Context of the LinkedIn post:
- Source / Category: {source_category}
- Author / Company: {author_name}
- Post Content:
\"\"\"{post_text}\"\"\"

Generate a JSON response with the following exact keys:
{{
  "value_add": "<Practitioner's operational nuance on LOS architecture, BRE configurability, data pipelines (AA/GST/ULI), or workflow automation>",
  "provocative_question": "<Thoughtful governance & risk question on credit policy edge cases, AI explainability, or regulatory compliance>",
  "executive_perspective": "<Strategic & institutional perspective connecting innovation to governance, resilience, and scalable lending>"
}}

Respond ONLY with valid JSON.
"""
    return prompt

def generate_heuristic_comments(post_text: str, author_name: str, source_category: str) -> dict:
    """Fallback generator calibrated for Sriram Ganesan's persona."""
    text_lower = (post_text or "").lower()
    
    if "msme" in text_lower or "sme" in text_lower or "gst" in text_lower or "cashflow" in text_lower:
        return {
            "value_add": "The operational challenge in scaling MSME lending isn't just data availability—it is orchestrating real-time GST, banking, and tax telemetry within a configurable Business Rules Engine (BRE). An agile LOS must enable risk teams to adapt cashflow decisioning rules without relying on multi-week engineering release cycles.",
            "provocative_question": "As lenders increasingly shift from collateralized to cashflow-based underwriting, how are credit committees balancing automated scorecards with human underwriter judgment for boundary cases?",
            "executive_perspective": "Bridging the MSME credit gap requires platforms that empower underwriters with decision intelligence rather than rigid black-box automation, preserving institutional credit governance while shrinking turnaround times."
        }
    elif "co-lending" in text_lower or "bank" in text_lower or "nbfc" in text_lower or "partnership" in text_lower:
        return {
            "value_add": "In institutional co-lending, the primary friction point is rarely capital allocation; it is synchronizing disparate credit policies, real-time escrow reconciliation, and tripartite data flows between bank core banking systems and NBFC origination stacks.",
            "provocative_question": "How are participating lenders architecting their LOS workflows to maintain strict compliance with FLDG risk caps while ensuring sub-24 hour STP disbursement cycles?",
            "executive_perspective": "Sustainable co-lending success hinges on configurable lending infrastructure that provides transparent audit trails, shared risk visibility, and automated compliance for both partner institutions."
        }
    elif "uli" in text_lower or "account aggregator" in text_lower or "rbi" in text_lower or "governance" in text_lower or "regulatory" in text_lower:
        return {
            "value_add": "Initiatives like ULI and Account Aggregator represent a generational shift in credit democratization. The key for financial institutions is ensuring their LOS can ingest diverse alternate data feeds seamlessly while maintaining strict consent governance and RBI DLG compliance.",
            "provocative_question": "As regulatory scrutiny on digital lending algorithms and data governance increases, what mechanisms are institutions establishing to ensure AI model explainability at the board level?",
            "executive_perspective": "Effective governance and technology innovation must move in lockstep; enterprise lending platforms must be built with regulatory agility and auditability at their very foundation."
        }
    elif "ai" in text_lower or "underwriting" in text_lower or "machine learning" in text_lower or "automation" in text_lower:
        return {
            "value_add": "Technology in lending should empower underwriters, not replace their judgment. Leveraging AI for Intelligent Document Processing (IDP) and early fraud detection frees risk officers to focus on nuanced credit assessment rather than manual data entry.",
            "provocative_question": "What frameworks are lenders implementing to monitor concept drift and maintain robust bias guardrails across machine learning credit models in volatile macroeconomic cycles?",
            "executive_perspective": "The future of enterprise underwriting lies in hybrid intelligence—pairing automated rule orchestration with informed credit judgment governed by the institution's risk appetite."
        }
    else:
        return {
            "value_add": "From an enterprise LOS perspective, true lending modernization requires configurable workflows and modular API architecture that can support multi-asset origination across retail, MSME, and commercial portfolios seamlessly.",
            "provocative_question": "How are product and risk leaders measuring the impact of digital journey optimization on first-time right submissions versus downstream portfolio delinquency?",
            "executive_perspective": "Building future-ready lending institutions requires scalable platforms that deliver speed to market for new credit products without compromising governance, risk controls, or customer trust."
        }

def generate_comments_for_post(post_text: str, author_name: str = "", source_category: str = "") -> dict:
    persona = load_persona()
    
    if not GEMINI_API_KEY:
        return generate_heuristic_comments(post_text, author_name, source_category)
    
    prompt = build_prompt(post_text, author_name, source_category, persona)
    
    try:
        if HAS_GENAI:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            raw_text = response.text
        else:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=GEMINI_API_KEY)
            model = genai_legacy.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            raw_text = response.text
            
        raw_text = re.sub(r"^```json\s*", "", raw_text.strip())
        raw_text = re.sub(r"\s*```$", "", raw_text.strip())
        comments = json.loads(raw_text)
        
        required_keys = ["value_add", "provocative_question", "executive_perspective"]
        for k in required_keys:
            if k not in comments or not comments[k]:
                fallback = generate_heuristic_comments(post_text, author_name, source_category)
                comments[k] = fallback[k]
                
        return comments
    except Exception as e:
        print(f"Error generating AI comments via Gemini API ({e}). Using Sriram Ganesan persona fallback.")
        return generate_heuristic_comments(post_text, author_name, source_category)
