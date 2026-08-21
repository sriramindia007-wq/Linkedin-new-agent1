/**
 * Context-Aware Comment Generator calibrated for Sriram Ganesan
 * Head of Loan Origination System (LOS) Product and Product Solutions at M2P Fintech
 */

const { loadPersona } = require("./db");

function extractEntitiesAndTopic(postText, authorName) {
  const text = postText || "";
  const textLower = text.toLowerCase();

  // 1. Detect Appointment / Leadership / Restructuring
  const isAppointment = textLower.includes("appoint") || textLower.includes("chief credit officer") || textLower.includes("cro") || textLower.includes("leadership") || textLower.includes("joins as") || textLower.includes("rejigs");
  
  // 2. Detect Bank / Organization Names
  let orgName = "";
  const orgMatch = text.match(/([A-Z][A-Za-z0-9\s&]+(?:Bank|Finance|Fintech|Capital|NBFC|Solutions|Software))/);
  if (orgMatch) {
    orgName = orgMatch[1].trim();
  } else {
    orgName = authorName || "the institution";
  }

  // 3. Detect Executive Name
  let execName = "";
  const execMatch = text.match(/(?:appoints|named|welcomes)\s+([A-Z\s\.]+?)(?:\s+as|\s+to|\s*,|\s*\n)/i);
  if (execMatch) {
    execName = execMatch[1].trim();
  }

  // 4. Detect Specific Core Lending Themes
  const isCentralizedCredit = textLower.includes("centralized credit") || textLower.includes("centralised credit") || textLower.includes("underwriting hub");
  const isCoLending = textLower.includes("co-lending") || textLower.includes("colending") || textLower.includes("bank-nbfc") || textLower.includes("partnership") || textLower.includes("mou");
  const isULIorAA = textLower.includes("uli") || textLower.includes("unified lending interface") || textLower.includes("account aggregator") || textLower.includes("sahamati");
  const isMSMEorCashflow = textLower.includes("msme") || textLower.includes("sme") || textLower.includes("cashflow") || textLower.includes("gst") || textLower.includes("working capital");
  const isSupplyChain = textLower.includes("supply chain") || textLower.includes("scf") || textLower.includes("treds") || textLower.includes("invoice discounting");
  const isEVorAuto = textLower.includes("ev") || textLower.includes("electric vehicle") || textLower.includes("vehicle finance") || textLower.includes("auto loan");
  const isGoldLoan = textLower.includes("gold loan") || textLower.includes("gold lending");
  const isRegulatory = textLower.includes("rbi") || textLower.includes("guidelines") || textLower.includes("circular") || textLower.includes("dlg") || textLower.includes("fldg");
  const isAIUnderwriting = textLower.includes("ai") || textLower.includes("machine learning") || textLower.includes("underwriting") || textLower.includes("idp") || textLower.includes("stp");

  return {
    orgName,
    execName,
    isAppointment,
    isCentralizedCredit,
    isCoLending,
    isULIorAA,
    isMSMEorCashflow,
    isSupplyChain,
    isEVorAuto,
    isGoldLoan,
    isRegulatory,
    isAIUnderwriting
  };
}

