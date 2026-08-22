const https = require("https");
const { loadPersona } = require("./db");
try { require("dotenv").config(); } catch (e) {}

let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {}

/**
 * Builds dynamic context-adaptive prompt for Sriram Ganesan
 */
function buildAdaptivePrompt(persona, postText, authorName, sourceCategory, customGuidance = "") {
  const p = persona || loadPersona();
  const userName = p.user_name || "Sriram Ganesan";
  const userHeadline = p.linkedin_headline || "Head of LOS Product & Product Solutions | M2P Fintech";
  const corePhilosophy = p.core_philosophy || "Technology should empower lenders—not replace their judgment.";

  return `
You are ${userName}, ${userHeadline}.
Your core philosophy: "${corePhilosophy}"
Your background: 20+ years Indian Banking & Lending veteran (CAIIB, Retail/Wholesale Credit, NBFCs, Small Finance Banks, and Lending Tech).

CRITICAL CONTEXTUAL CALIBRATION RULE:
DO NOT force product plugs or mention "LOS" / "Loan Origination System" unless the post is explicitly about lending technology, origination software, BRE rules, or automated onboarding!
Instead, adapt your authentic practitioner perspective to the EXACT nature of the post:

- MACRO / BANKING DYNAMICS / RATES: Discuss Net Interest Margins (NIM), Cost of Funds, Credit-to-Deposit (CD) ratios, Asset-Liability Management (ALM), or liquidity transmission.
- ASSET QUALITY / NPA / RECOVERY: Discuss counter-cyclical provisioning, early-warning indicators (SMA-0/1/2), loan recovery mechanisms (SARFAESI/IBC/DRT), or credit cost containment.
- REGULATORY / RBI DIRECTIVES: Discuss regulatory compliance agility, borrower transparency (KFS/APR), Priority Sector Lending (PSL), or risk governance.
- CO-LENDING / NBFC PARTNERSHIPS: Discuss Default Loss Guarantee (FLDG) caps, risk-sharing economics, tripartite reconciliation, and underwriting alignment.
- MICROFINANCE / RURAL / JLG: Discuss multi-bureau indebtedness checks (CRIF/Equifax/CIBIL), household income caps, and rural center-meeting collection discipline.
- MSME CASHFLOW & TRADE FINANCE: Discuss GST telemetry, invoice discounting on TReDS, cashflow volatility vs collateral proxies, and working capital cycles.
- EXECUTIVE APPOINTMENTS / CORPORATE MILESTONES: Offer warm, professional executive congratulations combined with strategic reflections on organizational transformation or capital scale.
- LENDING TECH & AUTOMATION (ONLY when directly relevant): Discuss visual Business Rules Engines (BRE), straight-through processing (STP) rates, API orchestration, and decision intelligence.

Tone & Style Guidelines:
- Authoritative, senior banking & credit leader.
- Grounded in Indian BFSI practitioner reality.
- Concise, engaging, and professional (2 to 4 punchy sentences per comment).
- NEVER use generic filler phrases ("Exciting times ahead!", "Great post!", "Kudos to the team!").

POST DETAILS:
Author / Source: ${authorName} (${sourceCategory})
Post Content:
"""
${postText}
"""

${customGuidance ? `USER GUIDANCE / SPECIAL INSTRUCTION: ${customGuidance}` : ""}

Task:
Generate a JSON object with exactly three distinct comment styles in your authentic voice:
1. "value_add": A practitioner's technical, operational, or strategic insight directly addressing the post's core message. (2-3 sentences)
2. "provocative_question": A thoughtful, senior-level question to the author/industry on credit risk, market dynamics, or governance. (1-2 sentences)
3. "executive_perspective": A strategic, high-level outlook on how this development impacts the broader Indian BFSI landscape. (2-3 sentences)

Return ONLY valid raw JSON without markdown code fences. Example format:
{"value_add": "...", "provocative_question": "...", "executive_perspective": "..."}
`;
}

/**
 * Generic HTTPS POST helper with timeout
 */
function makeHttpsPost(urlStr, headers, bodyObj, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...headers
      },
      timeout: timeoutMs
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Generic HTTPS GET helper with timeout
 */
function makeHttpsGet(urlStr, headers = {}, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "User-Agent": "Node-Gemini-Client",
        ...headers
      },
      timeout: timeoutMs
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`GET timed out after ${timeoutMs}ms`));
    });

    req.end();
  });
}

/**
 * Google Gemini LLM Caller with Dynamic Model Discovery
 */
