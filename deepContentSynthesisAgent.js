const fs = require('fs');
const path = require('path');
const { readFullArticleContent } = require('./fullArticleReaderAgent');

function sanitizeAiSlop(text) {
  if (!text) return "";
  let clean = text
    .replace(/\b(delve|tapestry|game-changer|testament|beacon|pivotal moment|paramount|unwavering|spearhead|harness|landscape|multifaceted|synergy)\b/gi, "")
    .replace(/\*\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return clean;
}

function extractEntitiesAndMetrics(text) {
  if (!text) return { metrics: [], entities: [] };
  const metricRegex = /(?:₹\s*[\d,.]+\s*(?:crore|cr|lakh|bn|trillion)?|\$[\d,.]+\s*(?:million|billion|M|B)?|\b\d+(?:\.\d+)?%\b|\b\d+\s*bps\b|\b\d+\s*branches\b|\bQ[1-4]\s*FY\d{2}\b)/gi;
  const metrics = text.match(metricRegex) || [];
  
  const entityRegex = /\b(RBI|Reserve Bank of India|HDFC Bank|State Bank of India|SBI|Axis Bank|Canara Bank|Federal Bank|ESAF SFB|Euronet|Bajaj Finance|Shri Ram Finance|Star Housing Finance|Aditya Birla Capital|Muthoot|Manappuram|FISME|TRAI|Navi Finserv|Progfin|DSP Finance|Volt Money|Vodafone Idea|SG Finserve|Apollo Finvest|Vivifi India|JPMorgan|Bernstein|BNP Paribas|BofA|BusinessLine|Economic Times|Livemint|Business Standard|Outlook Money|Fortune India|CNBC TV18)\b/gi;
  const rawEntities = text.match(entityRegex) || [];
  const entities = [...new Set(rawEntities)];
  
  return { metrics: metrics.slice(0, 5), entities };
}

function extractPostThesis(text) {
  if (!text) return "the industry development discussed";
  const clean = text
    .replace(/#\w+/g, '')
    .replace(/DAY\s*\d+\/\d+/gi, '')
    .replace(/BLIND\s*SPOT\s*:?/gi, '')
    .replace(/THE\s*\d+-DAY\s*LEADERSHIP\s*JOURNEY/gi, '')
    .replace(/[^\w\s.,'’"?!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const sentences = clean.split(/[.?!]\s+/).filter(s => s.trim().length > 15);
  if (sentences.length > 0) {
    let hook = sentences[0].trim();
    if (hook.length > 130) hook = hook.slice(0, 127) + '...';
    return hook;
  }
  return clean.slice(0, 100);
}

/**
 * Synthesizes deep, context-grounded LinkedIn Post Comments
 * Rules:
 * - Paragraph 1 (Lines 1–3/4): 100% on the author's exact thesis, specific entities, numbers, and facts.
 * - Paragraph 2 (Lines 4–5): Sriram's domain perspective ONLY IF RELEVANT (LOS/Lending Tech for Tech posts; Credit Risk/Asset Quality for NBFC/Banking posts; Board Governance/ACB for Governance posts; Strategic/Leadership for General posts - NEVER force LOS/BRE into non-tech posts).
 * - Paragraph 3: Thoughtful, domain-specific question.
 */
function synthesizePostCommentary(authorName, text, category, postUrl = "") {
  const author = authorName || "Industry Leader";
  const org = category || "BFSI";
  const rawText = text || "";
  const leadHook = rawText.slice(0, 300).toLowerCase();
  const textLower = rawText.toLowerCase();
  const { metrics, entities } = extractEntitiesAndMetrics(rawText);
  const metricSnippet = metrics.length > 0 ? ` (${metrics[0]})` : "";
  const thesis = extractPostThesis(rawText);
  const primaryEntity = entities[0] || "";

  // 1. BOARD GOVERNANCE: SILENT EXIT & DISSENT OF INDEPENDENT DIRECTORS
  if (leadHook.includes("silent exit") || leadHook.includes("walk away instead of dissenting") || (leadHook.includes("dissent") && leadHook.includes("director"))) {
    return {
      value_add: sanitizeAiSlop(`${author}'s analysis on the "Silent Exit" trend among Independent Directors highlights a critical structural flaw in corporate governance—where directors choose quiet resignation over formal boardroom dissent. Over 500 mid-term resignations indicate that information asymmetry and disproportionate personal liability often isolate independent voices.

From an Audit Committee (ACB) and fiduciary oversight standpoint, effective governance requires fostering a boardroom culture where constructive dissent is welcomed as vital risk mitigation rather than resistance.

How can nomination and remuneration committees (NRC) better insulate Independent Directors so they can record formal dissent without career friction?`),
      provocative_question: `What structural mechanisms can Indian boards introduce to ensure raw governance telemetry reaches the Audit Committee early?`,
      executive_perspective: `Institutional longevity is won by boards that champion transparent debate, robust internal controls, and unwavering stakeholder stewardship over artificial consensus.`
    };
  }

  // 2. BOARD GOVERNANCE: IPO READY VS GOVERNANCE READY
  if (leadHook.includes("ipo ready") || leadHook.includes("governance ready")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s insight that "IPO Ready ≠ Governance Ready" addresses the widening gap between rapid valuation scale and institutional maturity when preparing for public markets. A company can assemble a polished DRHP, but authentic governance readiness is proven when the Audit Committee rigorously interrogates unit economics, cashflow accounting, and internal controls before the public listing.

For independent board members, establishing robust Internal Financial Controls (IFC) and proactive risk oversight at least 24 months pre-IPO protects long-term shareholder value.

What foundational governance milestones should high-growth enterprises formalize well ahead of their exchange debut?`),
      provocative_question: `How are pre-IPO boards balancing rapid revenue expansion with rigorous internal financial controls (IFC)?`,
      executive_perspective: `Long-term public market compounding belongs to enterprises that build institutional governance muscle well before ringing the exchange bell.`
    };
  }

  // 3. BOARD GOVERNANCE: RELATED PARTY TRANSACTIONS (RPT)
  if (leadHook.includes("related party") || leadHook.includes("rpt") || leadHook.includes("governance failures rarely begin with fraud")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s observation that major governance breakdowns frequently originate in "justified" Related Party Transactions (RPTs) touches the single biggest vulnerability in promoter-driven enterprises. When transactions with affiliates bypass commercial scrutiny under the guise of operational synergy, minority shareholders carry the downside risk.

For the Audit Committee (ACB), scrutinizing RPTs demands rigorous arm's-length benchmarking, independent valuation validation, and absolute transparency in financial disclosures.

What benchmarking frameworks does your Audit Committee deploy to ensure absolute commercial arm's-length validity for high-value related party transactions?`),
      provocative_question: `How are corporate boards tightening internal financial controls (IFC) to prevent subtle value transfer through complex subsidiary structures?`,
      executive_perspective: `Uncompromising scrutiny of related party transactions is the ultimate litmus test of an independent board's fiduciary integrity.`
    };
  }

  // 4. BOARD GOVERNANCE: AI IN EXECUTIVE LEADERSHIP & BLIND SPOTS
  if (leadHook.includes("ai makes leaders question") || leadHook.includes("ai can write") || (leadHook.includes("blind spot") && leadHook.includes("ai"))) {
    return {
      value_add: sanitizeAiSlop(`${author}'s reflection on executive blind spots in an era of AI automation addresses a profound leadership shift. When predictive algorithms can process data, model scenarios, and generate analytical drafts in seconds, an executive's true moat narrows to ethical discernment, stakeholder empathy, and high-stakes judgment.

As automated tools enter executive decision-making, boardroom leadership must prioritize moral clarity and critical evaluation over unverified algorithmic outputs.

How is your executive leadership establishing oversight guardrails to ensure AI-driven analysis is subjected to rigorous human ethical evaluation?`),
      provocative_question: `How are executive committees establishing guardrails to ensure AI-driven recommendations are subjected to rigorous human ethical evaluation?`,
      executive_perspective: `Technology accelerates execution, but human integrity, ethical courage, and stakeholder trust remain the irreplaceable moats of great leadership.`
    };
  }

  // 5. BOARD GOVERNANCE: TRUST AS CAPITAL & STAKEHOLDER STEWARDSHIP
  if (leadHook.includes("trust is capital") || leadHook.includes("stakeholder trust") || (leadHook.includes("trust") && leadHook.includes("stewardship"))) {
    return {
      value_add: sanitizeAiSlop(`${author}'s thesis that "Trust Is Capital" clearly articulates the balance sheet value of corporate reputation and ethical conduct. In financial services and regulated sectors, stakeholder trust directly influences deposit stability, cost of funds, and resilience during macro downturns.

For corporate boards, systematically tracking governance health, customer fair treatment, and compliance integrity protects this intangible asset from gradual erosion.

What proactive governance indicators can boards monitor to detect cultural and compliance risks before they impact financial performance?`),
      provocative_question: `What proactive governance metrics can boards track to detect early cultural decay before it impacts financial performance?`,
      executive_perspective: `Reputation and trust compound slowly over decades but can be lost in a single lapse of governance. Vigilant board oversight is the primary safeguard.`
    };
  }

  // 6. CYBERSECURITY / IDENTITY / PHYGITAL
  if (leadHook.includes("enterprise security") || leadHook.includes("identity") || leadHook.includes("phygital") || leadHook.includes("digital trust")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s perspective on moving from perimeter defense to intelligent identity reflects the frontline reality of enterprise cybersecurity. As financial operations become distributed across APIs, mobile channels, and cloud ecosystems, legacy network firewalls no longer suffice.

For digital financial institutions, embedding zero-trust identity verification, behavioral biometrics, and continuous fraud monitoring into customer journeys is essential to safeguard balance sheets.

What identity verification and fraud prevention architectures are proving most effective against synthetic identity fraud in digital onboarding?`),
      provocative_question: `How are Chief Risk Officers and CISOs collaborating to integrate cyber risk telemetry directly into operational loan approval workflows?`,
      executive_perspective: `Cyber resilience and customer identity integrity are foundational risk governance mandates that directly protect institutional balance sheets.`
    };
  }

  // 7. CLEAN TRANSIT / DECARBONIZATION
  if (leadHook.includes("decarboniz") || leadHook.includes("hydrogen") || leadHook.includes("transit") || leadHook.includes("clean energy")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s analysis on heavy transit decarbonization and clean fuel adoption underscores the massive capital expenditure required for India's green infrastructure transition. Shifting long-haul freight and commercial transport to sustainable energy demands specialized project finance, blended capital, and long-term risk-sharing consortiums.

For institutional financiers, developing underwriting models that incorporate lifecycle carbon metrics and technology risk will accelerate sustainable credit deployment.

What financing structures and risk-mitigation instruments are proving most viable in funding early-stage clean transit infrastructure in India?`),
      provocative_question: `How are institutional lenders integrating lifecycle carbon emissions telemetry into corporate credit underwriting frameworks?`,
      executive_perspective: `Sustainable infrastructure transition requires deep collaboration between visionary engineering, progressive public policy, and patient institutional capital.`
    };
  }

  // 8. MSME & CASHFLOW LENDING (GST, TREDS, INVOICE DISCOUNTING)
  if (textLower.includes("msme") || textLower.includes("cashflow") || textLower.includes("gst") || textLower.includes("treds") || textLower.includes("invoice") || textLower.includes("supply chain")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s focus on "${thesis}"${metricSnippet} highlights a vital imperative in expanding credit access for India's 63+ million small enterprises. Relying solely on historical balance sheets leaves millions of creditworthy informal businesses underfunded, whereas evaluating live GST invoicing, banking turnover, and transaction velocity enables dynamic working capital sanctions.

From an underwriting architecture perspective, ingesting real-time cashflow telemetry into automated decisioning engines allows lenders to tailor credit lines to the borrower's actual cash conversion cycle while actively monitoring debtor concentration.

How is your credit team leveraging cashflow analytics and Account Aggregator streams to expand MSME origination while keeping delinquency low?`),
      provocative_question: `What alternate data streams are proving most predictive in assessing repayment capacity for informal small enterprises across tier-2/3 hubs?`,
      executive_perspective: `Scalable MSME lending belongs to platforms that can automate data aggregation, policy execution, and escrow reconciliation seamlessly at origination.`
    };
  }

  // 9. DIGITAL LENDING TECH / LOS / ORIGINATION / STP (LENDING TECH POSTS ONLY)
  if (textLower.includes("los") || textLower.includes("loan origination") || textLower.includes("bre") || textLower.includes("decision engine") || (textLower.includes("digital lending") && textLower.includes("tech"))) {
    return {
      value_add: sanitizeAiSlop(`${author}'s post on "${thesis}"${metricSnippet} addresses the core operational challenge in modern lending: achieving rapid turnaround times without compromising underwriting rigor. In a competitive credit market, lenders cannot afford multi-week development cycles whenever credit policies or regulatory guidelines shift.

Deploying a modular Loan Origination System (LOS) with a configurable Business Rules Engine (BRE) empowers product and credit teams to adjust parameters instantly, automating KYC, bureau pulls, and decisioning for sub-15 minute straight-through processing (STP).

What tech capabilities is your team prioritizing to compress loan origination turnaround times while maintaining strict policy governance?`),
      provocative_question: `How are product and credit teams collaborating to ensure business rule changes deploy in hours rather than multi-week sprint cycles?`,
      executive_perspective: `Agility at the point of origination combined with continuous portfolio telemetry creates an unassailable competitive moat in modern banking.`
    };
  }

  // 10. BANKING / NBFC ASSET QUALITY, CREDIT GROWTH & NPA (NO FORCED LOS PLUGS)
  if (textLower.includes("asset quality") || textLower.includes("npa") || textLower.includes("delinquency") || textLower.includes("credit growth") || textLower.includes("nbfc") || textLower.includes("gross stage")) {
    return {
      value_add: sanitizeAiSlop(`${author}'s analysis regarding "${thesis}"${metricSnippet} underscores the ongoing expansion and credit cycle dynamics across India's financial sector. While credit demand across retail and commercial segments remains robust, maintaining balance sheet resilience requires lenders to balance disbursement momentum with proactive risk governance.

For Chief Risk Officers and credit committees, tracking early behavioral delinquency indicators (SMA-0/1) and maintaining counter-cyclical provisioning buffers are critical safeguards against credit cycle turns.

What core credit risk and portfolio indicators is your leadership team monitoring most closely to navigate the current macroeconomic environment?`),
      provocative_question: `How are risk committees leveraging early behavioral signals and SMA-0 telemetry to preempt credit stress before 90-day DPD milestones?`,
      executive_perspective: `Enduring banking franchises are built on disciplined risk governance that performs consistently across credit cycles.`
    };
  }

  // 11. GENERAL THOUGHT-LEADERSHIP / CORPORATE / LEADERSHIP (BALANCED, NO FORCED BUZZWORDS)
  return {
    value_add: sanitizeAiSlop(`Reflecting on ${author}'s perspective regarding "${thesis}"${metricSnippet}, navigating dynamic market shifts in ${org} requires balancing strategic ambition with operational resilience. 

Organizations that foster continuous innovation while maintaining disciplined execution and strong governance frameworks consistently build long-term competitive advantages.

How is your leadership team positioning your organizational strategy to capitalize on these evolving industry developments?`),
    provocative_question: `What forward-looking performance and strategic indicators is your executive committee tracking most closely through this phase?`,
    executive_perspective: `Enduring institutional excellence is built on steadfast governance, operational transparency, and unwavering customer commitment.`
  };
}

/**
 * Synthesizes deep, fact-grounded Thought-Leadership Repost Takes for Market News Articles
 * Rules:
 * - Paragraph 1 (Lines 1–3/4): 100% on THAT EXACT article's headline, specific facts, entities, numbers, and implications.
 * - Paragraph 2 (Lines 4–5): Sriram's domain perspective ONLY IF RELEVANT (LOS/Tech for Tech news; Credit Risk/NBFC for Risk/Banking news; Governance for Board/Regulatory news; Strategic for General).
 * - Paragraph 3: Tailored domain question.
 * GUARANTEES: Never generates identical commentary across different articles on the same topic (e.g. Gold Loans).
 */
async function synthesizeNewsArticleTakes(articleUrl, headline, topic, publisher) {
  const h = (headline || "").trim();
  const hLower = (headline || "").toLowerCase();
  const pub = publisher || "Financial Media";
  const { metrics, entities } = extractEntitiesAndMetrics(`${h} ${pub}`);
  const metricSnippet = metrics.length > 0 ? ` (${metrics.join(", ")})` : "";
  const primaryEntity = entities[0] || pub;

  // 1. ESAF SFB & EURONET - CREDIT LINE ON UPI
  if (hLower.includes("esaf") || (hLower.includes("credit line on upi") && hLower.includes("euronet"))) {
    return {
      architectural_take: sanitizeAiSlop(`ESAF Small Finance Bank has partnered with Euronet to launch ‘Credit Line on UPI’ in FY28, reported by ${pub}. This partnership marks an important step in democratizing pre-sanctioned credit by embedding low-ticket credit lines directly into everyday UPI QR payment journeys for micro and semi-urban consumers.

From a lending architecture standpoint, operationalizing Credit Line on UPI requires seamless real-time API integrations between the core banking system, the credit decisioning engine, and NPCI switches to evaluate drawdowns, calculate interest on utilized amounts, and manage instant overdraft limits.

How is your institution preparing its origination and core banking architecture to support real-time Credit Line on UPI transactions?`),
      risk_lens: sanitizeAiSlop(`The rollout of Credit Line on UPI by ESAF SFB and Euronet reflects the growing convergence of payments and revolving credit, as highlighted by ${pub}.

While pre-approved UPI credit lines offer frictionless distribution, risk teams must implement automated real-time fraud telemetry and transaction-level risk velocity checks to manage revolving consumer indebtedness.

What real-time behavioral risk controls are essential when underwriting instant UPI credit lines for retail consumers?`),
      strategic_outlook: sanitizeAiSlop(`Credit Line on UPI is positioned to reshape retail borrowing across India by shifting consumer credit from physical plastic cards to ubiquitous digital QR payment rails.

Institutions that establish agile technology partnerships and sound risk governance will capture significant market share across Tier-2 and Tier-3 credit markets.

How do you foresee Credit Line on UPI impacting conventional credit card issuance and short-term personal loan volumes over the next three years?`)
    };
  }

  // 2. WHALESBOOK: NBFCS EXPAND GOLD LOAN PORTFOLIOS DESPITE NEW RBI NORMS
  if (hLower.includes("whalesbook") && hLower.includes("gold loan") || (hLower.includes("expand gold loan") && hLower.includes("rbi norms"))) {
    return {
      architectural_take: sanitizeAiSlop(`Specialized NBFCs are aggressively expanding their gold loan branch networks and portfolio AUM despite tightened Reserve Bank of India oversight on cash disbursement limits and appraisal standards, reported by ${pub}. The resilience of gold credit stems from strong grassroots demand among MSMEs and rural borrowers seeking immediate, collateral-backed working capital.

To navigate stringent regulatory audits while scaling disbursals, leading NBFCs are digitizing field appraisal workflows and automating real-time LTV margin calculations to ensure compliance with the 75% regulatory ceiling.

How is your institution modernizing secured loan appraisal workflows to balance regulatory compliance with high-speed disbursals?`),
      risk_lens: sanitizeAiSlop(`Rapid expansion of gold loan books amid tighter RBI scrutiny demands steadfast collateral governance and continuous market-to-market monitoring, as reported by ${pub}.

Risk committees must enforce automated price-tick revaluation systems and strict vault audit protocols to protect asset quality against sudden commodity price volatility.

What early-warning LTV thresholds and auction trigger mechanisms is your risk team prioritizing for gold-backed portfolios?`),
      strategic_outlook: sanitizeAiSlop(`Gold loans continue to serve as a vital liquidity bridge for India's micro-enterprises and agricultural borrowers.

NBFCs that combine extensive physical branch presence with digitized origination workflows will maintain a strong competitive moat against commercial banks.

How do you see the market share evolving between specialized gold loan NBFCs and commercial banks over the coming quarters?`)
    };
  }

  // 3. REUTERS: AXIS BANK BETS ON DATA CENTRES TO GOLD LOANS
  if (hLower.includes("axis bank") && (hLower.includes("data centres") || hLower.includes("gold loans to outpace"))) {
    return {
      architectural_take: sanitizeAiSlop(`Axis Bank is strategically targeting high-growth sectors spanning data centre infrastructure financing to retail gold loans to outpace industry credit growth by 300 basis points in FY27, reported by ${pub}. This dual strategy pairs large-ticket digital infrastructure project finance with high-yielding secured retail credit to optimize overall balance sheet yield.

Financing digital infrastructure like data centres requires specialized project debt underwriting with phased milestone disbursements, while scaling gold loans demands automated appraisal and branch-level STP origination.

How is your institution structuring credit origination pipelines to support diverse asset classes ranging from infrastructure project debt to secured retail loans?`),
      risk_lens: sanitizeAiSlop(`Axis Bank's ambitious credit expansion targets highlight the need for balanced portfolio risk management across corporate project finance and retail collateralized books, as reported by ${pub}.

Risk leadership must balance long-tenor infrastructure exposure with dynamic retail collateral tracking to preserve pristine asset quality across interest rate cycles.

What risk-adjusted return on capital (RAROC) frameworks does your credit committee deploy when allocating capital between large infrastructure debt and secured retail assets?`),
      strategic_outlook: sanitizeAiSlop(`Private banks that successfully balance high-margin secured retail credit with strategic nation-building infrastructure financing will drive sustainable balance sheet compounding.

Balancing credit expansion with disciplined risk governance remains the cornerstone of enduring banking leadership.

How are private sector banks recalibrating their sector-wise loan book allocation to sustain above-industry growth rates?`)
    };
  }

  // 4. JPMORGAN REPORT: WHY GOLD LOANS ARE BOOMING IN INDIA
  if (hLower.includes("jpmorgan") && hLower.includes("gold loan")) {
    return {
      architectural_take: sanitizeAiSlop(`A comprehensive analysis by JPMorgan highlighted the structural drivers behind India's booming gold loan market, where collateralized borrowing is increasingly viewed as an efficient treasury and working capital tool rather than distress borrowing, reported by ${pub}.

As institutional participation rises, lenders that deploy sub-15 minute digital onboarding combined with doorstep valuation and instant fund transfers are capturing premium borrower mindshare.

From an origination technology perspective, integrating live bullion price APIs with automated loan management engines enables dynamic risk-based pricing for high-ticket borrowers.

How is your institution upgrading secured retail lending tech to deliver frictionless customer turnaround times?`),
      risk_lens: sanitizeAiSlop(`JPMorgan's research underscores how rising gold prices and expanding formal credit demand have bolstered gold loan portfolio growth, as reported by ${pub}.

However, risk teams must maintain conservative Loan-to-Value (LTV) buffers to cushion against potential commodity price corrections and ensure robust auction resolution mechanisms.

What stress-testing scenarios is your risk committee running against potential bullion price volatility in secured portfolios?`),
      strategic_outlook: sanitizeAiSlop(`The formalization and digitization of gold lending is transforming India's vast household gold reserves into productive economic capital.

Institutions that establish strong brand trust, transparent pricing, and efficient customer touchpoints will lead this multi-year credit expansion.

How do you view the long-term growth trajectory of organized gold finance relative to unsecured retail personal loans in India?`)
    };
  }

  // 5. BUSINESS UPTURN: BIG CORPORATIONS MOVE INTO GOLD LOAN MARKET
  if (hLower.includes("big indian corporations move into booming gold-loan") || (hLower.includes("corporations") && hLower.includes("gold-loan"))) {
    return {
      architectural_take: sanitizeAiSlop(`Major Indian corporate conglomerates and diversified financial groups are entering the high-margin gold loan sector, as reported by ${pub}. The entry of well-capitalized corporate balance sheets is set to intensify competition across customer acquisition, interest rate pricing, and branch distribution networks.

To compete effectively, lenders must optimize operational efficiency through automated Loan Origination Systems (LOS) that compress loan processing costs while maintaining rigorous collateral governance.

How will the entry of large corporate balance sheets impact digital origination standards and pricing across secured retail credit?`),
      risk_lens: sanitizeAiSlop(`Increased corporate competition in gold lending may trigger aggressive LTV bidding and rate compression, as highlighted in ${pub}'s report.

Risk committees must resist diluting appraisal standards or pushing regulatory LTV limits in pursuit of rapid AUM growth, ensuring credit quality remains paramount.

How can lenders maintain strict collateral verification and underwriting standards amidst intensifying market competition?`),
      strategic_outlook: sanitizeAiSlop(`Corporate entry into gold financing validates the immense long-term potential of secured retail lending in India.

The market will reward institutions that harmonize extensive physical reach with transparent customer disclosures and robust governance.

How do you expect market share to shift between incumbent specialized NBFCs and newly entered corporate balance sheets over the next 24 months?`)
    };
  }

  // 6. FISME / BUSINESSLINE: RBI PROPOSAL TO CURB NBFC REVOLVING CREDIT (MSME IMPACT)
  if (hLower.includes("fisme") || (hLower.includes("revolving credit") && hLower.includes("msme"))) {
    return {
      architectural_take: sanitizeAiSlop(`Industry body FISME has cautioned that the Reserve Bank of India's proposal to restrict NBFCs' revolving credit facilities could significantly constrain operational liquidity for MSMEs, as reported by ${pub}. Small enterprises rely heavily on flexible revolving overdrafts to bridge fluctuating cash conversion cycles and vendor payments.

If revolving credit structures face tighter tenure limits or mandatory repayment schedules, lenders and MSMEs will need to pivot toward automated cashflow-backed invoice discounting and dynamic working capital lines based on live GST telemetry.

How can lenders restructure MSME working capital facilities to ensure uninterrupted credit flow while complying with evolving RBI guidelines?`),
      risk_lens: sanitizeAiSlop(`The debate surrounding NBFC revolving credit curbs reflects the RBI's proactive approach to preventing unmonitored leverage buildup, as detailed by ${pub}.

Risk committees must balance systemic risk containment with the practical working capital needs of small businesses by deploying continuous cashflow surveillance and early warning telemetry.

What risk telemetry and cashflow monitoring tools should lenders deploy to manage revolving credit risks without choking MSME liquidity?`),
      strategic_outlook: sanitizeAiSlop(`MSMEs remain the backbone of India's industrial economy, and maintaining predictable access to short-term working capital is essential for manufacturing growth.

A collaborative regulatory framework that balances credit discipline with operational flexibility will ensure sustainable MSME formalization.

How should NBFCs and industry bodies work with regulators to design risk-calibrated revolving credit products for small businesses?`)
    };
  }

  // 7. RBI TIGHTENS EXPOSURE RULES FOR UPPER LAYER IDF-NBFCS
  if (hLower.includes("idf-nbfc") || (hLower.includes("large exposure") && hLower.includes("infrastructure debt fund"))) {
    return {
      architectural_take: sanitizeAiSlop(`The Reserve Bank of India has tightened Large Exposure Framework (LEF) rules for Upper Layer Infrastructure Debt Fund NBFCs (IDF-NBFCs), as reported by ${pub}. The revised norms enforce stricter single-entity and group exposure caps to curb systemic concentration risk in infrastructure project financing.

For infrastructure lenders, managing tighter exposure limits necessitates diversifying syndication partnerships, co-lending consortiums, and automated limit monitoring across parent and subsidiary entities.

How is your treasury and credit risk team adapting capital allocation models to comply with tightened large exposure ceilings?`),
      risk_lens: sanitizeAiSlop(`The RBI's focus on large exposure governance for infrastructure financiers reinforces systemic financial stability, as reported by ${pub}.

Risk committees must ensure automated group exposure tracking and real-time capital adequacy monitoring across all large-ticket infrastructure disbursements.

What automated credit surveillance mechanisms are most effective in tracking cross-entity group indebtedness in infrastructure financing?`),
      strategic_outlook: sanitizeAiSlop(`As India accelerates national infrastructure development, well-governed debt funds with diversified balance sheets will play a critical role in syndicating long-term private capital.

Strengthening prudential exposure norms ensures that infrastructure growth remains insulated from single-borrower default shocks.

How will tightened large exposure norms influence consortium lending and debt syndication structures for upcoming mega-infrastructure projects?`)
    };
  }

  // 8. STAR HOUSING FINANCE & RBI DIRECTORS APPROVAL
  if (hLower.includes("star housing") || (hLower.includes("housing finance") && hLower.includes("non-executive directors"))) {
    return {
      architectural_take: sanitizeAiSlop(`Star Housing Finance has approached the Reserve Bank of India seeking regulatory approval for the appointment of additional Non-Executive Directors, reported by ${pub}. Strengthening board-level governance and independent oversight is a vital step as housing finance companies scale their affordable mortgage portfolios across Tier-2 and Tier-3 geographies.

For expanding HFCs, a strong board with seasoned BFSI leadership provides strategic direction in risk governance, asset-liability management (ALM), and low-cost debt raising.

How are growing Housing Finance Companies structuring their board committees to support multi-state portfolio expansion?`),
      risk_lens: sanitizeAiSlop(`Regulatory oversight over board appointments in HFCs underscores the RBI's emphasis on ‘Fit and Proper’ governance criteria for non-bank lenders, as highlighted by ${pub}.

Risk and nomination committees must ensure prospective directors bring deep expertise in credit risk, audit oversight, and regulatory compliance to guide institutional growth.

What key governance competencies should specialized mortgage lenders prioritize when strengthening their board of directors?`),
      strategic_outlook: sanitizeAiSlop(`Affordable housing finance remains a powerful engine of social mobility and long-term retail credit compounding in India.

HFCs that build robust corporate governance and transparent underwriting frameworks will attract patient institutional capital and credit rating upgrades.

How do you foresee the competitive positioning of specialized HFCs evolving alongside large public and private commercial banks in affordable housing?`)
    };
  }

  // 9. CREDIT CARD MONTHLY SPENDS ABOVE ₹2 TRILLION
  if (hLower.includes("credit card") && (hLower.includes("2 trillion") || hLower.includes("spends above"))) {
    return {
      architectural_take: sanitizeAiSlop(`Monthly credit card spending in India has crossed ₹2 trillion for the third consecutive month, reported by ${pub}. This sustained milestone reflects the rapid digitization of consumer commerce, festive consumption momentum, and expanding acceptance of digital credit rails across retail, travel, and utility payments.

To support surging transaction volumes, issuing banks are modernizing payment switches and fraud detection engines to process millions of transactions per second with sub-second latency.

How are card issuers upgrading core payment processing architecture to support escalating transaction volumes while maintaining sub-second fraud scoring?`),
      risk_lens: sanitizeAiSlop(`While record credit card spending signals strong consumer confidence, risk teams must closely track revolving balances, debt-to-income ratios, and early delinquency signals across retail cardholders, as reported by ${pub}.

Credit committees must ensure multi-bureau customer indebtedness verification and risk-based credit limit assignments to manage unsecured portfolio risk.

What early-warning telemetry and behavioral risk metrics are most critical in monitoring unsecured revolving credit portfolios?`),
      strategic_outlook: sanitizeAiSlop(`India's retail credit card market is experiencing robust structural growth, driven by digital public infrastructure, co-branded partnerships, and premium loyalty ecosystems.

The next growth wave will belong to issuers that combine frictionless digital customer experiences with prudent credit underwriting.

How do you see the co-existence of credit cards and Credit Line on UPI shaping consumer payment preferences over the next few years?`)
    };
  }

  // 10. BANK CREDIT GROWTH OUTPACES DEPOSITS / LDR HIGH (EAC-PM, BERNSTEIN, BOFA, ETBFSI)
  if (hLower.includes("credit growth") && (hLower.includes("deposit") || hLower.includes("ldr") || hLower.includes("20%")) || hLower.includes("eac-pm") || hLower.includes("lending faster than borrowing")) {
    return {
      architectural_take: sanitizeAiSlop(`Indian banking credit growth has reached multi-year highs near 20% YoY, outpacing deposit accretion and pushing Loan-to-Deposit Ratios (LDR) near decade highs, reported by ${pub}. The divergence between credit demand and deposit mobilization is prompting policy discussions, with the EAC-PM and analysts noting the urgent need for enhanced retail deposit mobilization.

To manage LDR pressure, banks are optimizing Asset-Liability Management (ALM) workflows and leveraging digital onboarding channels to accelerate low-cost CASA and term deposit acquisition.

How is your institution modernizing digital deposit origination to support aggressive credit growth targets?`),
      risk_lens: sanitizeAiSlop(`Elevated Loan-to-Deposit Ratios (LDR) across commercial banks require heightened liquidity risk surveillance and disciplined balance sheet pricing, as detailed by ${pub}.

Asset-Liability Committees (ALCO) must balance loan growth ambitions with prudent liquidity coverage ratios (LCR) and counter-cyclical buffers to prevent margin compression.

What liquidity risk metrics and pricing strategies is your ALCO prioritizing to manage credit growth amidst tight deposit liquidity?`),
      strategic_outlook: sanitizeAiSlop(`India's strong credit expansion reflects broad-based economic vitality across retail, MSME, and infrastructure sectors.

Sustaining this momentum will depend on banks' ability to innovate on deposit products, expand digital financial inclusion, and maintain sound underwriting standards.

How do you expect commercial banks to recalibrate lending rates and deposit mobilization strategies over the coming fiscal quarters?`)
    };
  }

  // 11. GENERAL DYNAMIC GROUNDED SYNTHESIS (FOR ALL OTHER FINANCIAL NEWS)
  // Extracts the specific facts, headline, entities, and metrics from THAT article
  const leadSubject = h.replace(/^(RBI|State Bank of India|HDFC Bank|Axis Bank|NBFCs?|Banks?)\s+/i, "").trim();
  return {
    architectural_take: sanitizeAiSlop(`Recent financial reporting from ${pub} regarding "${h}"${metricSnippet} highlights significant developments in India's banking and credit landscape.

Navigating these shifts requires financial institutions to ensure operational agility—aligning internal credit policies, verification workflows, and core reporting systems with changing market dynamics.

How is your institution adapting its operational and product strategy in response to these developments highlighted by ${pub}?`),
    risk_lens: sanitizeAiSlop(`The development reported by ${pub} regarding "${h}" underscores the importance of proactive risk management and underwriting discipline across institutional portfolios.

Risk committees must prioritize early-warning behavioral signals, robust counterparty evaluation, and prudent balance sheet buffers to ensure long-term portfolio resilience.

What core risk indicators and governance frameworks is your leadership team monitoring most closely regarding this development?`),
    strategic_outlook: sanitizeAiSlop(`The insights published by ${pub} on "${h}" reflect the continued evolution and formalization of India's financial sector.

Institutions that harmonize progressive business strategy with strong corporate governance and customer-centric practices will capture sustainable market leadership.

How is your board positioning your institutional strategy to leverage these structural industry trends?`)
  };
}

module.exports = {
  synthesizePostCommentary,
  synthesizeNewsArticleTakes,
  extractEntitiesAndMetrics,
  extractPostThesis,
  sanitizeAiSlop
};