function generateHeuristicComments(postText, authorName, sourceCategory, customGuidance = "") {
  const meta = extractEntitiesAndTopic(postText, authorName);
  const text = postText || "";
  const prefix = customGuidance && customGuidance.trim().length > 0 ? `Regarding ${customGuidance.trim()}: ` : "";

  // CASE 1: Executive Appointment & Centralized Credit Department Restructuring
  if (meta.isAppointment || meta.isCentralizedCredit) {
    const leaderRef = meta.execName ? `${meta.execName}` : "the new credit leadership";
    const entityRef = meta.orgName ? `${meta.orgName}` : "the bank";

    return {
      value_add: `${prefix}Centralizing the credit function at ${entityRef} ${meta.execName ? `under ${leaderRef}` : ""} is a timely strategic move. For mid-tier and private banks, decoupling credit decisioning from branch operations into a centralized underwriting department requires an agile Loan Origination System (LOS) that standardizes policy enforcement, automates multi-bureau and telemetry ingestion, and delivers rapid turnaround without operational bottlenecks.`,
      provocative_question: `As ${entityRef} transitions towards a centralized credit architecture, what workflow orchestration mechanisms are being implemented in the LOS to balance automated Straight-Through Processing (STP) with nuanced credit officer judgment on edge cases?`,
      executive_perspective: `Centralized credit transformation succeeds when powered by configurable lending platforms that provide risk committees with end-to-end auditability and policy governance while empowering underwriters to make faster, compliant decisions.`
    };
  }

  // CASE 2: Co-Lending & Institutional MoUs / Partnerships
  if (meta.isCoLending) {
    return {
      value_add: `${prefix}Scaling institutional co-lending partnerships between Banks and NBFCs requires far more than basic API connectivity. The critical operational heavy lifting lies in deploying a multi-entity LOS capable of synchronizing disparate credit risk policies, automating tripartite escrow reconciliation, and enforcing FLDG caps in real time.`,
      provocative_question: `For lenders scaling Bank-NBFC co-origination journeys, what architectural safeguards are being prioritized to ensure seamless data exchange across distinct core banking stacks while meeting sub-24 hour disbursement SLAs?`,
      executive_perspective: `Sustainable co-lending models depend on collaborative, open-API lending infrastructure that provides transparent audit trails, shared risk visibility, and automated compliance for both partner institutions.`
    };
  }

  // CASE 3: ULI, Account Aggregator (AA) & Digital Public Infrastructure
  if (meta.isULIorAA) {
    return {
      value_add: `${prefix}The Unified Lending Interface (ULI) and Account Aggregator ecosystem represent a generational leap in credit democratization. For financial institutions, the primary differentiator is implementing an agile LOS that can seamlessly ingest and parse these diverse telemetry streams into configurable credit rules without multi-month development cycles.`,
      provocative_question: `As ULI unlocks specialized alternate data feeds across rural and MSME clusters, how are credit risk committees structuring AI governance to ensure model explainability and mitigate bias at the board level?`,
      executive_perspective: `Regulatory compliance and technology modernization must move in lockstep; enterprise lending platforms must be built with regulatory agility, consent auditability, and data governance at their very foundation.`
    };
  }

  // CASE 4: MSME Cashflow & GST Underwriting
  if (meta.isMSMEorCashflow) {
    return {
      value_add: `${prefix}The real operational challenge in scaling MSME credit isn't just data access—it is orchestrating real-time GST, banking, and tax telemetry directly within a configurable Business Rules Engine (BRE). An agile LOS must allow credit policy teams to adapt risk cutoffs dynamically based on cashflow volatility rather than static bureau proxies.`,
      provocative_question: `As institutions transition from collateral-backed to cashflow-based MSME underwriting, what governance guardrails are being instituted in the LOS to manage first-loss defaults while expanding into new vendor clusters?`,
      executive_perspective: `Technology should empower underwriters, not replace their judgment. The competitive edge in MSME origination lies in pairing automated data orchestration with decision intelligence governed by the institution's own credit policy.`
    };
  }

  // CASE 5: Supply Chain Finance (SCF), Invoicing & TReDS
  if (meta.isSupplyChain) {
    return {
      value_add: `${prefix}In Supply Chain and Embedded Finance, embedding the loan origination journey directly into enterprise ERP and invoicing platforms provides verified transaction lineage, enabling automated invoice verification and rapid disbursement without compromising credit controls.`,
      provocative_question: `From a credit risk and corporate governance standpoint, how are treasury and lending heads structuring multi-lender syndication without introducing onboarding friction for tier-2 and tier-3 supplier networks?`,
      executive_perspective: `Supply chain finance is evolving from a tactical working capital tool into an enterprise liquidity pillar when backed by open-API lending infrastructure that connects anchors, vendors, and institutional financiers.`
    };
  }

  // CASE 6: EV & Vehicle Financing
  if (meta.isEVorAuto) {
    return {
      value_add: `${prefix}Financing electric vehicles and commercial fleets requires underwriting tailored to battery health analytics, residual value modeling, and dynamic OEM subsidy reconciliation. An enterprise LOS must provide configurable product workflows that can adapt to rapid shifts in green mobility financing.`,
      provocative_question: `How are auto and EV lenders structuring their credit policy rules in the LOS to underwrite non-standard asset depreciation curves and secondary battery market risks?`,
      executive_perspective: `Green mobility credit will scale sustainably when lenders pair flexible origination workflows with specialized IoT telemetry and institutional risk oversight.`
    };
  }

  // CASE 7: Regulatory Directives & RBI Compliance
  if (meta.isRegulatory) {
    return {
      value_add: `${prefix}Regulatory compliance in digital lending cannot be an afterthought—it must be architected directly into the workflow engine of the LOS, from automated Key Fact Statement (KFS) generation and direct disbursement controls to strict FLDG cap monitoring.`,
      provocative_question: `With tightening regulatory oversight across digital lending partnerships and third-party origination apps, what audit frameworks are board risk committees establishing to ensure ongoing technology compliance?`,
      executive_perspective: `Institutions that build regulatory agility into their core lending platforms will outperform, ensuring high-velocity credit innovation remains fully aligned with regulatory expectations.`
    };
  }

  // CASE 8: AI Underwriting & Automated STP
  if (meta.isAIUnderwriting) {
    return {
      value_add: `${prefix}True Straight-Through Processing (STP) in lending requires dynamic rule orchestration in the LOS that pairs machine learning scoring with robust credit policy guardrails, ensuring automated approvals on prime files while routing complex cases seamlessly to underwriters.`,
      provocative_question: `What frameworks are lending heads implementing to monitor concept drift and maintain robust bias guardrails across automated underwriting models through varying economic cycles?`,
      executive_perspective: `The future of enterprise lending lies in hybrid intelligence—empowering credit teams with automated data orchestration while preserving institutional credit governance.`
    };
  }

  // Default Contextual Synthesis
  const titleSnippet = text.substring(0, 80).replace(/\n+/g, " ");
  return {
    value_add: `${prefix}Addressing ${meta.orgName}'s recent update on "${titleSnippet}..." highlights the rapid evolution of modern lending operations. Scaling institutional loan portfolios requires configurable workflows and modular API architecture that can support multi-asset origination seamlessly across retail, MSME, and commercial sectors.`,
    provocative_question: `As institutions modernize their lending operations, what strategies are proving most effective in balancing rapid product configuration with strict risk governance and compliance?`,
    executive_perspective: `Building future-ready financial institutions requires scalable platforms that deliver speed to market for new credit products without compromising governance, risk controls, or customer trust.`
  };
}