async function callGemini(apiKey, prompt) {
  // 1. Dynamic Discovery via ModelService.ListModels
  let discoveredModels = [];
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const rawList = await makeHttpsGet(listUrl, {}, 5000);
    const jsonList = JSON.parse(rawList);
    if (jsonList.models && Array.isArray(jsonList.models)) {
      discoveredModels = jsonList.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace(/^models\//, ""));
    }
  } catch (listErr) {
    // If listing fails, fall back to prioritized default list
  }

  // Combine discovered models with prioritized fallback models
  const candidateModels = Array.from(new Set([
    ...discoveredModels,
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-002",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-pro"
  ]));

  let lastError = null;
  for (const modelName of candidateModels) {
    try {
      // Direct REST API v1beta
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      const raw = await makeHttpsPost(url, {}, payload, 7000);
      const json = JSON.parse(raw);
      if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Could not connect to any available Gemini model for this API key.");
}

/**
 * Groq LLM Caller (Llama 3.3 70B - Ultra Fast)
 */
async function callGroq(apiKey, prompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const payload = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert AI assistant that responds ONLY with valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    response_format: { type: "json_object" }
  };
  const raw = await makeHttpsPost(url, { "Authorization": `Bearer ${apiKey}` }, payload, 4000);
  const json = JSON.parse(raw);
  return json.choices[0].message.content;
}

/**
 * OpenAI LLM Caller
 */
async function callOpenAI(apiKey, prompt) {
  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert AI assistant that responds ONLY with valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    response_format: { type: "json_object" }
  };
  const raw = await makeHttpsPost(url, { "Authorization": `Bearer ${apiKey}` }, payload, 4000);
  const json = JSON.parse(raw);
  return json.choices[0].message.content;
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

  // 10. DEFAULT ENTERPRISE BANKING & CREDIT THOUGHT LEADERSHIP (NO FORCED LOS)
  return {
    value_add: `${prefix}From an institutional credit standpoint, sustainable growth for ${org} requires balancing rapid market expansion with counter-cyclical risk discipline, ensuring underwriting policy standards and governance remain steadfast across changing credit cycles.`,
    provocative_question: `As the broader Indian BFSI landscape navigates evolving liquidity dynamics and credit demand, what key risk indicators is your leadership monitoring most closely this quarter?`,
    executive_perspective: `Institutional resilience is built on the foundation of disciplined credit governance and sound risk management, ensuring technology and capital work in synergy to foster long-term stakeholder value.`
  };
}

/**
 * Main Exported Comment Generator Function (Multi-Provider LLM Agent)
 */
async function generateCommentsForPost(postText, authorName, sourceCategory, customGuidance = "") {
  const persona = loadPersona();
  const provider = persona.llm_provider || "gemini";
  const geminiKey = persona.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const groqKey = persona.groq_api_key || process.env.GROQ_API_KEY;
  const openaiKey = persona.openai_api_key || process.env.OPENAI_API_KEY;

  const prompt = buildAdaptivePrompt(persona, postText, authorName, sourceCategory, customGuidance);

  let rawLlmOutput = null;

  try {
    if ((provider === "gemini" || !provider) && geminiKey && geminiKey.trim().length > 10) {
      rawLlmOutput = await callGemini(geminiKey.trim(), prompt);
    } else if (provider === "groq" && groqKey && groqKey.trim().length > 10) {
      rawLlmOutput = await callGroq(groqKey.trim(), prompt);
    } else if (provider === "openai" && openaiKey && openaiKey.trim().length > 10) {
      rawLlmOutput = await callOpenAI(openaiKey.trim(), prompt);
    } else if (geminiKey && geminiKey.trim().length > 10) {
      rawLlmOutput = await callGemini(geminiKey.trim(), prompt);
    }
  } catch (llmErr) {
    console.warn(`[AI Comment Generator] LLM call error (${provider}):`, llmErr.message);
  }

  if (rawLlmOutput) {
    try {
      const cleanJson = rawLlmOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.value_add && parsed.provocative_question && parsed.executive_perspective) {
        return {
          value_add: parsed.value_add,
          provocative_question: parsed.provocative_question,
          executive_perspective: parsed.executive_perspective
        };
      }
    } catch (parseErr) {
      console.warn("[AI Comment Generator] Failed to parse LLM JSON, using semantic fallback:", parseErr.message);
    }
  }

  // Instant seamless fallback to Context-Adaptive Persona Engine
  return generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
}

module.exports = {
  generateCommentsForPost,
  generateDeepSemanticComments,
  callGemini,
  callGroq,
  callOpenAI,
  buildAdaptivePrompt
};
