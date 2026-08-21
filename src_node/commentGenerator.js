/**
 * Context-Aware Comment Generator calibrated for Sriram Ganesan
 * Head of Loan Origination System (LOS) Product and Product Solutions at M2P Fintech
 * 
 * Powered by:
 * 1. Google Gemini Generative AI LLM (when GEMINI_API_KEY is configured)
 * 2. Deep Contextual Semantic Engine (specialized for Indian Banking, MFIs, IPOs, Co-Lending, LOS/LMS, RBI Policy)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { loadPersona } = require("./db");
require("dotenv").config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const SRIRAM_PERSONA_PROMPT = `
You are Sriram Ganesan, Head of Loan Origination System (LOS) Product and Product Solutions at M2P Fintech.
Your core philosophy: "Technology should empower lenders—not replace their judgment. Our platform provides configurable workflows, intelligent automation and decision support while ensuring lending decisions remain governed by each institution's own credit policies, governance framework and compliance obligations."

Your expertise:
- Enterprise Loan Origination Systems (LOS), LMS, Decision Engines (BRE), API Orchestration.
- Multi-asset lending: MSME (cashflow/GST-based), Retail, LAP, Co-Lending, Microfinance (NBFC-MFI & JLG lending), Supply Chain Finance.
- Digital Public Infrastructure: Unified Lending Interface (ULI), Account Aggregator (AA), OCEN, Sahamati.
- Risk Governance: RBI Master Directions, FLDG compliance, capital adequacy, credit cost discipline.

Your communication style:
- Authoritative, senior product leader and enterprise practitioner.
- Deeply technical yet strategic.
- NEVER use generic buzzwords like "Exciting times ahead!" or "Kudos to the team!".
- Focus on origination architecture, underwriting governance, credit policy enforcement, and scalability.

Task:
Read the following LinkedIn post carefully and generate 3 distinctly calibrated comments in your authentic voice.
`;

/**
 * Generate Comments using Google Gemini LLM
 */
async function generateGeminiComments(postText, authorName, sourceCategory, customGuidance = "") {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
${SRIRAM_PERSONA_PROMPT}

POST DETAILS:
Author/Source: ${authorName} (${sourceCategory})
Post Content:
"""
${postText}
"""

${customGuidance ? `SPECIFIC USER INSTRUCTION/GUIDANCE: ${customGuidance}` : ""}

Generate a JSON response with exactly three keys:
1. "value_add": A practitioner's technical and operational insight focusing on LOS architecture, credit policy, underwriting workflows, or data orchestration directly relevant to the post. (2-4 sentences)
2. "provocative_question": A thoughtful, senior-level question to the author/industry on credit risk governance, technology adoption, or regulatory balance. (1-2 sentences)
3. "executive_perspective": A strategic, high-level outlook on how this development impacts the future of institutional lending and technology empowerment. (2-3 sentences)

Ensure the response is ONLY valid raw JSON with keys: value_add, provocative_question, executive_perspective.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    return {
      value_add: parsed.value_add || "",
      provocative_question: parsed.provocative_question || "",
      executive_perspective: parsed.executive_perspective || ""
    };
  } catch (err) {
    console.warn("⚠️ Gemini API generation failed, using Deep Semantic Engine:", err.message);
    return generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
  }
}

/**
 * Deep Semantic Engine (Accurate Contextual Fallback)
 */
function generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance = "") {
  const text = postText || "";
  const textLower = text.toLowerCase();
  const prefix = customGuidance && customGuidance.trim().length > 0 ? `Regarding ${customGuidance.trim()}: ` : "";

  // 1. MICROFINANCE / NBFC-MFI / IPO / CAPITAL MARKETS
  if (textLower.includes("svatantra") || textLower.includes("microfin") || textLower.includes("ipo") || textLower.includes("drhp") || textLower.includes("mfi") || textLower.includes("chaitanya") || textLower.includes("joint liability") || textLower.includes("jlg")) {
    const isSvatantra = textLower.includes("svatantra");
    const mfiRef = isSvatantra ? "Svatantra Microfin's ₹3,000 Cr IPO filing and post-Chaitanya scale (₹23,818 Cr AUM)" : "this public listing milestone in the microfinance sector";

    return {
      value_add: `${prefix}${mfiRef} underscores a pivotal shift in the NBFC-MFI landscape. As microfinance institutions scale distribution across rural Bharat, the critical operational challenge lies in deploying an agile Loan Origination System (LOS) that enforces multi-bureau JLG indebtedness checks and household income limits in real-time, mitigating borrower over-leveraging while maintaining rapid rural disbursement SLAs.`,
      provocative_question: `As large NBFC-MFIs transition to public market scrutiny, what workflow orchestration mechanisms are being implemented in their origination platforms to balance automated credit scorecards with ground-level field officer judgment under RBI's revised microfinance framework?`,
      executive_perspective: `The institutionalization of India's microfinance sector—backed by marquee PE participation and public listings—demonstrates that sustainable rural financial inclusion requires robust digital lending infrastructure with strict credit policy governance at its core.`
    };
  }

  // 2. EXECUTIVE APPOINTMENTS & RESTRUCTURING
  if ((textLower.includes("appoint") || textLower.includes("chief credit officer") || textLower.includes("joins as") || textLower.includes("rejig")) && !textLower.includes("ipo")) {
    let orgName = authorName;
    const orgMatch = text.match(/([A-Z][A-Za-z0-9\s&]+(?:Bank|Finance|Fintech|Capital))/);
    if (orgMatch && !orgMatch[1].includes("Sheet")) orgName = orgMatch[1].trim();

    return {
      value_add: `${prefix}Decoupling credit decisioning and risk underwriting into a specialized, centralized department is a timely strategic move for ${orgName}. For enterprise financial institutions, this transition requires an agile Loan Origination System (LOS) that standardizes policy enforcement across branches, automates multi-bureau ingestion, and delivers straight-through processing without operational friction.`,
      provocative_question: `As ${orgName} transitions towards a centralized credit architecture, what workflow orchestration capabilities are being prioritized in the LOS to ensure seamless exception management and policy auditability?`,
      executive_perspective: `Centralized credit transformation succeeds when powered by configurable lending platforms that provide risk committees with end-to-end governance while empowering underwriters to make faster, compliant decisions.`
    };
  }

  // 3. CO-LENDING & PARTNERSHIPS
  if (textLower.includes("co-lending") || textLower.includes("colending") || textLower.includes("partnership") || textLower.includes("mou")) {
    return {
      value_add: `${prefix}Scaling institutional co-lending partnerships between Banks and NBFCs requires far more than basic API connectivity. The critical operational heavy lifting lies in deploying a multi-entity LOS capable of synchronizing disparate credit risk policies, automating tripartite escrow reconciliation, and enforcing FLDG caps in real time.`,
      provocative_question: `For lenders scaling Bank-NBFC co-origination journeys, what architectural safeguards are being prioritized to ensure seamless data exchange across distinct core banking stacks while meeting sub-24 hour disbursement SLAs?`,
      executive_perspective: `Sustainable co-lending models depend on collaborative, open-API lending infrastructure that provides transparent audit trails, shared risk visibility, and automated compliance for both partner institutions.`
    };
  }

  // 4. ULI, ACCOUNT AGGREGATOR & REGULATORY PUBLIC INFRASTRUCTURE
  if (textLower.includes("uli") || textLower.includes("unified lending") || textLower.includes("account aggregator") || textLower.includes("sahamati") || textLower.includes("rbi")) {
    return {
      value_add: `${prefix}The Unified Lending Interface (ULI) and Account Aggregator ecosystem represent a generational leap in credit democratization. For financial institutions, the primary differentiator is implementing an agile LOS that can seamlessly ingest and parse these diverse telemetry streams into configurable credit rules without multi-month development cycles.`,
      provocative_question: `As ULI unlocks specialized alternate data feeds across rural and MSME clusters, how are credit risk committees structuring AI governance to ensure model explainability and mitigate bias at the board level?`,
      executive_perspective: `Regulatory compliance and technology modernization must move in lockstep; enterprise lending platforms must be built with regulatory agility, consent auditability, and data governance at their very foundation.`
    };
  }

  // 5. MSME CASHFLOW, GST & SUPPLY CHAIN FINANCE
  if (textLower.includes("msme") || textLower.includes("sme") || textLower.includes("gst") || textLower.includes("cashflow") || textLower.includes("supply chain")) {
    return {
      value_add: `${prefix}The real operational challenge in scaling MSME credit isn't just data access—it is orchestrating real-time GST, banking, and tax telemetry directly within a configurable Business Rules Engine (BRE). An agile LOS must allow credit policy teams to adapt risk cutoffs dynamically based on cashflow volatility rather than static bureau proxies.`,
      provocative_question: `As institutions transition from collateral-backed to cashflow-based MSME underwriting, what governance guardrails are being instituted in the LOS to manage first-loss defaults while expanding into new vendor clusters?`,
      executive_perspective: `Technology should empower underwriters, not replace their judgment. The competitive edge in MSME origination lies in pairing automated data orchestration with decision intelligence governed by the institution's own credit policy.`
    };
  }

  // 6. DEFAULT ENTERPRISE LENDING THOUGHT LEADERSHIP
  return {
    value_add: `${prefix}From a lending technology standpoint, the key to scaling digital credit journeys lies in building a modular, API-first Loan Origination System (LOS) that decouples risk policy configuration from core banking dependencies, enabling rapid product rollouts while maintaining audit compliance.`,
    provocative_question: `As digital lending architectures evolve, how are product teams balancing automated straight-through processing (STP) with granular risk governance at the committee level?`,
    executive_perspective: `Scalable credit platforms must be designed with both borrower speed and institutional governance in mind, ensuring technology strengthens credit judgment rather than bypassing it.`
  };
}

/**
 * Main Exported Comment Generator Function
 */
async function generateCommentsForPost(postText, authorName, sourceCategory, customGuidance = "") {
  if (GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 10) {
    return await generateGeminiComments(postText, authorName, sourceCategory, customGuidance);
  }
  return generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
}

module.exports = {
  generateCommentsForPost,
  generateDeepSemanticComments,
  generateGeminiComments
};
