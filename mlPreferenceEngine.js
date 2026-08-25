const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'data', 'learningMemory.json');

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch (e) {}

  return {
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    userGuidanceHistory: [],
    learnedPositiveDirectives: [
      "ZERO AI SLOP: Ban robotic filler phrases ('delve into', 'testament to', 'gratifying to see', 'kudos to', 'beacon of', 'pivotal moment', 'fast-paced world', 'game-changer', 'paradigm shift').",
      "Direct Practitioner Opening: Start immediately with the core operational point or authentic boardroom perspective without opening sycophancy or filler.",
      "Grounded Banking & Risk Substance: Anchor commentary in concrete mechanics (LTV buffers, sub-15m STP, SMA-0 delinquency triggers, Account Aggregator telemetry, IFC, Audit Committee oversight).",
      "In Corporate Governance & Board Leadership posts, speak with the authority of an Independent Director & Board Committee member (Audit Committee / RMC / NRC / CSR).",
      "Human Sentence Flow: Keep sentences concise, punchy, and conversational (2-3 sentences max). Write like a seasoned peer CXO/Director talking directly to fellow industry leaders."
    ],
    bannedAiSlopPhrases: [
      "delve into", "delving into", "testament to", "it is indeed gratifying", "gratifying to see",
      "kudos to", "fascinating insights", "in today's fast-paced", "beacon of", "pivotal moment",
      "game-changer", "paradigm shift", "synergistic", "seamlessly integrate", "holistic ecosystem",
      "unveiling", "delighted to see", "great share", "thought-provoking post", "vital cog",
      "embark on this journey", "demystify", "double-edged sword", "navigate the complexities",
      "ever-evolving landscape", "at the forefront of", "a testament of", "truly inspiring"
    ],
    learnedNegativeKeywords: [
      "hiring", "job vacancy", "apply today", "archery", "sports", "marathon", "csr initiative non-financial"
    ],
    approvedStyleDistribution: {
      value_add: 12,
      provocative_question: 8,
      executive_perspective: 10
    },
    totalInteractions: 30
  };
}

function saveMemory(mem) {
  mem.lastUpdated = new Date().toISOString();
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving learning memory:', e.message);
  }
}

/**
 * Record user custom guidance when regenerating comments
 */
function recordRegenerationGuidance(customGuidance, postText) {
  if (!customGuidance || typeof customGuidance !== 'string') return;
  const clean = customGuidance.trim();
  if (clean.length < 5) return;

  const mem = loadMemory();
  mem.userGuidanceHistory.unshift({
    guidance: clean,
    timestamp: new Date().toISOString(),
    contextSnippet: (postText || '').substring(0, 100)
  });

  if (!mem.learnedPositiveDirectives.includes(clean)) {
    mem.learnedPositiveDirectives.unshift(clean);
    if (mem.learnedPositiveDirectives.length > 15) mem.learnedPositiveDirectives.pop();
  }

  mem.totalInteractions++;
  saveMemory(mem);
  console.log(`🧠 [ML Engine] Learned new user guidance directive: "${clean}"`);
}

/**
 * Clean and sanitize any AI slop clichés from generated comments
 */
function sanitizeAiSlop(text) {
  if (!text || typeof text !== "string") return text;
  let cleaned = text;

  const slopReplacements = [
    { pattern: /^it is indeed gratifying to see\s+/i, replace: "Seeing " },
    { pattern: /^it is gratifying to see\s+/i, replace: "Seeing " },
    { pattern: /^kudos to the team for\s+/i, replace: "Great execution on " },
    { pattern: /^in today's fast-paced digital world,?\s*/i, replace: "" },
    { pattern: /^in an ever-evolving financial landscape,?\s*/i, replace: "" },
    { pattern: /\s*is a testament to\s*/gi, replace: " directly demonstrates " },
    { pattern: /\s*acts as a beacon of\s*/gi, replace: " provides a clear benchmark for " },
    { pattern: /\s*a pivotal moment in\s*/gi, replace: " a major milestone in " },
    { pattern: /\s*a game-changer for\s*/gi, replace: " a structural shift for " },
    { pattern: /\s*a paradigm shift in\s*/gi, replace: " a fundamental change in " },
    { pattern: /\s*seamlessly integrated?\s*/gi, replace: " automated " },
    { pattern: /\s*holistic ecosystem\s*/gi, replace: " operating framework " },
    { pattern: /\s*delving into\s*/gi, replace: " examining " }
  ];

  slopReplacements.forEach(({ pattern, replace }) => {
    cleaned = cleaned.replace(pattern, replace);
  });

  // Capitalize first character if needed
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.trim();
}

/**
 * Record when user skips or rejects a post
 */
function recordSkippedPost(post) {
  if (!post || !post.post_text) return;
  const mem = loadMemory();
  
  const text = post.post_text.toLowerCase();
  const nonLendingCandidates = [
    "fcnr", "nri deposit", "fixed deposit", "recurring deposit", "savings account",
    "credit card reward", "credit card offer", "forex card", "demat account",
    "mutual fund", "term insurance", "life insurance", "motor insurance",
    "hiring", "apply today", "job vacancy", "sports", "cricket", "marathon",
    "celebration", "award ceremony", "festive wishes"
  ];
  
  nonLendingCandidates.forEach(kw => {
    if (text.includes(kw) && !mem.learnedNegativeKeywords.includes(kw)) {
      mem.learnedNegativeKeywords.push(kw);
      console.log(`🧠 [ML Engine] Added non-lending filter pattern: "${kw}" from skipped post`);
    }
  });

  mem.totalInteractions++;
  saveMemory(mem);
}

/**
 * Record when user approves a comment to reinforce style
 */
function recordApprovedComment(post, selectedStyle, commentText) {
  const mem = loadMemory();
  if (selectedStyle && mem.approvedStyleDistribution[selectedStyle] !== undefined) {
    mem.approvedStyleDistribution[selectedStyle]++;
  }
  mem.totalInteractions++;
  saveMemory(mem);
}

/**
 * Generates dynamic prompt context to inject into Gemini comment generator
 */
function getLearnedPromptContext() {
  const mem = loadMemory();
  const directives = (mem.learnedPositiveDirectives || []).slice(0, 6).map(d => `- ${d}`).join('\n');
  return `
[STRICT ANTI-AI-SLOP DIRECTIVES & AUTHENTIC HUMAN VOICE MEMORY]:
${directives}
BANNED CLICHÉS: Never use "testament to", "it is indeed gratifying", "delving into", "fast-paced world", "beacon", "game-changer", "paradigm shift", or "kudos".
Start immediately with sharp domain substance.`;
}

module.exports = {
  loadMemory,
  recordRegenerationGuidance,
  recordSkippedPost,
  recordApprovedComment,
  getLearnedPromptContext,
  sanitizeAiSlop
};
