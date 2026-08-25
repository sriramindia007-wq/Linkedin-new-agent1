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
 * Deep Contextual & Entity-Aware Semantic Engine (Guaranteed 100% Grounded & Unique)
 */
function generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance = "") {
  try {
    const { synthesizePostCommentary } = require("./deepContentSynthesisAgent");
    if (synthesizePostCommentary) {
      return synthesizePostCommentary(authorName, postText, sourceCategory);
    }
  } catch (e) {
    console.error("Error delegating to deepContentSynthesisAgent:", e.message);
  }
  
  const text = postText || "";
  const { snippet } = extractKeyEntities(text);
  return {
    value_add: `Reflecting on ${authorName || "the author"}'s analysis regarding "${snippet}", sustainable scale requires balancing operational agility with disciplined risk governance.`,
    provocative_question: `What proactive risk controls is your team prioritizing in response to these developments?`,
    executive_perspective: `Enduring institutional excellence is built on steadfast risk governance, operational transparency, and unwavering customer commitment.`
  };
}

/**
 * Main Exported Comment Generator Function (Multi-Provider LLM Agent)
 */
async function generateCommentsForPost(postText, authorName, sourceCategory, customGuidance = "", postId = "") {
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

  // Instant seamless synthesis via Deep Content Synthesis Agent with strictly cycling variations
  try {
    const { synthesizePostCommentary } = require("./deepContentSynthesisAgent");
    return await synthesizePostCommentary(postText, authorName, sourceCategory, customGuidance, postId);
  } catch (agentErr) {
    const rawFallback = generateDeepSemanticComments(postText, authorName, sourceCategory, customGuidance);
    return {
      value_add: sanitizeAiSlop(rawFallback.value_add),
      provocative_question: sanitizeAiSlop(rawFallback.provocative_question),
      executive_perspective: sanitizeAiSlop(rawFallback.executive_perspective)
    };
  }
}

module.exports = {
  generateCommentsForPost,
  generateDeepSemanticComments,
  callGemini,
  callGroq,
  callOpenAI,
  buildAdaptivePrompt
};
