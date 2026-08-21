/**
 * Intelligent Priority & Relevance Scoring Engine
 * Calibrated for Sriram Ganesan (Head of LOS Product & Product Solutions, M2P Fintech)
 */

const HIGH_PRIORITY_KEYWORDS = [
  { term: "los", weight: 25, tag: "LOS Architecture" },
  { term: "loan origination", weight: 25, tag: "LOS" },
  { term: "bre", weight: 20, tag: "Rules Engine" },
  { term: "business rules", weight: 20, tag: "Rules Engine" },
  { term: "underwriting", weight: 20, tag: "Underwriting" },
  { term: "cashflow", weight: 18, tag: "Cashflow Underwriting" },
  { term: "account aggregator", weight: 18, tag: "Account Aggregator" },
  { term: "uli", weight: 20, tag: "Unified Lending Interface" },
  { term: "co-lending", weight: 18, tag: "Co-Lending" },
  { term: "stp", weight: 15, tag: "STP Origination" },
  { term: "straight-through", weight: 15, tag: "STP" },
  { term: "msme", weight: 15, tag: "MSME Lending" },
  { term: "supply chain finance", weight: 15, tag: "SCF" },
  { term: "treds", weight: 15, tag: "TReDS" },
  { term: "lap", weight: 12, tag: "LAP / Mortgages" },
  { term: "gold loan", weight: 12, tag: "Gold Loans" },
  { term: "ev finance", weight: 14, tag: "EV Financing" },
  { term: "vehicle finance", weight: 12, tag: "Vehicle Finance" },
  { term: "governance", weight: 15, tag: "Tech Governance" },
  { term: "rbi", weight: 16, tag: "RBI Regulations" },
  { term: "dlg", weight: 18, tag: "Digital Lending Guidelines" },
  { term: "fldg", weight: 18, tag: "FLDG Compliance" },
  { term: "credit policy", weight: 18, tag: "Credit Policy" },
  { term: "api", weight: 10, tag: "API Infrastructure" },
  { term: "fintech", weight: 8, tag: "Fintech" }
];

const SOURCE_TIER_WEIGHTS = {
  "M2P LOS Competitors & Tech": 25,
  "Regulatory & Industry Bodies": 25,
  "Industry Media & Communities": 20,
  "Incumbent Banks & SFBs": 18,
  "NBFCs & Retail/Gold/Vehicle Lenders": 18,
  "Supply Chain Finance (SCF) & TReDS": 18,
  "Top 50 Digital Lending Influencers": 20,
  "Digital Lending Fintechs & BNPL": 15,
  "Data, KYC, AI Underwriting & Collections": 15,
  "Credit Bureaus & Market Infrastructure": 12
};

function calculateRelevance(postText, sourceCategory, sourceName, authorName) {
  const textLower = (postText || "").toLowerCase();
  let score = 30; // base score
  const matchedTags = [];

  // 1. Keyword Relevance Score
  HIGH_PRIORITY_KEYWORDS.forEach(({ term, weight, tag }) => {
    if (textLower.includes(term)) {
      score += weight;
      if (!matchedTags.includes(tag)) matchedTags.push(tag);
    }
  });

  // 2. Source Tier Weight
  const tierWeight = SOURCE_TIER_WEIGHTS[sourceCategory] || 10;
  score += tierWeight;

  // 3. Competitor / Regulator Special Boost
  const sLower = (sourceName || "").toLowerCase() + " " + (authorName || "").toLowerCase();
  if (sLower.includes("rbih") || sLower.includes("reserve bank") || sLower.includes("perfios") || sLower.includes("lentra") || sLower.includes("nucleus") || sLower.includes("etbfsi")) {
    score += 10;
  }

  // Cap score between 35 and 99
  score = Math.min(Math.max(score, 35), 99);

  // Impact Level & Badge
  let impactBadge = "💡 Regular Impact";
  let badgeColor = "secondary";
  let priorityRank = "Standard";

  if (score >= 85) {
    impactBadge = "🔥 Top Priority (High LOS / Strategic Relevance)";
    badgeColor = "danger";
    priorityRank = "Top";
  } else if (score >= 70) {
    impactBadge = "⭐ High Impact (Domain Match)";
    badgeColor = "warning";
    priorityRank = "High";
  } else if (score >= 50) {
    impactBadge = "📌 Moderate Relevance";
    badgeColor = "info";
    priorityRank = "Medium";
  }

  return {
    priority_score: score,
    impact_badge: impactBadge,
    badge_color: badgeColor,
    priority_rank: priorityRank,
    relevance_tags: matchedTags.slice(0, 4)
  };
}

module.exports = {
  calculateRelevance
};
