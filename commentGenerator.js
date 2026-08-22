/**
 * Context-Aware Comment Generator calibrated for Sriram Ganesan
 * Head of Loan Origination System (LOS) Product and Product Solutions at M2P Fintech
 * 
 * Powered by:
 * 1. Google Gemini Generative AI LLM (when GEMINI_API_KEY is configured)
 * 2. Deep Contextual Semantic Engine (specialized for Indian Banking, MFIs, IPOs, Co-Lending, LOS/LMS, RBI Policy)
 */

let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {}

const { loadPersona } = require("./db");
try { require("dotenv").config(); } catch (e) {}

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
 * Generate Comments using Google Gemini LLM with Strict 3.5s Timeout
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

    // Hard 3500ms timeout for LLM generation
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Gemini generation timed out after 3.5s")), 3500);
    });

    const result = await Promise.race([model.generateContent(prompt), timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });

    const text = result.response.text().trim();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    return {
      value_add: parsed.value_add || "",
      provocative_question: parsed.provocative_question || "",
      executive_perspective: parsed.executive_perspective || ""
    };
  } catch (err) {
    // Instant seamless fallback to calibrated Deep Semantic Engine
    return generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
  }
}

function extractKeyEntities(text) {
  const words = text.split(/\s+/);
  const snippet = words.slice(0, 15).join(" ") + (words.length > 15 ? "..." : "");
  
  // Extract amounts / figures
  const amountMatch = text.match(/(?:₹|rs\.?|inr|usd|\$)\s*[\d,]+(?:\.\d+)?\s*(?:cr(?:ore)?|lakh|mn|bn|billion|million|k)?/i) || text.match(/\b\d+(?:\.\d+)?\s*(?:cr(?:ore)?|lakh|percent|%)\b/i);
  const keyMetric = amountMatch ? amountMatch[0] : "";

  // Extract primary entity/organization
  const orgMatch = text.match(/\b([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+)*\s+(?:Bank|Finance|Fintech|Capital|Financial|Services|Limited|Ltd|NBFC|HFC))\b/);
  const detectedOrg = orgMatch ? orgMatch[1].trim() : "";

  return { snippet, keyMetric, detectedOrg };
}

/**
 * Deep Contextual & Entity-Aware Semantic Engine
 */
function generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance = "") {
  const text = postText || "";
  const textLower = text.toLowerCase();
  const prefix = customGuidance && customGuidance.trim().length > 0 ? `Regarding ${customGuidance.trim()}: ` : "";
  const { keyMetric, detectedOrg } = extractKeyEntities(text);
  const org = detectedOrg || authorName || "financial institutions";

  // 1. MICROFINANCE / NBFC-MFI / JLG LENDING
  if (textLower.includes("svatantra") || textLower.includes("microfin") || textLower.includes("mfi") || textLower.includes("jlg") || textLower.includes("joint liability") || textLower.includes("creditaccess") || textLower.includes("mfin")) {
    const metricStr = keyMetric ? ` (at ${keyMetric} scale)` : "";
    return {
      value_add: `${prefix}Scaling rural credit distribution${metricStr} requires an agile Loan Origination System (LOS) capable of performing real-time multi-bureau JLG indebtedness de-duplication (CRIF/Equifax/CIBIL) and verifying household income caps directly on mobile devices at center meetings, ensuring rapid disbursement without compromising credit discipline.`,
      provocative_question: `As microfinance institutions balance high-volume rural disbursement SLAs with RBI's revised regulatory framework, what automated guardrails are being built into your origination workflows to prevent borrower over-leveraging across multiple lenders?`,
      executive_perspective: `Sustainable microfinance expansion across Bharat rests on resilient digital infrastructure that pairs automated rule compliance with empowering ground-level credit officers to exercise sound risk judgment.`
    };
  }

  // 2. EXECUTIVE APPOINTMENTS & RESTRUCTURING
  if ((textLower.includes("appoint") || textLower.includes("chief credit officer") || textLower.includes("joins as") || textLower.includes("rejig") || textLower.includes("leadership")) && !textLower.includes("ipo")) {
    return {
      value_add: `${prefix}Centralizing and decoupling credit risk architecture is a vital strategic milestone for ${org}. For enterprise lenders, transitioning to centralized underwriting requires an API-first LOS that standardizes credit policy enforcement across all channels, automates multi-bureau ingestion, and eliminates branch-level operational friction.`,
      provocative_question: `As ${org} strengthens its centralized credit leadership, what workflow orchestration capabilities are being prioritized in the LOS to ensure seamless exception handling and transparent audit governance?`,
      executive_perspective: `Centralized credit transformation succeeds when powered by configurable lending platforms that equip risk committees with comprehensive policy governance while empowering underwriters to execute faster, compliant decisions.`
    };
  }

  // 3. CO-LENDING, PARTNERSHIPS & FLDG
  if (textLower.includes("co-lending") || textLower.includes("colending") || textLower.includes("co-origination") || textLower.includes("fldg") || textLower.includes("default loss guarantee")) {
    return {
      value_add: `${prefix}Scaling Bank-NBFC co-origination partnerships requires far more than basic API connectivity. The critical operational heavy lifting lies in deploying a multi-entity LOS capable of synchronizing disparate credit risk policies, automating tripartite escrow reconciliation, and enforcing RBI FLDG caps in real time.`,
      provocative_question: `For institutions scaling co-lending journeys under CLM-1 and CLM-2, what architectural safeguards are being prioritized to ensure sub-second data exchange across disparate core banking stacks while meeting sub-24-hour disbursement SLAs?`,
      executive_perspective: `Sustainable co-lending models depend on collaborative, open-API lending infrastructure that provides transparent audit trails, shared risk visibility, and automated compliance for both partner institutions.`
    };
  }

  // 4. ULI, ACCOUNT AGGREGATOR & DIGITAL PUBLIC INFRASTRUCTURE
  if (textLower.includes("uli") || textLower.includes("unified lending") || textLower.includes("account aggregator") || textLower.includes("sahamati") || textLower.includes("dpi")) {
    return {
      value_add: `${prefix}The Unified Lending Interface (ULI) and Account Aggregator ecosystem represent a generational leap in credit democratization. For financial institutions, the primary differentiator is implementing an agile LOS that can seamlessly ingest and parse these diverse telemetry streams into configurable credit rules without multi-month development cycles.`,
      provocative_question: `As ULI unlocks specialized alternate data feeds across rural and MSME clusters, how are credit risk committees structuring AI governance to ensure model explainability and mitigate bias at the board level?`,
      executive_perspective: `Regulatory compliance and technology modernization must move in lockstep; enterprise lending platforms must be built with regulatory agility, consent auditability, and data governance at their very foundation.`
    };
  }

  // 5. MSME CASHFLOW, GST & SUPPLY CHAIN FINANCE (SCF / TReDS)
  if (textLower.includes("msme") || textLower.includes("sme") || textLower.includes("gst") || textLower.includes("cashflow") || textLower.includes("supply chain") || textLower.includes("treds") || textLower.includes("invoice discounting")) {
    return {
      value_add: `${prefix}The real operational challenge in scaling MSME and supply chain credit isn't just data access—it is orchestrating real-time GST, banking, and e-invoice telemetry directly within a configurable Business Rules Engine (BRE). An agile LOS must allow credit policy teams to adapt risk cutoffs dynamically based on cashflow volatility rather than static bureau proxies.`,
      provocative_question: `As lenders transition from collateral-backed to cashflow-based MSME underwriting, what governance guardrails are being instituted in the LOS to manage first-loss defaults while expanding into new vendor clusters?`,
      executive_perspective: `Technology should empower underwriters, not replace their judgment. The competitive edge in MSME origination lies in pairing automated data orchestration with decision intelligence governed by the institution's own credit policy.`
    };
  }

  // 6. NPA, STRESSED ASSETS, ASSET QUALITY & DEBT RECOVERY
  if (textLower.includes("npa") || textLower.includes("bad loan") || textLower.includes("stressed asset") || textLower.includes("asset quality") || textLower.includes("debt recovery") || textLower.includes("sarfaesi") || textLower.includes("nclt") || textLower.includes("ibc") || textLower.includes("provisioning")) {
    return {
      value_add: `${prefix}Managing gross NPAs and early-warning stress signals in dynamic credit cycles requires proactive early delinquency telemetry directly connected to the LMS/LOS. Modern lending systems must integrate automated early-alert triggers (SMA-0 to SMA-2) and dynamic risk-scoring adjustments to prevent asset quality deterioration before default events materialize.`,
      provocative_question: `As lenders manage asset quality amid rising unsecured retail exposures, what telemetry indicators are credit risk teams incorporating into their underwriting models to detect early stress prior to bureau reporting lags?`,
      executive_perspective: `Asset quality discipline is the bedrock of sustainable banking. Technology infrastructure must balance credit growth ambition with continuous portfolio surveillance and automated provisioning governance.`
    };
  }

  // 7. HOUSING FINANCE, LAP, LRD & MORTGAGES
  if (textLower.includes("housing finance") || textLower.includes("home loan") || textLower.includes("lap") || textLower.includes("loan against property") || textLower.includes("mortgage") || textLower.includes("lrd") || textLower.includes("pmay")) {
    return {
      value_add: `${prefix}Scaling secured retail lending (Home Loans & LAP) requires an enterprise LOS that unifies collateral legal/technical appraisal workflows with automated credit decisioning. Seamlessly integrating digital land records, automated LTV calculations, and tripartite builder approvals cuts sanction TAT from weeks to hours while preserving strict risk controls.`,
      provocative_question: `For mortgage and LAP originations, how are institutions optimizing digital property title verification and field technical appraisal within their LOS to reduce drop-offs without loosening underwriting rigor?`,
      executive_perspective: `Long-tenor asset-backed financing demands platforms built for operational resilience—where automated verification and strict collateral governance ensure enduring portfolio health.`
    };
  }

  // 8. VEHICLE, EV & COMMERCIAL ASSET FINANCE
  if (textLower.includes("vehicle") || textLower.includes("auto loan") || textLower.includes("ev ") || textLower.includes("electric vehicle") || textLower.includes("commercial vehicle") || textLower.includes("tractor")) {
    return {
      value_add: `${prefix}Originating vehicle and asset finance journeys at the point of sale requires instant dealer-subvention calculations, Vahan API verification, and automated asset-backed scorecards. Modern LOS platforms must provide sub-10 minute in-dealership approvals while maintaining robust credit cutoffs.`,
      provocative_question: `As EV financing evolves with differing battery depreciation cycles, what dynamic risk-scoring variables are credit teams introducing into their LOS decision engines to accurately price collateral residual value?`,
      executive_perspective: `Point-of-sale asset financing thrives when seamless dealer integration is anchored by intelligent underwriting that manages collateral risk across the entire asset lifecycle.`
    };
  }

  // 9. CREDIT CARDS, CREDIT ON UPI & EMBEDDED CONSUMER CREDIT
  if (textLower.includes("credit card") || textLower.includes("credit on upi") || textLower.includes("upi credit") || textLower.includes("rupay") || textLower.includes("bnpl") || textLower.includes("embedded credit")) {
    return {
      value_add: `${prefix}Credit on UPI and instant revolving lines require sub-second decisioning architectures capable of orchestrating bureau lookups, AML/fraud screening, and dynamic limit allocation in real time. Decoupling the Business Rules Engine (BRE) from core banking dependencies is essential to handling high-concurrency peak transaction loads.`,
      provocative_question: `As Credit on UPI unlocks micro-credit access across Tier 2 and Tier 3 markets, how are risk teams balancing instant sub-second limit sanctions with pre-delinquency portfolio surveillance?`,
      executive_perspective: `Next-generation consumer credit is embedded, instant, and frictionless—but its long-term viability hinges on modular decision engines that enforce disciplined credit policy at micro-transaction speed.`
    };
  }

  // 10. DEFAULT ENTERPRISE LENDING THOUGHT LEADERSHIP
  return {
    value_add: `${prefix}From a lending technology standpoint, the key to scaling digital credit journeys for ${org} lies in building a modular, API-first Loan Origination System (LOS) that decouples risk policy configuration from core banking dependencies, enabling rapid product rollouts while maintaining audit compliance.`,
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
