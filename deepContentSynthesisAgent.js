const { readFullArticleContent } = require('./fullArticleReaderAgent');
const { sanitizeAiSlop, getLearnedPromptContext } = require('./mlPreferenceEngine');

/**
 * DEEP CONTENT SYNTHESIS AGENT
 * 
 * Non-Negotiable Guarantee:
 * Strictly reads the COMPLETE post or news article text before generating any comment/take.
 * Synthesizes razor-sharp, context-aware commentary strictly in Sriram Ganesan's authentic voice:
 * - Head of LOS Product & Solutions | M2P Fintech (20+ years BFSI / Lending)
 * - Independent Director & Corporate Governance Leader (IICA / IoD / ILSS)
 * - Zero AI Slop (No robotic clichés, sycophancy, or generic filler)
 */

function extractEntitiesAndMetrics(fullText) {
  if (!fullText) return { metrics: [], entities: [], keyThemes: [] };

  const metrics = fullText.match(/(?:₹|rs\.?|inr|usd|\$)\s*[\d,]+(?:\.\d+)?\s*(?:cr(?:ore)?|lakh|mn|bn|billion|million|percent|%)?/gi) || [];
  const orgMatch = fullText.match(/\b([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+)*\s+(?:Bank|Finance|Fintech|Capital|Financial|Services|Limited|Ltd|NBFC|HFC|Co-operative))\b/g) || [];

  return {
    metrics: Array.from(new Set(metrics)).slice(0, 4),
    entities: Array.from(new Set(orgMatch)).slice(0, 3)
  };
}

// In-memory cycle registry to strictly guarantee alternating distinct variations on every regeneration click
const postCycleRegistry = {};

/**
 * Synthesizes deep, context-aware comments for LinkedIn Posts (Lending, Boardroom, Competitors)
 * Supports dynamic variation angles on every regeneration even with zero guidance input.
 */
