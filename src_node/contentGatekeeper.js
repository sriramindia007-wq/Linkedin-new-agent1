/**
 * Strict Semantic Gatekeeper & Noise Filter
 * Calibrated specifically for Sriram Ganesan (Head of LOS Product & Solutions | M2P Fintech)
 * Strictly enforces Digital Lending, Credit Origination, Underwriting, MoUs & Regulatory context.
 * Strictly blocks Deposits, Fixed Deposits, FCNR, Forex, Insurance, and Merchant Discounts.
 */

// 1. Core Digital Lending & Credit Origination Terms (Must contain genuine credit context)
const LENDING_CORE_TERMS = [
  "lending", "loan", "loans", "credit", "underwriting", "origination", "los", "lms", 
  "disbursement", "borrower", "borrowers", "bre", "business rules engine", "stp", 
  "straight through processing", "co-lending", "colending", "nbfc", "fintech lender",
  "msme lending", "sme lending", "working capital", "cashflow lending", "cash flow lending",
  "account aggregator", "uli", "unified lending interface", "treds", "supply chain finance",
  "invoice discounting", "lap", "loan against property", "home loan", "home loans",
  "gold loan", "gold loans", "ev finance", "vehicle finance", "auto loan", "commercial vehicle",
  "embedded finance", "embedded credit", "credit line", "credit lines", "bnpl", "fldg",
  "first loss default", "delinquency", "npa", "dpd", "collections", "recovery", "bureau",
  "cibil", "experian", "crif", "credit policy", "credit committee", "credit officer",
  "chief credit officer", "cro", "credit risk", "credit evaluation", "loan portfolio"
];

// 2. Strategic MOUs, Partnerships & New Ventures (Must be in a lending/credit/fintech infrastructure context)
const STRATEGIC_VENTURE_TERMS = [
  "mou", "partnership", "partnered", "partnering", "collaboration", "collaborated", 
  "joint venture", "tie-up", "strategic alliance", "consortium", "co-origination",
  "co-lending arrangement", "digital lending platform", "launched new lending", 
  "credit infrastructure", "rules engine integration"
];

// 3. Regulatory & Policy Terms (RBI, ULI, DPDP, Digital Lending Directives)
const REGULATORY_TERMS = [
  "rbi", "reserve bank of india", "digital lending guidelines", "dlg", "fldg guidelines",
  "kfs", "key fact statement", "first loss default guarantee", "regulatory framework",
  "credit compliance", "sro-ft", "monetary policy committee", "priority sector lending", "psl"
];

// 4. STRICT BLACKLIST / REJECTION TRIGGERS
// Posts matching these retail liabilities, deposits, forex, or marketing promotions are DROPPED IMMEDIATELY.
const STRICT_EXCLUSION_PATTERNS = [
  // Deposits & Liabilities
  /\bfcnr\b/i, /\bfcnr\s*\(b\)/i, /\bfixed\s*deposit/i, /\bfd\s*rates?\b/i, /\brecurring\s*deposit/i,
  /\bterm\s*deposit/i, /\bsavings\s*account/i, /\bsavings\s*interest/i, /\bsalary\s*account/i,
  /\bcurrent\s*account\s*deposit/i, /\bforeign\s*currency\s*savings\b/i, /\bnri\s*banking\b/i,
  /\bnri\s*deposit/i, /\bnre\s*account/i, /\bnro\s*account/i, /\bremittance\b/i, /\bforex\s*card/i,
  
  // Wealth Management & Insurance
  /\blife\s*insurance\b/i, /\bhealth\s*insurance\b/i, /\bterm\s*insurance\b/i, /\bmutual\s*funds?\b/i,
  /\bsip\s*investment/i, /\bwealth\s*management\b/i, /\bportfolio\s*management\b/i, /\bdemat\b/i,
  
  // Card Merchant Offers / Cashbacks / Consumer Ads
  /\bswiggy\s*offer\b/i, /\bzomato\s*discount\b/i, /\bdining\s*delights?\b/i, /\bmovie\s*ticket/i,
  /\bcashback\s*on\s*shopping\b/i, /\breward\s*points?\s*promo/i, /\bflat\s*\d+%\s*off\b/i,
  
  // Social & Non-Business Fluff
  /\bhappy\s*(diwali|holi|new year|republic day|independence day|eid|christmas|navratri)\b/i,
  /\bfun\s*friday\b/i, /\bcricket\s*tournament\b/i, /\bannual\s*sports\s*day\b/i, /\bmarathon\s*run\b/i
];

function evaluatePostContext(postText) {
  if (!postText || postText.length < 35) {
    return { isRelevant: false, reason: "Too short or empty" };
  }

  const textLower = postText.toLowerCase();

  // 1. Check Hard Blacklist (Deposits, FCNR, Forex, Insurance, Swiggy/Zomato Ads)
  for (const pattern of STRICT_EXCLUSION_PATTERNS) {
    if (pattern.test(postText)) {
      // Allow only if there is an overwhelming explicit LOS / lending tech discussion
      const hasExplicitLOS = /\b(los|lms|bre|business rules engine|co-lending|underwriting engine)\b/i.test(postText);
      if (!hasExplicitLOS) {
        return { 
          isRelevant: false, 
          reason: `Filtered out non-lending retail product / deposit promotion (${pattern.toString()})` 
        };
      }
    }
  }

  // 2. Check Strong Lending Core Terms
  const hasLendingTerm = LENDING_CORE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(textLower);
  });

  // 3. Check Strategic Venture / MoU Context
  const hasVentureTerm = STRATEGIC_VENTURE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(textLower);
  });

  // 4. Check Regulatory / RBI Context
  const hasRegulatoryTerm = REGULATORY_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(textLower);
  });

  // 5. Must satisfy genuine credit origination / lending / fintech infra criteria
  if (hasLendingTerm || hasVentureTerm || hasRegulatoryTerm) {
    let postTypeBadge = "⚡ Digital Lending & LOS";
    if (hasVentureTerm) {
      postTypeBadge = "🤝 Strategic MOU / Partnership";
    } else if (hasRegulatoryTerm) {
      postTypeBadge = "📜 Regulatory & Policy Update";
    }

    return {
      isRelevant: true,
      postTypeBadge,
      hasLendingContext: hasLendingTerm,
      hasVentureContext: hasVentureTerm,
      hasRegulatoryContext: hasRegulatoryTerm
    };
  }

  return { isRelevant: false, reason: "Lacks digital lending, credit origination, or policy context" };
}

module.exports = {
  evaluatePostContext
};
