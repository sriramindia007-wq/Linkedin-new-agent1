const { loadMemory } = require('./mlPreferenceEngine');

/**
 * Autonomous Lending Relevance Agent
 * 
 * Strict Domain Gatekeeper:
 * Audits every candidate post from banks, NBFCs, and FinTechs to ensure
 * only genuine lending, credit, underwriting, risk, and regulatory posts pass.
 * 
 * Strictly rejects: FCNR / NRI deposits, savings accounts, credit card promos,
 * mutual funds, insurance, sports CSR, and job vacancies.
 */

const LENDING_CORE_KEYWORDS = [
  "lending", "loan", "loans", "credit", "underwriting", "msme", "sme", "nbfc",
  "aum", "asset quality", "npa", "stage-3", "stage 3", "delinquency", "collections", "recovery",
  "co-lending", "fl dg", "fldg", "rbi", "bre", "los", "origination", "disbursement", "drhp",
  "ipo", "capital base", "housing finance", "lap", "mortgage", "vehicle finance", "auto loan",
  "gold loan", "account aggregator", "uli", "credit on upi", "cibil", "rating", "provisioning",
  "working capital", "supply chain finance", "invoice discounting", "credit guarantee", "cgtmse",
  "ncgtc", "microfinance", "mfi", "jlg", "shg", "priority sector", "psl", "secured lending"
];

const STRICT_NOISE_FILTER_PATTERNS = [
  // 1. Retail Deposits & Wealth Products (Non-Lending)
  /fcnr/i,
  /nris+deposit/i,
  /fixeds+deposit/i,
  /recurrings+deposit/i,
  /savingss+account/i,
  /demats+account/i,
  /mutuals+fund/i,
  /forexs+card/i,
  /terms+insurance/i,
  /lifes+insurance/i,
  /healths+insurance/i,
  /motors+insurance/i,
  /discounts+ons+flight/i,
  /cashbacks+offer/i,
  /credits+cards+reward/i,
  /credits+cards+offer/i,
  /dinings+delights/i,
  /books+nows+fors+d+%/i,
  /interests+rates+ons+yours+fcnr/i,
  /interests+rates+ons+yours+deposit/i,

  // 2. HR, Hiring & Job Vacancies
  /we'res+hiring/i,
  /applys+today/i,
  /jobs+vacancy/i,
  /openings+fors+thes+role/i,
  /sends+yours+resume/i,
  /joins+ours+teams+as/i,

  // 3. Generic CSR Sports & Celebrations
  /archery/i,
  /sportss+fors+development/i,
  /crickets+tournament/i,
  /marathons+run/i,
  /festives+wishes/i,
  /happys+diwali/i,
  /happys+news+year/i,
  /independences+day/i
];

function analyzeLendingRelevance(postText, authorName = "", sourceCategory = "") {
  if (!postText || typeof postText !== 'string') {
    return { isRelevant: false, category: "EMPTY", score: 0, reason: "Empty post text" };
  }

  const cleanText = postText.toLowerCase();

  // 1. Check against Strict Non-Lending & Product Noise Patterns
  for (const pattern of STRICT_NOISE_FILTER_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isRelevant: false,
        category: "NON_LENDING_NOISE",
        score: 10,
        reason: `Strictly blocked by non-lending filter: ${pattern}`
      };
    }
  }

  // 2. Check against learned negative patterns from ML engine
  const memory = loadMemory();
  for (const negKw of memory.learnedNegativeKeywords || []) {
    if (cleanText.includes(negKw.toLowerCase()) && !cleanText.includes("lending") && !cleanText.includes("credit")) {
      return {
        isRelevant: false,
        category: "ML_LEARNED_NOISE",
        score: 15,
        reason: `Matches ML learned negative filter: "${negKw}"`
      };
    }
  }

  // 3. Count Core Lending Keyword Hits (Requires true lending substance)
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

  if (coreMatches === 1 && (cleanText.includes("fintech") || cleanText.includes("governance") || cleanText.includes("rbi") || cleanText.includes("board"))) {
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
    score: 35,
    reason: "Lacks core lending, credit, underwriting, or risk substance"
  };
}

module.exports = {
  analyzeLendingRelevance,
  LENDING_CORE_KEYWORDS,
  STRICT_NOISE_FILTER_PATTERNS
};