async function generateCommentsForPost(postText, authorName, sourceCategory, customGuidance = "") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateHeuristicComments(postText, authorName, sourceCategory, customGuidance);
  }

  const persona = loadPersona();
  const userName = persona.user_name || "Sriram Ganesan";
  const headline = persona.linkedin_headline || "Head - LOS Product & Product Solutions | M2P Fintech";
  const company = persona.company || "M2P Fintech";
  const philosophy = persona.core_philosophy || "Technology should empower lenders—not replace their judgment.";
  const focusAreas = (persona.focus_areas || []).join(", ");
  const rules = (persona.tone_guidelines?.rules || []).map(r => `- ${r}`).join("\n");

  const prompt = `
You are ${userName}, ${headline} at ${company}.
Core Philosophy: "${philosophy}"
Domain Focus & Expertise: ${focusAreas}

Voice & Quality Guardrails:
${rules}
- Read the entire LinkedIn post carefully and respond directly to the specific facts, company names, people, and themes mentioned in the post.
- NEVER use generic canned responses or broad cliches.
- Return exactly 3 distinct comment styles based strictly on the post content.
- Keep each comment concise, substantive, and impactful (2 to 4 sentences max).
- Speak with the authority of an enterprise LOS product leader and governance strategist who collaborates daily with Banks, NBFCs, and MFIs.
- NEVER use generic filler phrases like "Great insights!", "Thanks for sharing!", or "Totally agree".
- Speak directly to credit policy configuration, BRE, workflow orchestration, risk governance, regulatory compliance (RBI guidelines, ULI, AA), or multi-asset origination realities.
${customGuidance ? `\nSPECIAL USER GUIDANCE / FOCUS INSTRUCTION:\n"${customGuidance}"\nEnsure all 3 comments strongly incorporate this specific angle/instruction.\n` : ""}

Context of the LinkedIn post:
- Source / Category: ${sourceCategory}
- Author / Company: ${authorName}
- Post Content:
"""${postText}"""

Generate a JSON object with exactly these 3 keys:
{
  "value_add": "💡 Practitioner's LOS Nuance comment (Deeply anchored in the post specifics)",
  "provocative_question": "❓ Governance & Risk Inquiry question comment (Directly challenging or exploring the post context)",
  "executive_perspective": "📊 Strategic Outlook comment (Executive synthesis linking the post topic to institutional resilience & LOS governance)"
}

Respond ONLY with valid JSON.
`;

  try {
    const fetch = global.fetch || require("node-fetch");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      const cleanJson = candidateText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      return {
        value_add: parsed.value_add || generateHeuristicComments(postText, authorName, sourceCategory, customGuidance).value_add,
        provocative_question: parsed.provocative_question || generateHeuristicComments(postText, authorName, sourceCategory, customGuidance).provocative_question,
        executive_perspective: parsed.executive_perspective || generateHeuristicComments(postText, authorName, sourceCategory, customGuidance).executive_perspective
      };
    }
  } catch (err) {
    console.warn("Gemini API call failed, falling back to Sriram Ganesan contextual engine:", err.message);
  }

  return generateHeuristicComments(postText, authorName, sourceCategory, customGuidance);
}

module.exports = {
  generateCommentsForPost,
  generateHeuristicComments
};
