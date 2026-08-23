const { loadMemory } = require('./mlPreferenceEngine');

/**
 * Autonomous Lending Relevance Agent
 * 
 * Analyzes posts from BFSI entities and filters out non-lending noise
 * (e.g. CSR sports, job hiring, internal office celebrations)
 * while promoting high-value lending, credit, and risk content.
 */

const LENDING_CORE_KEYWORDS = [
  "lending", "loan", "loans", "credit", "underwriting", "msme", "sme", "nbfc", "bank", "banking",
  "aum", "asset quality", "npa", "stage-3", "stage 3", "delinquency", "collections", "recovery",
  "co-lending", "fl dg", "fldg", "rbi", "bre", "los", "origination", "disbursement", "drhp",
  "ipo", "capital base", "housing finance", "lap", "mortgage", "vehicle finance", "auto loan",
  "gold loan", "account aggregator", "uli", "credit on upi", "cibil", "rating", "provisioning"
];

const NOISE_FILTER_PATTERNS = [
  /we're\s+hiring/i,
  /apply\s+today/i,
  /job\s+vacancy/i,
  /opening\s+for\s+the\s+role/i,
  /archery/i,
  /sports\s+for\s+development/i,
  /cricket\s+tournament/i,
  /marathon\s+run/i,
  /festive\s+wishes/i,
  /happy\s+diwali/i,
  /happy\s+new\s+year/i
];

function analyzeLendingRelevance(postText, authorName = "", sourceCategory = "") {
  if (!postText || typeof postText !== 'string') {
    return { isRelevant: false, category: "EMPTY", score: 0, reason: "Empty post text" };
  }

  const cleanText = postText.toLowerCase();

  // 1. Check against Noise Patterns
  for (const pattern of NOISE_FILTER_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isRelevant: false,
        category: "IRRELEVANT_NOISE",
        score: 15,
        reason: `Contains non-lending noise pattern: ${pattern}`
      };
    }
  }

  // 2. Check against learned negative patterns from ML engine
  const memory = loadMemory();
  for (const negKw of memory.learnedNegativeKeywords || []) {
    if (cleanText.includes(negKw.toLowerCase()) && !cleanText.includes("lending") && !cleanText.includes("credit")) {
      return {
        isRelevant: false,
        category: "IRRELEVANT_NOISE",
        score: 20,
        reason: `Matches ML learned negative filter: "${negKw}"`
      };
    }
  }

  // 3. Count Core Lending Keyword Hits
  let coreMatches = 0;
  LENDING_CORE_KEYWORDS.forEach(kw => {
    if (cleanText.includes(kw)) coreMatches++;
  });

  if (coreMatches >= 2) {
    return {
      isRelevant: true,
      category: "CORE_LENDING",
      score: Math.min(99, 80 + coreMatches * 4),
      reason: `Matches ${coreMatches} core lending & credit indicators`
    };
  }

  if (coreMatches === 1 || cleanText.includes("fintech") || cleanText.includes("governance") || cleanText.includes("board")) {
    return {
      isRelevant: true,
      category: "ADJACENT_ECOSYSTEM",
      score: 75,
      reason: "Matches adjacent fintech / governance ecosystem context"
    };
  }

  return {
    isRelevant: false,
    category: "LOW_RELEVANCE",
    score: 40,
    reason: "Lacks sufficient lending, credit, or risk substance"
  };
}

module.exports = {
  analyzeLendingRelevance,
  LENDING_CORE_KEYWORDS
};