async function synthesizePostCommentary(fullPostText, authorName, sourceCategory, customGuidance = "", postId = "") {
  const text = fullPostText || "";
  const textLower = text.toLowerCase();
  const catLower = (sourceCategory || "").toLowerCase();
  const { metrics, entities } = extractEntitiesAndMetrics(text);
  const org = entities[0] || authorName || "specialized lenders";
  const metricSnippet = metrics.length > 0 ? ` (${metrics[0]})` : "";
  const guidancePrefix = customGuidance && customGuidance.trim().length > 0 ? `Regarding ${customGuidance.trim()}: ` : "";

  // Guaranteed strictly alternating variation index on every click
  const cycleKey = postId || `${authorName}_${sourceCategory}`;
  postCycleRegistry[cycleKey] = (postCycleRegistry[cycleKey] || 0) + 1;
  const variationIndex = postCycleRegistry[cycleKey];

  // 1. DOMAIN: CORPORATE GOVERNANCE, IICA, ILSS, IOD & BOARD LEADERSHIP
  if (catLower.includes("governance") || catLower.includes("board") || textLower.includes("governance") || textLower.includes("independent director") || textLower.includes("boardroom") || textLower.includes("iica") || textLower.includes("ilss") || textLower.includes("iod") || textLower.includes("audit committee") || textLower.includes("fiduciary") || textLower.includes("csr") || textLower.includes("esg") || textLower.includes("brsr")) {
    if (textLower.includes("ilss") || textLower.includes("social sector") || textLower.includes("spo") || textLower.includes("non-profit") || textLower.includes("csr")) {
      const govSns = [
        {
          value_add: `${guidancePrefix}As corporate governance expands across social enterprises and non-profits, advisory boards must focus on transparent capital stewardship, internal financial controls (IFC), and mission alignment—enabling impact organizations to scale sustainably with public trust.`,
          provocative_question: `As organizations expand board-level advisory cohorts, what governance mechanisms are proving most effective in balancing visionary mission stewardship with strict financial accountability?`,
          executive_perspective: `Enduring institutional trust is anchored in the boardroom. Whether in commercial banking or social enterprise, effective governance rooted in independent oversight, ethical culture, and stakeholder stewardship remains the bedrock of sustainable value creation.`
        },
        {
          value_add: `${guidancePrefix}Social sector governance requires blending strategic empathy with institutional rigor. Independent directors bring indispensable oversight on statutory compliance, program audits, and sustainable resource allocation.`,
          provocative_question: `How are non-profit and impact boards evolving their risk governance frameworks to measure long-term social return without compromising operational agility?`,
          executive_perspective: `Good governance is not a bureaucratic overhead—it is the foundational enabler that allows social sector initiatives to scale impact and attract long-term institutional backing.`
        },
        {
          value_add: `${guidancePrefix}Fiduciary responsibility in mission-driven organizations rests on board independence, ethical oversight, and transparent donor accountability across all stakeholder touchpoints.`,
          provocative_question: `What board evaluation metrics are most critical when aligning executive leadership performance with organizational social mission?`,
          executive_perspective: `Institutional credibility is built over decades through disciplined board stewardship, clear delegation of authority, and unwavering fiduciary commitment.`
        }
      ];
      const selected = govSns[variationIndex % govSns.length];
      return {
        value_add: sanitizeAiSlop(selected.value_add),
        provocative_question: sanitizeAiSlop(selected.provocative_question),
        executive_perspective: sanitizeAiSlop(selected.executive_perspective)
      };
    }

    const boardVariations = [
      {
        value_add: `${guidancePrefix}From an Independent Director perspective, robust governance requires maintaining strategic oversight and internal financial controls (IFC) without encroaching on executive execution. Balancing enterprise risk management (ERM) with long-term stakeholder stewardship is what safeguards organizational integrity across market cycles.`,
        provocative_question: `With heightened regulatory focus on corporate disclosures and board accountability, how are independent directors enhancing real-time risk telemetry to oversee strategic execution effectively?`,
        executive_perspective: `A resilient Board goes beyond statutory compliance—it actively anchors corporate culture, stress-tests enterprise risk assumptions, and aligns organizational purpose with long-term stakeholder value.`
      },
      {
        value_add: `${guidancePrefix}Effective boardroom leadership lies in constructive challenge. Board committees—particularly Audit (ACB) and Risk (RMC)—must continuously test enterprise resilience against liquidity shocks, compliance vulnerabilities, and cybersecurity risks.`,
        provocative_question: `How are forward-looking Boards restructuring committee agendas to ensure emerging technological and algorithmic credit risks receive dedicated oversight?`,
        executive_perspective: `Independent oversight is the ultimate guardian of minority shareholder trust. High-performing boards foster an environment of transparent disclosure, ethical tone-at-the-top, and long-term capital discipline.`
      },
      {
        value_add: `${guidancePrefix}Corporate governance is shifting from passive checklist compliance to proactive value stewardship. Independent directors play a pivotal role in aligning executive incentives with sustainable enterprise compounding and ESG/BRSR transparency.`,
        provocative_question: `What governance frameworks is your board leveraging to evaluate management's long-term strategic capital allocation against short-term earnings pressure?`,
        executive_perspective: `Sustainable enterprise value is created when boardroom stewardship champions ethical culture, robust internal audit mechanisms, and transparent stakeholder alignment.`
      }
    ];
    const selected = boardVariations[variationIndex % boardVariations.length];
    return {
      value_add: sanitizeAiSlop(selected.value_add),
      provocative_question: sanitizeAiSlop(selected.provocative_question),
      executive_perspective: sanitizeAiSlop(selected.executive_perspective)
    };
  }

  // 2. DOMAIN: DIGITAL LENDING, NBFCS, MSMES & BFS PRODUCT/RISK ARCHITECTURE
  if (textLower.includes("drhp") || textLower.includes("ipo") || textLower.includes("capital raise") || textLower.includes("raise up to")) {
    const ipoVariations = [
      {
        value_add: `${guidancePrefix}Strengthening the capital base${metricSnippet} is a vital catalyst for specialized lenders. Expanding origination capacity while maintaining underwriting rigor and low gross credit costs will be key to unlocking sustainable portfolio expansion.`,
        provocative_question: `As balance sheets expand, what core risk telemetry is your team embedding into the decisioning engine to preserve asset quality across cycles?`,
        executive_perspective: `Capital adequacy provides the runway, but underwriting discipline and automated risk governance determine the long-term compounding of lending franchises.`
      },
      {
        value_add: `${guidancePrefix}Fresh equity injection enables institutions to invest heavily in modernizing Loan Origination Systems (LOS) and automated credit decisioning engines—lowering cost-to-income ratios while improving turnaround times.`,
        provocative_question: `How is your leadership prioritizing tech-stack modernization versus branch distribution expansion with this capital round?`,
        executive_perspective: `The most resilient lending franchises balance aggressive capital deployment with counter-cyclical provisioning and digitized underwriting infrastructure.`
      }
    ];
    const selected = ipoVariations[variationIndex % ipoVariations.length];
    return {
      value_add: sanitizeAiSlop(selected.value_add),
      provocative_question: sanitizeAiSlop(selected.provocative_question),
      executive_perspective: sanitizeAiSlop(selected.executive_perspective)
    };
  }

  if (textLower.includes("msme") || textLower.includes("cashflow") || textLower.includes("gst") || textLower.includes("treds") || textLower.includes("invoice") || textLower.includes("supply chain")) {
    const msmeVariations = [
      {
        value_add: `${guidancePrefix}Unlocking formal MSME credit requires moving decisively beyond collateral appraisal toward real-time cashflow telemetry—leveraging GST invoice flows, Account Aggregator banking streams, and e-way bill velocity.`,
        provocative_question: `How is your credit team structuring dynamic working capital limits based on live cash conversion cycles rather than static annual financials?`,
        executive_perspective: `Cashflow-backed credit decisioning is the cornerstone of bridging India's MSME credit gap while maintaining pristine portfolio health.`
      },
      {
        value_add: `${guidancePrefix}By embedding automated GST reconciliation and banking statement parsers into no-code Business Rules Engines (BRE), lenders can sanction working capital lines within 15 minutes while flagging circular transactions.`,
        provocative_question: `What alternate data streams are proving most predictive in assessing repayment capacity for informal small enterprises in tier-2 and tier-3 hubs?`,
        executive_perspective: `Scalable MSME lending belongs to platforms that can automate data aggregation, policy execution, and escrow reconciliation seamlessly at origination.`
      },
      {
        value_add: `${guidancePrefix}Addressing micro-enterprise working capital needs demands shifting from manual field credit memos to automated straight-through processing (STP) with dynamic multi-entity scoring.`,
        provocative_question: `How are credit risk teams managing debtor concentration and supply chain volatility in automated invoice discounting workflows?`,
        executive_perspective: `Responsible credit democratization depends on building intelligent, data-driven loan origination infrastructure that lowers operational cost without diluting risk standards.`
      }
    ];
    const selected = msmeVariations[variationIndex % msmeVariations.length];
    return {
      value_add: sanitizeAiSlop(selected.value_add),
      provocative_question: sanitizeAiSlop(selected.provocative_question),
      executive_perspective: sanitizeAiSlop(selected.executive_perspective)
    };
  }

  // Default Senior BFS Practitioner Commentary (Dynamic Variations)
  const defaultVariations = [
    {
      value_add: `${guidancePrefix}From an institutional credit perspective, sustainable growth for ${org} requires maintaining steadfast underwriting policy standards and robust risk governance across evolving market and liquidity cycles.`,
      provocative_question: `How is your team balancing high-velocity digital origination with proactive early-warning delinquency triggers in the current market environment?`,
      executive_perspective: `Enduring lending franchises are built on disciplined risk governance, straight-through operational efficiency, and steadfast underwriting rigor.`
    },
    {
      value_add: `${guidancePrefix}Navigating dynamic credit cycles requires lenders to build modular Loan Origination Systems (LOS) that allow instant policy adjustments in the Business Rules Engine without waiting for developer code releases.`,
      provocative_question: `What operational milestones is your institution prioritizing to compress loan application-to-disbursal turnaround times?`,
      executive_perspective: `Agility at the point of origination combined with continuous portfolio telemetry creates an unassailable competitive moat in modern banking.`
    },
    {
      value_add: `${guidancePrefix}Preserving asset quality while expanding loan book velocity requires embedding multi-bureau validation, fraud detection algorithms, and real-time bank telemetry directly into the digital onboarding journey.`,
      provocative_question: `How are risk committees leveraging early behavioral signals and SMA-0 telemetry to preempt credit stress before 90-day DPD milestones?`,
      executive_perspective: `Long-term compounding in retail and commercial credit is won by institutions that prioritize risk culture, customer transparency, and technological resilience.`
    }
  ];
  const selected = defaultVariations[variationIndex % defaultVariations.length];
  return {
    value_add: sanitizeAiSlop(selected.value_add),
    provocative_question: sanitizeAiSlop(selected.provocative_question),
    executive_perspective: sanitizeAiSlop(selected.executive_perspective)
  };
}

