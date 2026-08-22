/**
 * Strict Semantic Gatekeeper & Noise Filter (V2 Enterprise Grade)
 * Calibrated specifically for Sriram Ganesan (Head of LOS Product & Solutions | M2P Fintech)
 * 
 * Enforces deep relevance for Enterprise LOS, LMS, BRE, Co-lending, MSME cashflow underwriting,
 * ULI/AA, RBI DLG/FLDG, and credit governance.
 * 
 * Strictly eliminates all false positives:
 * - Retail liabilities & deposits (Fixed Deposits, FDs, FCNR, FCNR(B), RD, Savings rates, Forex)
 * - Retail rewards, marketing promos, cashback offers, "Loan Utsav" gimmicks
 * - Wealth management, Insurance (life, health, general), Mutual funds, SIPs, Demat
 * - HR fluff, hiring alerts, job promotions, work anniversaries, campus recruitment
 * - Non-lending CSR, carbon accounting, cricket tournaments, festival greetings
 * - Non-lending generic partnerships without credit/origination context
 */

// 0. HTML Stripper and Entity Sanitizer
function stripHtmlAndEntities(str) {
  if (!str) return "";
  let clean = str
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean;
}

// 1. STRICT EXCLUSION PATTERNS (HARD BLACKLIST)
const STRICT_EXCLUSION_PATTERNS = [
  // 1a. Retail Deposits & Liabilities
  { regex: /\bfcnr(?:\s*\(b\))?\b/i, reason: "FCNR / Foreign Currency Deposit" },
  { regex: /\bfixed\s*deposits?\b/i, reason: "Fixed Deposit" },
  { regex: /\bfd\s*(?:rates?|interest|tenure|calculator|schemes?)\b/i, reason: "FD Interest Rate / Scheme" },
  { regex: /\brecurring\s*deposits?\b/i, reason: "Recurring Deposit (RD)" },
  { regex: /\bterm\s*deposits?\b/i, reason: "Term Deposit" },
  { regex: /\bsavings\s*(?:account|interest\s*rate|rates?|balance)\b/i, reason: "Savings Account / Interest Rate" },
  { regex: /\bsalary\s*accounts?\b/i, reason: "Salary Account Promotion" },
  { regex: /\bcurrent\s*account\s*deposits?\b/i, reason: "Current Account Deposit" },
  { regex: /\bforeign\s*currency\s*savings\b/i, reason: "Foreign Currency Savings" },
  { regex: /\bnri\s*(?:banking|deposits?|accounts?|remittances?)\b/i, reason: "NRI Banking / Deposit" },
  { regex: /\bnre\s*accounts?\b/i, reason: "NRE Account" },
  { regex: /\bnro\s*accounts?\b/i, reason: "NRO Account" },
  { regex: /\bremittance\b/i, reason: "Remittance Transfer" },
  { regex: /\bforex\s*(?:card|transfer|rate|trading)\b/i, reason: "Forex Card / Retail Forex" },

  // 1b. Wealth Management, Investments & Insurance
  { regex: /\b(?:life|health|term|motor|general|travel)\s*insurance\b/i, reason: "Insurance Product" },
  { regex: /\bmutual\s*funds?\b/i, reason: "Mutual Funds" },
  { regex: /\bsip\s*(?:investment|plans?|journey|calculator)\b/i, reason: "SIP / Systematic Investment" },
  { regex: /\bwealth\s*management\b/i, reason: "Wealth Management" },
  { regex: /\bportfolio\s*management\b/i, reason: "Portfolio Management (PMS)" },
  { regex: /\bdemat\s*accounts?\b/i, reason: "Demat / Stock Trading" },
  { regex: /\btrading\s*accounts?\b/i, reason: "Trading Account" },
  { regex: /\bcrypto(?:currency)?\b/i, reason: "Cryptocurrency" },
  { regex: /\bstock\s*(?:tips|trading|broking)\b/i, reason: "Stock Broking / Equities" },
  { regex: /\bulip\b/i, reason: "ULIP Insurance Scheme" },
  { regex: /\bannuity\s*plans?\b/i, reason: "Annuity / Pension Scheme" },

  // 1c. Retail Consumer Offers, Marketing Promos & Loyalty Rewards
  { regex: /\bswiggy\b/i, reason: "Swiggy Merchant Discount" },
  { regex: /\bzomato\b/i, reason: "Zomato Merchant Discount" },
  { regex: /\bdining\s*delights?\b/i, reason: "Dining Discount Promo" },
  { regex: /\bmovie\s*tickets?\b/i, reason: "Movie Ticket Offer" },
  { regex: /\bcashbacks?\b/i, reason: "Retail Cashback Promo" },
  { regex: /\breward\s*points?\s*promo\b/i, reason: "Card Reward Points Promo" },
  { regex: /\bflat\s*\d+%\s*off\b/i, reason: "Retail Shopping Discount" },
  { regex: /\bwin\s*(?:rewards?|vouchers?|iphone|gold|cash|prizes?)\b/i, reason: "Retail Contest / Giveaway" },
  { regex: /\bscratch\s*cards?\b/i, reason: "Scratch Card Gamification" },
  { regex: /\bloan\s*utsav\b/i, reason: "Retail Loan Utsav / Marketing Gimmick" },
  { regex: /\bfestive\s*(?:bonanza|offers?|discounts?|utsav)\b/i, reason: "Festive Marketing Bonanza" },
  { regex: /\bshopping\s*festival\b/i, reason: "Shopping Festival Ad" },
  { regex: /\bdiscount\s*coupons?\b/i, reason: "Discount Coupon Promo" },
  { regex: /\bget\s*rewards?\s*worth\b/i, reason: "Consumer Reward Offer" },
  { regex: /\bamazon\s*voucher\b/i, reason: "Amazon Voucher Promo" },
  { regex: /\bflipkart\s*voucher\b/i, reason: "Flipkart Voucher Promo" },

  // 1d. HR Fluff, Hiring, Campus Recruitment & Social Greetings
  { regex: /\bwe\s*are\s*hiring\b/i, reason: "Hiring Announcement" },
  { regex: /\bhiring\s*alert\b/i, reason: "Hiring Alert" },
  { regex: /\bjoin\s*our\s*team\b/i, reason: "Recruitment Fluff" },
  { regex: /\bopen\s*positions?\b/i, reason: "Job Opening" },
  { regex: /\bjob\s*openings?\b/i, reason: "Job Opening" },
  { regex: /\bcampus\s*recruitment\b/i, reason: "Campus Recruitment" },
  { regex: /\binternship\s*(?:batch|hiring|program)\b/i, reason: "Internship Program" },
  { regex: /\bcongratulat(?:ions?|ing)\s*(?:on\s*completing|to\s*all|the\s*winners?|our\s*team)\b/i, reason: "Social Congratulatory Fluff" },
  { regex: /\bwork\s*anniversary\b/i, reason: "Work Anniversary" },
  { regex: /\bfarewell\b/i, reason: "Office Farewell" },
  { regex: /\bteam\s*(?:lunch|outing|dinner|bonding|picnic)\b/i, reason: "Team Outing / Social" },
  { regex: /\bhappy\s*(?:diwali|holi|new\s*year|republic\s*day|independence\s*day|eid|christmas|navratri|pongal|onam|dusserah)\b/i, reason: "Festival Greeting" },
  { regex: /\bfun\s*friday\b/i, reason: "Fun Friday / Office Culture" },
  { regex: /\bcricket\s*tournament\b/i, reason: "Sports Event" },
  { regex: /\bannual\s*sports\s*day\b/i, reason: "Sports Day" },
  { regex: /\bmarathon\s*run\b/i, reason: "Marathon / Fun Run" },
  { regex: /\boffice\s*celebrations?\b/i, reason: "Office Celebration" },

  // 1e. Non-Lending CSR, Carbon Accounting & ESG Fluff
  { regex: /\bcarbon\s*accounting\b/i, reason: "Non-Lending Carbon Accounting" },
  { regex: /\bemission\s*measurements?\b/i, reason: "Non-Lending Carbon Emissions" },
  { regex: /\btree\s*plantations?\b/i, reason: "CSR Tree Plantation" },
  { regex: /\bblood\s*donation\b/i, reason: "CSR Blood Donation" },
  { regex: /\bcsr\s*activity\b/i, reason: "General CSR Fluff" }
];

