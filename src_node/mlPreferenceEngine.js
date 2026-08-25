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
      "In Corporate Governance & Board Leadership posts, frame comments directly from the perspective of an Independent Director and Board Committee member (Audit Committee / Risk Management Committee / NRC / CSR).",
      "Emphasize Board fiduciary oversight vs executive management execution, internal financial controls (IFC), enterprise risk management (ERM), and long-term stakeholder stewardship.",
      "Emphasize MSME cashflow-based underwriting over traditional collateral",
      "Highlight multi-entity risk governance and no-code BRE policy orchestration",
      "Maintain Gross Stage-3 and asset quality balance during rapid portfolio expansion"
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

  // Extract key directive phrases
  if (!mem.learnedPositiveDirectives.includes(clean)) {
    mem.learnedPositiveDirectives.unshift(clean);
    if (mem.learnedPositiveDirectives.length > 15) mem.learnedPositiveDirectives.pop();
  }

  mem.totalInteractions++;
  saveMemory(mem);
  console.log(`🧠 [ML Engine] Learned new user guidance directive: "${clean}"`);
}

/**
 * Record when user skips or rejects a post to learn negative topic patterns
 * CRITICAL SAFETY GUARANTEE: Only non-lending topics/keywords are learned.
 * The monitored company page or individual author is NEVER blacklisted or penalized.
 */
function recordSkippedPost(post) {
  if (!post || !post.post_text) return;
  const mem = loadMemory();
  
  // Extract purely non-lending topic keywords (FCNR, deposits, cards, hiring, sports)
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
  if (!mem.learnedPositiveDirectives || mem.learnedPositiveDirectives.length === 0) return "";

  const directives = mem.learnedPositiveDirectives.slice(0, 5).map(d => `- ${d}`).join('\n');
  return `\n[LEARNED USER PREFERENCES & HISTORICAL STEERING DIRECTIVES]:\n${directives}\nPrioritize these nuances naturally in generated comments.`;
}

module.exports = {
  loadMemory,
  recordRegenerationGuidance,
  recordSkippedPost,
  recordApprovedComment,
  getLearnedPromptContext
};