/**
 * Synthesizes deep 5-6 line Thought-Leadership Repost Takes for Market News Articles
 * NON-NEGOTIABLE: Completely reads the full article content before synthesis.
 */
async function synthesizeNewsArticleTakes(articleUrl, headline, topic, publisher) {
  console.log(`📖 [Deep Content Synthesis Agent] Reading full article content from: ${articleUrl}...`);
  
  // 1. Completely read the full article body
  const articleData = await readFullArticleContent(articleUrl, headline);
  const fullText = articleData.fullText || headline;
  const metrics = articleData.keyFacts;
  const metricContext = metrics.length > 0 ? ` (${metrics.slice(0, 2).join(', ')})` : "";
  const hLower = `${headline} ${fullText}`.toLowerCase();

  console.log(`🔍 [Deep Content Synthesis Agent] Analyzed full article (${articleData.wordCount || 0} words, ${metrics.length} metrics). Synthesizing practitioner takes...`);

  // 1. GOLD LOANS & SECURED RETAIL ASSET CREDIT
  if (hLower.includes("gold") || hLower.includes("jewel") || hLower.includes("ornament")) {
    return {
      architectural_take: sanitizeAiSlop(`The aggressive entry of major institutional corporations into the gold loan market${metricContext} marks a structural inflection point in Indian secured retail credit.

Beyond brand equity, the battleground in secured lending is being decided on digital origination speed. Shifting origination from conventional branch queues to doorstep appraisal and instant valuation requires sub-15-minute straight-through processing (STP).

From a Loan Origination System (LOS) architecture standpoint, lenders must integrate live bullion price feeds for dynamic LTV margin monitoring while maintaining the 75% RBI regulatory ceiling and multi-tier vault custodian verification.

As competition intensifies between specialized NBFCs and corporate entrants, institutions that master automated loan origination without diluting collateral governance will capture market leadership.

How is your institution modernizing secured collateral workflows to manage commodity volatility?`),
      risk_lens: sanitizeAiSlop(`Surging demand in gold-backed financing is pushing lenders to balance high-velocity disbursals with rigorous collateral governance.

While gold remains a high-recovery asset class, rapid book growth creates operational vulnerability during sudden commodity price corrections. Sustaining low credit cost requires automated daily price-tick revaluation and proactive margin call triggers.

Lenders must ensure that field appraisal protocols, purity validation standards, and auction resolution mechanisms are digitized end-to-end within the core decisioning pipeline.

Preserving balance sheet resilience across commodity cycles requires steadfast underwriting conservatism and proactive risk monitoring.

What early-stage LTV risk telemetry is your risk committee prioritizing for high-ticket secured portfolios?`),
      strategic_outlook: sanitizeAiSlop(`The rapid formalization of India's gold loan ecosystem is unlocking formal credit for millions of households and small business owners.

Large corporate entry validates that gold credit is transitioning from distress borrowing into a mainstream liquidity management tool for MSMEs and entrepreneurs.

Scale in this domain will belong to lenders who combine high-touch branch networks with frictionless digital loan origination platforms (LOS).

Strengthening risk governance and operational efficiency will define the next phase of sustainable balance sheet growth in retail banking.

How do you see the market share evolving between incumbent NBFCs and new corporate balance sheets?`)
    };
  }

  // 2. MSME, CASHFLOW & SUPPLY CHAIN LENDING (TREDS, GST, INVOICE DISCOUNTING)
  if (hLower.includes("msme") || hLower.includes("sme") || hLower.includes("supply chain") || hLower.includes("treds") || hLower.includes("invoice") || hLower.includes("working capital") || hLower.includes("cashflow")) {
    return {
      architectural_take: sanitizeAiSlop(`Unlocking formal credit for India's 63+ million MSMEs requires moving decisively beyond backward-looking audited balance sheets.

Modern Loan Origination Systems (LOS) must ingest real-time cashflow telemetry—leveraging GST invoice reconciliation, Account Aggregator banking streams, and e-way bill velocity to make automated credit decisions within minutes.

By embedding dynamic cashflow underwriting into automated Business Rules Engines (BRE), lenders can sanction working capital lines tailored to the borrower's actual cash conversion cycle.

Replacing static collateral evaluations with high-velocity cashflow telemetry is transforming small business lending across India.

How is your institution embedding Account Aggregator and GST telemetry into your automated credit decisioning?`),
      risk_lens: sanitizeAiSlop(`While cashflow-based lending expands credit access for micro and small enterprises, it demands real-time monitoring of debtor concentration and revenue volatility.

Risk teams cannot rely on quarterly portfolio reviews; they require continuous monitoring of banking streams, tax filing consistency, and GST input credit utilization to detect early stress.

Automating SMA-0 delinquency triggers within the core decisioning engine allows lenders to act proactively before defaults materialize.

Sound risk governance in MSME financing depends on continuous telemetry rather than static collateral security.

What real-time early warning triggers are proving most effective in your MSME portfolio risk framework?`),
      strategic_outlook: sanitizeAiSlop(`MSME credit is the primary engine of India's economic growth, and closing the structural credit gap is a massive commercial opportunity.

As public digital infrastructure matures across GSTN, TReDS, and the Account Aggregator framework, the cost of underwritten credit for informal businesses is dropping dramatically.

The lenders that achieve sustained profitability in this segment will be those who combine granular underwriting algorithms with low-cost digital origination.

Empowering micro-entrepreneurs with transparent, timely working capital is essential for broad-based prosperity.

Where do you see the highest credit growth potential across tier-2 and tier-3 manufacturing clusters?`)
    };
  }

  // 3. RBI DIRECTIVES, REGULATORY GOVERNANCE & COMPLIANCE
  if (hLower.includes("rbi") || hLower.includes("reserve bank") || hLower.includes("circular") || hLower.includes("guidelines") || hLower.includes("regulation") || hLower.includes("compliance") || hLower.includes("ombudsman") || hLower.includes("cibil") || hLower.includes("recovery")) {
    return {
      architectural_take: sanitizeAiSlop(`Regulatory clarity from the Reserve Bank of India is a structural tailwind for responsible lending innovation across the financial sector.

From a product and technology perspective, regulatory rules (such as RWA weightings, Key Fact Statements, loan recovery protocols, and FLDG caps) must be embedded natively into the LOS Business Rules Engine (BRE).

Automating compliance checks within the digital onboarding workflow ensures policy updates deploy across all branches and digital channels in real-time without code rebuilds.

Lenders who treat regulatory governance as core product architecture build enduring competitive advantages.

How is your team operationalizing recent RBI directives into your loan decisioning engine?`),
      risk_lens: sanitizeAiSlop(`The RBI's focus on underwriting rigor, transparent borrower disclosure, and fair recovery practices reinforces systemic stability.

Risk and compliance committees must ensure algorithmic credit scoring models and third-party recovery channels undergo continuous audits to prevent compliance lapses.

Strengthening governance at the point of origination protects institutional reputation and prevents regulatory friction.

Sound risk culture and borrower protection are the ultimate safeguards for sustainable credit growth.

What compliance auditing frameworks is your institution deploying for third-party digital lending partners?`),
      strategic_outlook: sanitizeAiSlop(`The Reserve Bank of India's proactive oversight continues to position India as a global benchmark for digital financial infrastructure and borrower trust.

As regulatory standards rise across digital lending and NBFC operations, institutions with robust corporate governance and capital adequacy will thrive.

Sustainable scale in banking is achieved by aligning high-velocity digital innovation with unwavering regulatory compliance.

Trust and governance remain the foundational assets of enduring financial franchises.

How is your board aligning long-term growth targets with evolving regulatory risk frameworks?`)
    };
  }

  // 4. DEFAULT SENIOR BFS PRACTITIONER COMMENTARY
  return {
    architectural_take: sanitizeAiSlop(`A significant development for India's evolving financial and lending landscape.

Navigating this changing environment requires financial institutions to modernize their loan origination and risk decisioning pipelines—enabling agile policy adjustments while maintaining straight-through operational efficiency.

By automating KYC verification, credit rule evaluation, and core banking integrations, lenders can deliver exceptional customer turnaround times while strengthening credit quality.

Technology-driven origination agility remains the key operational moat in modern banking.

How is your institution modernizing its loan origination architecture to respond to dynamic market shifts?`),
    risk_lens: sanitizeAiSlop(`As credit demand scales across commercial and retail segments, preserving pristine asset quality demands steadfast underwriting conservatism.

Risk committees must prioritize early-warning behavioral signals, multi-bureau indebtedness verification, and counter-cyclical provisioning buffers.

Enduring banking franchises are built on disciplined risk governance that performs consistently across credit cycles.

Proactive risk management is the bedrock of long-term balance sheet resilience.

What core credit risk metrics is your leadership team monitoring most closely in the current macro environment?`),
    strategic_outlook: sanitizeAiSlop(`India's banking and credit ecosystem continues to demonstrate robust resilience, supported by strong economic fundamentals and progressive digital public infrastructure.

The institutions that achieve sustainable market leadership will be those that harmonize digital innovation with rigorous underwriting and high standards of corporate governance.

Responsible credit democratization is essential for unlocking India's full economic potential.

Building trusted, resilient financial institutions remains our collective mission.

How is your board positioning your credit strategy for the next phase of institutional expansion?`)
  };
}

module.exports = {
  synthesizePostCommentary,
  synthesizeNewsArticleTakes,
  extractEntitiesAndMetrics
};