// 2. POSITIVE DOMAIN DEFINITIONS (Sriram Ganesan Core Lending Pillars)
const DOMAIN_PILLARS = [
  {
    key: "enterprise_los_bre",
    badge: "⚡ Enterprise LOS & BRE Architecture",
    patterns: [
      /\blos\b/i,
      /\blms\b/i,
      /\bbre\b/i,
      /\bloan\s*origination\s*(?:system|platform|engine)?\b/i,
      /\bloan\s*management\s*system\b/i,
      /\bbusiness\s*rules?\s*engine\b/i,
      /\brules?\s*engine\b/i,
      /\bcredit\s*decisioning\b/i,
      /\bdecision\s*engine\b/i,
      /\bunderwriting\s*engine\b/i,
      /\bstraight[\s-]through\s*processing\b/i,
      /\bstp\s*origination\b/i,
      /\bmodular\s*lending\b/i,
      /\borigination\s*architecture\b/i,
      /\bcredit\s*scorecard\b/i,
      /\bpolicy\s*automation\b/i
    ]
  },
  {
    key: "co_lending_fldg",
    badge: "🤝 Co-Lending & FLDG Governance",
    patterns: [
      /\bco[\s-]lending\b/i,
      /\bcolending\b/i,
      /\bco[\s-]origination\b/i,
      /\bclm\b/i,
      /\btripartite\s*escrow\b/i,
      /\bdefault\s*loss\s*guarantee\b/i,
      /\bdlg\b/i,
      /\bfldg\b/i,
      /\bfirst\s*loss\s*default\b/i,
      /\brisk\s*sharing\s*ratio\b/i,
      /\bco[\s-]lending\s*arrangement\b/i,
      /\bbank[\s-]nbfc\s*co[\s-]lending\b/i
    ]
  },
  {
    key: "msme_cashflow_scf",
    badge: "🏭 MSME Cashflow & SCF Underwriting",
    patterns: [
      /\bmsme\s*(?:lending|credit|loan|origination|finance)\b/i,
      /\bsme\s*(?:lending|credit|loan)\b/i,
      /\bcashflow\s*(?:lending|underwriting|based\s*credit)\b/i,
      /\bcash\s*flow\s*(?:lending|underwriting)\b/i,
      /\bgst\s*(?:underwriting|telemetry|analytics|data|filing|reconciliation)\b/i,
      /\bsupply\s*chain\s*finance\b/i,
      /\bscf\b/i,
      /\binvoice\s*discounting\b/i,
      /\btreds\b/i,
      /\bworking\s*capital\s*(?:loan|limit|facility|cycle|origination)\b/i,
      /\bvendor\s*financing\b/i,
      /\banchor[\s-]led\s*financing\b/i
    ]
  },
  {
    key: "dpi_uli_aa",
    badge: "🇮🇳 DPI: ULI & Account Aggregator",
    patterns: [
      /\buli\b/i,
      /\bunified\s*lending\s*interface\b/i,
      /\baccount\s*aggregator\b/i,
      /\bsahamati\b/i,
      /\bocen\b/i,
      /\bopen\s*credit\s*enablement\b/i,
      /\bconsent[\s-]based\s*data\b/i,
      /\bdigital\s*public\s*infrastructure\b/i,
      /\bdpi\s*(?:in\s*credit|lending)?\b/i,
      /\bfinancial\s*information\s*provider\b/i,
      /\bfip\b/i,
      /\bfiu\b/i
    ]
  },
  {
    key: "rbi_regulatory_policy",
    badge: "📜 RBI Directives & Credit Governance",
    patterns: [
      /\brbi\b/i,
      /\breserve\s*bank\s*of\s*india\b/i,
      /\bdigital\s*lending\s*guidelines\b/i,
      /\bkfs\b/i,
      /\bkey\s*fact\s*statement\b/i,
      /\bannual\s*percentage\s*rate\b/i,
      /\bcredit\s*policy\b/i,
      /\bcredit\s*risk\s*committee\b/i,
      /\bcapital\s*adequacy\b/i,
      /\bsro[\s-]ft\b/i,
      /\bmaster\s*directions?\s*on\s*lending\b/i,
      /\bpriority\s*sector\s*lending\b/i,
      /\bpsl\s*targets?\b/i,
      /\bcredit\s*cost\s*discipline\b/i,
      /\bnpa\s*provisioning\b/i
    ]
  },
  {
    key: "multi_asset_microfinance",
    badge: "🌾 Multi-Asset & Microfinance",
    patterns: [
      /\bmicrofinance\b/i,
      /\bnbfc[\s-]mfi\b/i,
      /\bjlg\b/i,
      /\bjoint\s*liability\s*group\b/i,
      /\bhousehold\s*income\s*limit\b/i,
      /\bborrower\s*indebtedness\b/i,
      /\blap\b/i,
      /\bloan\s*against\s*property\b/i,
      /\bmortgage\s*origination\b/i,
      /\bhousing\s*finance\b/i,
      /\bgold\s*loans?\b/i,
      /\bev\s*financ(?:e|ing)\b/i,
      /\bvehicle\s*financ(?:e|ing)\b/i,
      /\bcommercial\s*vehicle\s*loan\b/i,
      /\bauto\s*loan\b/i
    ]
  },
  {
    key: "npa_asset_quality_recovery",
    badge: "🚨 NPA & Debt Resolution",
    patterns: [
      /\bnpa\b/i,
      /\bnon[\s-]performing\s*assets?\b/i,
      /\bgross\s*npa\b/i,
      /\bnet\s*npa\b/i,
      /\bgnpa\b/i,
      /\bnnpa\b/i,
      /\bbad\s*loans?\b/i,
      /\bstressed\s*assets?\b/i,
      /\basset\s*quality\b/i,
      /\bprovision\s*coverage\s*(?:ratio|pcr)?\b/i,
      /\bslippages?\b/i,
      /\bsma[\s-][012]\b/i,
      /\bspecial\s*mention\s*accounts?\b/i,
      /\bwilful\s*defaulters?\b/i,
      /\bdebt\s*recovery\b/i,
      /\bdrt\b/i,
      /\bsarfaesi\b/i,
      /\bnclt\b/i,
      /\binsolvency\b/i,
      /\bbankruptcy\b/i,
      /\bibc\b/i,
      /\bdebt\s*resolution\b/i,
      /\brestructuring\b/i,
      /\bone[\s-]time\s*settlement\b/i,
      /\bots\b/i,
      /\barc\b/i,
      /\basset\s*reconstruction\b/i,
      /\bbad\s*bank\b/i,
      /\bwrite[\s-]offs?\b/i,
      /\bloan\s*defaults?\b/i,
      /\bloan\s*frauds?\b/i
    ]
  },
  {
    key: "credit_growth_macro_liquidity",
    badge: "📊 Credit Growth & Banking Dynamics",
    patterns: [
      /\bcredit\s*growth\b/i,
      /\bloan\s*growth\b/i,
      /\bdisbursements?\b/i,
      /\bsanctions?\b/i,
      /\bloan\s*book\b/i,
      /\baum\s*growth\b/i,
      /\bcost\s*of\s*funds\b/i,
      /\bnet\s*interest\s*margin\b/i,
      /\bnim\b/i,
      /\brepo\s*rate\b/i,
      /\bmclr\b/i,
      /\beblr\b/i,
      /\brisk\s*weights?\b/i,
      /\bunsecured\s*credit\b/i,
      /\bunsecured\s*lending\b/i,
      /\bcapital\s*adequacy\b/i,
      /\bcrar\b/i,
      /\btier[\s-]1\s*capital\b/i,
      /\bcredit[\s-]to[\s-]deposit\s*ratio\b/i,
      /\bcd\s*ratio\b/i,
      /\bliquidity\s*coverage\s*ratio\b/i,
      /\blcr\b/i
    ]
  },
  {
    key: "retail_corporate_lending_products",
    badge: "💳 Retail & Wholesale Lending",
    patterns: [
      /\bpersonal\s*loans?\b/i,
      /\bhome\s*loans?\b/i,
      /\bmortgages?\b/i,
      /\blap\b/i,
      /\bloan\s*against\s*property\b/i,
      /\bgold\s*loans?\b/i,
      /\beducation\s*loans?\b/i,
      /\bauto\s*loans?\b/i,
      /\bvehicle\s*finance\b/i,
      /\bev\s*loans?\b/i,
      /\bcommercial\s*vehicle\s*finance\b/i,
      /\bcorporate\s*lending\b/i,
      /\bwholesale\s*lending\b/i,
      /\bsyndicated\s*loans?\b/i,
      /\bconsortium\s*lending\b/i,
      /\bproject\s*finance\b/i,
      /\binfrastructure\s*loans?\b/i,
      /\bstructured\s*finance\b/i,
      /\bmezzanine\s*debt\b/i,
      /\bcredit\s*bureau\b/i,
      /\bcibil\b/i,
      /\bexperian\b/i,
      /\bcrif\b/i,
      /\bequifax\b/i
    ]
  },
  {
    key: "credit_leadership_cco",
    badge: "👔 Credit Leadership & Governance",
    patterns: [
      /\bchief\s*credit\s*officer\b/i,
      /\bcco\b/i,
      /\bchief\s*risk\s*officer\b/i,
      /\bcro\b/i,
      /\bhead\s*of\s*credit\b/i,
      /\bcredit\s*underwriter\b/i,
      /\bcredit\s*committee\b/i,
      /\bcentralized\s*credit\s*architecture\b/i
    ]
  }
];

