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

  let learnedContext = "";
  try {
    const { getLearnedPromptContext } = require("./mlPreferenceEngine");
    learnedContext = getLearnedPromptContext();
  } catch (e) {}

  return `
You are ${userName}, ${userHeadline}.
Your core philosophy: "${corePhilosophy}"
Your background: 20+ years Indian Banking & Lending veteran (CAIIB, Retail/Wholesale Credit, NBFCs, Small Finance Banks, and Lending Tech).

TASK & TWO-TIER CONTEXT ROUTING INSTRUCTIONS:
Carefully read the full content of the post and dynamically detect its primary domain:

1. DOMAIN A: LENDING, NBFCS, MSMES, BANKING, RBI REGULATIONS, GOVERNANCE, OR FINTECH:
   - Apply the 3-Part Executive Formula:
     a) Warm Executive Acknowledgment / Congratulations (on milestones, capital raises, or expansions).
     b) Sector & Segment Significance (informal MSMEs, rural inclusion, credit access, EV mobility).
     c) Growth & Governance Balance (expanding lending capacity while maintaining underwriting rigor, governance, and asset quality).
   - Tone Benchmark:
     "Congratulations to the [Entity] team on this milestone! Strengthening the capital base is a crucial step for NBFCs serving [Segment], where access to formal credit remains limited. Expanding lending capacity while maintaining governance and asset quality will be key to unlocking growth for entrepreneurs and small businesses across India."
   - DO NOT force "LOS" or software plugs unless the post is explicitly about lending technology or digital onboarding architecture.

3. DOMAIN C: CORPORATE GOVERNANCE, BOARD LEADERSHIP, IICA, ILSS, IOD, CSR & INDEPENDENT DIRECTORS:
   - Voice & Persona: Sriram Ganesan as an Independent Director & Corporate Governance Leader.
   - Key Principles:
     a) Fiduciary duty, board strategic oversight vs executive management execution.
     b) Audit Committee (ACB) & Risk Management Committee (RMC): Internal financial controls (IFC), statutory disclosures, compliance culture, and cyber resilience.
     c) ESG, CSR stewardship, social enterprise governance, and stakeholder value.
   - Tone: Authoritative, reflective, peer-to-peer with fellow Directors and Board Chairs. Avoid student or cheerleading tone.

2. DOMAIN B: OUTSIDE LENDING (General Technology, AI, Leadership, Sustainability/ESG, Macroeconomics, Digital Transformation, or Adjacent Industries):
   - Generate comments in your authentic voice: senior, professional, concise, and approachable.
   - Start with warm acknowledgment or congratulations if appropriate to the context.
   - Add a short, thoughtful, practical perspective directly relevant to that post's specific domain (e.g. innovation adoption, change management, digital resilience, sustainability impact).
   - Tone: Insightful, experienced, and peer-to-peer—never generic or superficial.

CRITICAL RULES ACROSS ALL POSTS:
- Always make every comment 100% context-specific to the exact details of the post.
- Keep comments concise, impactful, and human (2 to 3 sentences maximum).
- Avoid robotic platitudes ("Great post!", "Exciting times ahead!").
${learnedContext}

POST DETAILS:
Author / Source: ${authorName} (${sourceCategory})
Post Content:
"""
${postText}
"""

${customGuidance ? `USER GUIDANCE / SPECIAL INSTRUCTION: ${customGuidance}` : ""}

Task:
Generate a JSON object with three distinct comment angles in your authentic voice:
1. "value_add": Direct practitioner insight blending acknowledgment with domain wisdom.
2. "provocative_question": A thoughtful senior-level inquiry that invites meaningful discussion.
3. "executive_perspective": A strategic perspective on how this development shapes the broader industry.

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

  // Combine discovered models with prioritized working models
  const candidateModels = Array.from(new Set([
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
    ...discoveredModels
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
  const org = detectedOrg || authorName || "specialized lenders";
  // 0. CORPORATE GOVERNANCE, IICA, ILSS, IOD, CSR & BOARD LEADERSHIP
  const catLower = (sourceCategory || "").toLowerCase();
  if (catLower.includes("governance") || catLower.includes("board") || textLower.includes("governance") || textLower.includes("independent director") || textLower.includes("board leadership") || textLower.includes("iica") || textLower.includes("ilss") || textLower.includes("iod") || textLower.includes("audit committee") || textLower.includes("boardroom") || textLower.includes("fiduciary") || textLower.includes("stakeholder") || textLower.includes("esg") || textLower.includes("csr") || textLower.includes("brsr")) {
    if (textLower.includes("ilss") || textLower.includes("social sector") || textLower.includes("spo") || textLower.includes("non-profit") || textLower.includes("csr")) {
      return {
        value_add: `${prefix}As corporate governance expands across social enterprises and non-profits, the fiduciary responsibility of advisory boards becomes even more vital. Independent directors and mentors bring essential oversight on capital stewardship, internal financial controls (IFC), and mission alignment—enabling impact organizations to scale sustainably with public trust.`,
        provocative_question: `As organizations expand board-level advisory and mentorship cohorts, what governance mechanisms are proving most effective in balancing visionary mission stewardship with strict financial accountability?`,
        executive_perspective: `Enduring institutional trust is anchored in the boardroom. Whether in commercial banking or social enterprise, effective governance rooted in independent oversight, ethical culture, and stakeholder stewardship remains the bedrock of sustainable value creation.`
      };
    }

    return {
      value_add: `${prefix}From an Independent Director and Board Committee perspective, robust governance requires maintaining strategic oversight and internal financial controls (IFC) without encroaching on executive execution. Balancing enterprise risk management (ERM) with long-term stakeholder stewardship is what safeguards organizational integrity across market cycles.`,
      provocative_question: `With heightened regulatory focus on corporate disclosures and board accountability, how are independent directors enhancing real-time risk telemetry to oversee strategic execution effectively?`,
      executive_perspective: `A resilient Board goes beyond statutory compliance—it actively anchors corporate culture, stress-tests enterprise risk assumptions, and aligns organizational purpose with long-term stakeholder value.`
    };
  }

  // 1. IPO / DRHP / CAPITAL RAISING & PUBLIC LISTING (e.g. Veritas Finance, Svatantra)
  if (textLower.includes("drhp") || textLower.includes("ipo") || textLower.includes("sebi") || textLower.includes("raise up to") || textLower.includes("capital base") || textLower.includes("fresh issue")) {
    const metricStr = keyMetric ? ` of ${keyMetric}` : "";
    return {
      value_add: `${prefix}For specialized NBFCs scaling retail and MSME books, raising capital${metricStr} via public listing is a major milestone, but maintaining pristine asset quality through economic cycles remains the real test of underwriting discipline. As franchise scale expands, balancing geographic de-concentration with rigorous credit governance will dictate long-term return on assets.`,
      provocative_question: `As specialized lenders transition to public markets, what mechanisms are risk committees prioritizing to ensure aggressive post-IPO AUM expansion does not dilute field-level underwriting rigor?`,
      executive_perspective: `Capital market confidence in specialized NBFCs reinforces a fundamental truth: long-term franchise value is driven by sound credit culture, transparent governance, and healthy risk-adjusted margins rather than sheer volume expansion.`
    };
  }

  // 2. MICROFINANCE / NBFC-MFI / JLG LENDING
  if (textLower.includes("microfin") || textLower.includes("mfi") || textLower.includes("jlg") || textLower.includes("joint liability") || textLower.includes("creditaccess") || textLower.includes("mfin") || textLower.includes("sa-dhan")) {
    const metricStr = keyMetric ? ` (at ${keyMetric} scale)` : "";
    return {
      value_add: `${prefix}Sustainable scale in rural microfinance${metricStr} requires deep borrower cashflow assessment and multi-bureau indebtedness verification to prevent over-leveraging across lenders, backed by consistent center-meeting discipline.`,
      provocative_question: `With revised microfinance regulatory guidelines emphasizing household income assessment, how are institutions optimizing rural branch workflows to maintain high collection efficiency during seasonal stress?`,
      executive_perspective: `Sustainable financial inclusion across Bharat depends on balancing high-touch field relationships with counter-cyclical credit discipline and transparent borrower protections.`
    };
  }

  // 3. MSME CASHFLOW, TRADE CREDIT & WORKING CAPITAL
  if (textLower.includes("msme") || textLower.includes("sme") || textLower.includes("working capital") || textLower.includes("supply chain") || textLower.includes("treds") || textLower.includes("invoice discounting") || textLower.includes("cashflow")) {
    return {
      value_add: `${prefix}The core discipline in MSME credit lies in evaluating actual cashflow cycles and surrogate operational telemetry rather than relying strictly on backward-looking audited financials. Maintaining sub-2% delinquency requires proactive monitoring of supply-chain receivables and GST turnover patterns.`,
      provocative_question: `As lenders expand cashflow-based underwriting for informal enterprises, what leading indicators are credit teams monitoring most closely to catch cashflow compression before repayment defaults occur?`,
      executive_perspective: `Empowering informal MSMEs requires blending field-level appraisal expertise with modern cashflow analytics—ensuring capital flows efficiently while preserving strict underwriting standards.`
    };
  }

  // 4. CO-LENDING, PARTNERSHIPS & FLDG
  if (textLower.includes("co-lending") || textLower.includes("colending") || textLower.includes("co-origination") || textLower.includes("fldg") || textLower.includes("default loss guarantee")) {
    return {
      value_add: `${prefix}Successful Bank-NBFC co-lending hinges on aligning credit underwriting standards, transparent risk-sharing under RBI FLDG caps, and automated tripartite escrow reconciliation to ensure seamless settlement without friction.`,
      provocative_question: `For institutions operating under CLM-1 and CLM-2 frameworks, what practices are proving most effective in synchronizing disparate risk appetites and credit approval turnarounds between banks and NBFC partners?`,
      executive_perspective: `Co-lending represents a powerful catalyst for credit democratization when built on shared risk governance, operational transparency, and mutual alignment between originators and balance-sheet lenders.`
    };
  }

  // 5. NPA, STRESSED ASSETS & ASSET QUALITY
  if (textLower.includes("npa") || textLower.includes("bad loan") || textLower.includes("stressed asset") || textLower.includes("asset quality") || textLower.includes("debt recovery") || textLower.includes("sarfaesi") || textLower.includes("provisioning")) {
    return {
      value_add: `${prefix}Preserving pristine asset quality across changing macroeconomic cycles demands robust early-warning telemetry (SMA-0 to SMA-2) and counter-cyclical provisioning buffers to resolve credit stress well before formal default.`,
      provocative_question: `As portfolio volumes expand, what early-stage behavioral signals are risk teams finding most predictive in identifying pre-delinquency stress before formal bureau reporting lags?`,
      executive_perspective: `Asset quality discipline is the bedrock of enduring banking franchises. Balance sheet resilience is created during periods of strong credit growth by maintaining underwriting conservatism.`
    };
  }

  // 6. AUTO, EV & COMMERCIAL MOBILITY FINANCE
  if (textLower.includes("vehicle") || textLower.includes("auto loan") || textLower.includes("ev ") || textLower.includes("electric vehicle") || textLower.includes("commercial vehicle") || textLower.includes("tractor")) {
    return {
      value_add: `${prefix}Originating commercial and retail vehicle finance requires seamless coordination at the point of sale combined with dynamic residual asset valuation, especially as EV adoption introduces new secondary-market depreciation dynamics.`,
      provocative_question: `In commercial vehicle and fleet financing, how are risk teams structuring underwriting to accommodate fuel/operational cost volatility while maintaining timely collection cycles?`,
      executive_perspective: `Mobility and asset financing thrive when sound collateral governance and fast dealer-channel origination work in tandem to support productive enterprise transport.`
    };
  }

  // 7. DEFAULT SENIOR CREDIT THOUGHT LEADERSHIP
  return {
    value_add: `${prefix}From an institutional credit perspective, sustainable growth for ${org} requires maintaining steadfast underwriting policy standards and robust risk governance across evolving market and liquidity cycles.`,
    provocative_question: `As the broader Indian financial sector navigates changing credit demand and liquidity conditions, what core operational metrics is your leadership monitoring most closely?`,
    executive_perspective: `Long-term banking and lending success is anchored in disciplined risk management, transparent governance, and building customer trust across credit cycles.`
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

  const { sanitizeAiSlop } = require("./mlPreferenceEngine");

  if (rawLlmOutput) {
    try {
      const cleanJson = rawLlmOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.value_add && parsed.provocative_question && parsed.executive_perspective) {
        return {
          value_add: sanitizeAiSlop(parsed.value_add),
          provocative_question: sanitizeAiSlop(parsed.provocative_question),
          executive_perspective: sanitizeAiSlop(parsed.executive_perspective)
        };
      }
    } catch (parseErr) {
      console.warn("[AI Comment Generator] Failed to parse LLM JSON, using semantic fallback:", parseErr.message);
    }
  }

  // Instant seamless fallback to Context-Adaptive Persona Engine
  const rawFallback = generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
  return {
    value_add: sanitizeAiSlop(rawFallback.value_add),
    provocative_question: sanitizeAiSlop(rawFallback.provocative_question),
    executive_perspective: sanitizeAiSlop(rawFallback.executive_perspective)
  };
}

module.exports = {
  generateCommentsForPost,
  generateDeepSemanticComments,
  callGemini,
  callGroq,
  callOpenAI,
  buildAdaptivePrompt
};