// 3. Strategic Partnership / MOU Triggers
const STRATEGIC_VENTURE_TERMS = [
  /\bmou\b/i,
  /\bpartnership\b/i,
  /\bpartnered\b/i,
  /\bpartnering\b/i,
  /\bcollaboration\b/i,
  /\bcollaborated\b/i,
  /\bjoint\s*venture\b/i,
  /\btie[\s-]up\b/i,
  /\bstrategic\s*alliance\b/i,
  /\bco[\s-]origination\s*agreement\b/i,
  /\bco[\s-]lending\s*partnership\b/i,
  /\bplatform\s*launch\b/i
];

/**
 * Evaluates a post for Sriram Ganesan's LinkedIn Lending Intelligence Agent.
 * Strips HTML, applies strict exclusion filters, and matches against core domain pillars.
 * 
 * @param {string} rawPostText 
 * @param {string} sourceName 
 * @param {string} sourceCategory 
 * @returns {object} { isRelevant, isValid, postTypeBadge, primaryDomain, matchedKeywords, cleanedText, reason }
 */
function evaluatePostContext(rawPostText, sourceName = "", sourceCategory = "") {
  const cleanedText = stripHtmlAndEntities(rawPostText);
  if (!cleanedText || cleanedText.length < 35) {
    return { isRelevant: false, isValid: false, reason: "Too short or empty after sanitization" };
  }

  // 1. Hard Exclusion / Blacklist Check
  for (const { regex, reason } of STRICT_EXCLUSION_PATTERNS) {
    if (regex.test(cleanedText)) {
      // Exception: allow ONLY if there is explicit, overwhelming Enterprise LOS / Core Lending tech context
      const hasOverwhelmingLOS = /\b(los|lms|bre|business\s*rules\s*engine|co[\s-]lending|underwriting\s*engine|loan\s*origination\s*system)\b/i.test(cleanedText);
      if (!hasOverwhelmingLOS) {
        return {
          isRelevant: false,
          isValid: false,
          reason: `Filtered out: ${reason} (${regex.toString()})`
        };
      }
    }
  }

  // 2. Check Positive Domain Pillars
  const matchedPillars = [];
  const matchedKeywords = [];

  for (const pillar of DOMAIN_PILLARS) {
    for (const pattern of pillar.patterns) {
      if (pattern.test(cleanedText)) {
        if (!matchedPillars.some(p => p.key === pillar.key)) {
          matchedPillars.push(pillar);
        }
        const matchStr = cleanedText.match(pattern);
        if (matchStr && !matchedKeywords.includes(matchStr[0].toLowerCase())) {
          matchedKeywords.push(matchStr[0].toLowerCase());
        }
      }
    }
  }

  // 3. Strategic Partnership / MOU Check
  const hasVentureTerm = STRATEGIC_VENTURE_TERMS.some(pattern => pattern.test(cleanedText));
  if (hasVentureTerm) {
    // A partnership is ONLY valid if it ALSO matches at least one lending/credit domain pillar!
    if (matchedPillars.length === 0) {
      return {
        isRelevant: false,
        isValid: false,
        reason: "Filtered out: Generic partnership/MOU lacking digital lending or credit infrastructure context"
      };
    }
  }

  // 4. Final Evaluation
  if (matchedPillars.length > 0) {
    let primaryBadge = matchedPillars[0].badge;
    if (hasVentureTerm && !matchedPillars.some(p => p.key === "co_lending_fldg")) {
      primaryBadge = "🤝 Strategic Lending Partnership";
    }

    return {
      isRelevant: true,
      isValid: true,
      postTypeBadge: primaryBadge,
      primaryDomain: matchedPillars[0].key,
      matchedKeywords: matchedKeywords.slice(0, 6),
      cleanedText
    };
  }

  return {
    isRelevant: false,
    isValid: false,
    reason: "Lacks digital lending, enterprise LOS, credit underwriting, or regulatory policy context"
  };
}

module.exports = {
  evaluatePostContext,
  stripHtmlAndEntities,
  DOMAIN_PILLARS,
  STRICT_EXCLUSION_PATTERNS
};
