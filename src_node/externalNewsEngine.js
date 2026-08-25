const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateCommentsForPost } = require('./commentGenerator');
const { loadPersona } = require('./db');

const possiblePaths = [
  path.join(__dirname, 'data', 'market_news.json'),
  path.join(__dirname, '..', 'data', 'market_news.json'),
  path.join(__dirname, 'market_news.json'),
  path.join(__dirname, '..', 'market_news.json')
];

function getNewsFilePath() {
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'data', 'market_news.json');
}

const SEARCH_STREAMS = [
  {
    topic: "Digital Lending & MSME Credit",
    url: 'https://news.google.com/rss/search?q=(%22digital+lending%22+OR+%22MSME+lending%22+OR+%22loan+origination%22+OR+%22co-lending%22+OR+%22fintech+loan%22)+india+when:3d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    topic: "NBFCs, Retail Credit & Asset Quality",
    url: 'https://news.google.com/rss/search?q=(%22NBFC%22+OR+%22retail+credit%22+OR+%22asset+quality%22+OR+%22Gross+Stage%22+OR+%22credit+growth%22)+india+when:3d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    topic: "Fintech Funding & IPOs",
    url: 'https://news.google.com/rss/search?q=(%22fintech+funding%22+OR+%22NBFC+funding%22+OR+%22debt+funding%22+OR+%22fintech+IPO%22)+india+when:3d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    topic: "RBI & Regulatory Policy",
    url: 'https://news.google.com/rss/search?q=(%22Reserve+Bank+of+India%22+OR+%22RBI%22)+AND+(lending+OR+credit+OR+NBFC+OR+%22co-lending%22+OR+underwriting)+when:3d&hl=en-IN&gl=IN&ceid=IN:en'
  }
];

function fetchHttps(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      rejectUnauthorized: false,
      timeout: 12000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve('')).on('timeout', function() { this.destroy(); resolve(''); });
  });
}

function parseGoogleRss(xml, streamTopic) {
  const items = [];
  if (!xml) return items;

  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) || [];

  for (const itemXml of matches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const sourceMatch = itemXml.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);

    let rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const link = linkMatch ? linkMatch[1].trim() : '';
    let publisher = sourceMatch ? sourceMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      if (!publisher) publisher = parts[parts.length - 1].trim();
      rawTitle = parts.slice(0, parts.length - 1).join(' - ').trim();
    }

    if (!publisher) publisher = "Financial Media";

    const lower = `${rawTitle} ${publisher}`.toLowerCase();
    
    // Strict Negative Noise Filters
    const noiseRegex = /sensex|nifty|equity market|stock rally|equities open|mutual fund|space economy|border talks|oil price|rupee falls|rupee rises|dollar deposit|fcnr|fixed deposit|nri deposit|crypto|bitcoin|tcs buys|porsche|bollywood|cricket|baseball|padres|somerset|marathon|horoscope|gstat|appeal filing|celebration|sebi chief flags|mlb\.com|homerun/i;
    if (noiseRegex.test(lower)) continue;

    // Strict Positive Lending & Credit Keywords Required
    const lendingRegex = /loan|lending|credit|nbfc|borrow|debt|underwrit|cibil|equifax|crif|experian|co-lending|colending|mortgage|lap|housing finance|gold loan|microfinance|mfi|working capital|invoice discount|treds|supply chain finance|npa|gross stage|delinquen|fldg|fincorp|finserv|disburs|collection|priority sector lending|psl|sarfaesi|credit risk|banking credit|credit growth/i;
    if (!lendingRegex.test(lower)) continue;

    if (rawTitle && link) {
      items.push({
        title: rawTitle,
        link,
        publisher,
        topic: streamTopic,
        pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString()
      });
    }
  }
  return items;
}

function loadMarketNews() {
  try {
    const file = getNewsFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveMarketNews(newsList) {
  try {
    const file = getNewsFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(newsList, null, 2), 'utf-8');
    
    const mirror = path.join(__dirname, 'data', 'market_news.json');
    if (file !== mirror) {
      const mDir = path.dirname(mirror);
      if (!fs.existsSync(mDir)) fs.mkdirSync(mDir, { recursive: true });
      fs.writeFileSync(mirror, JSON.stringify(newsList, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('Error saving market news:', e.message);
  }
}

/**
 * Generates bespoke, high-substance practitioner commentary for Indian financial news
 * Tailored to Sriram Ganesan's domain voice (Head of LOS Product & Solutions | M2P Fintech)
 */
async function generateMarketNewsTakes(headline, topic, publisher) {
  const hLower = (headline || "").toLowerCase();

  // 1. GOLD LOANS & SECURED RETAIL ASSET CREDIT
  if (hLower.includes("gold") || hLower.includes("jewel") || hLower.includes("ornament")) {
    return {
      architectural_take: `The aggressive entry of major institutional corporations into the gold loan market marks a structural inflection point in Indian secured retail credit.

Beyond brand equity, the battleground in secured lending is being decided on digital origination speed. Shifting origination from conventional branch queues to doorstep appraisal and instant valuation requires sub-15-minute straight-through processing (STP).

From a Loan Origination System (LOS) architecture standpoint, lenders must integrate live bullion price feeds for dynamic LTV margin monitoring while maintaining the 75% RBI regulatory ceiling and multi-tier vault custodian verification.

As competition intensifies between specialized NBFCs and corporate entrants, institutions that master automated loan origination without diluting collateral governance will capture market leadership.

How is your institution modernizing secured collateral workflows to manage commodity volatility?`,
      risk_lens: `Surging demand in gold-backed financing is pushing lenders to balance high-velocity disbursals with rigorous collateral governance.

While gold remains a high-recovery asset class, rapid book growth creates operational vulnerability during sudden commodity price corrections. Sustaining low credit cost requires automated daily price-tick revaluation and proactive margin call triggers.

Lenders must ensure that field appraisal protocols, purity validation standards, and auction resolution mechanisms are digitized end-to-end within the core decisioning pipeline.

Preserving balance sheet resilience across commodity cycles requires steadfast underwriting conservatism and proactive risk monitoring.

What early-stage LTV risk telemetry is your risk committee prioritizing for high-ticket secured portfolios?`,
      strategic_outlook: `The rapid formalization of India's gold loan ecosystem is unlocking formal credit for millions of households and small business owners.

Large corporate entry validates that gold credit is transitioning from distress borrowing into a mainstream liquidity management tool for MSMEs and entrepreneurs.

Scale in this domain will belong to lenders who combine high-touch branch networks with frictionless digital loan origination platforms (LOS).

Strengthening risk governance and operational efficiency will define the next phase of sustainable balance sheet growth in retail banking.

How do you see the market share evolving between incumbent NBFCs and new corporate balance sheets?`
    };
  }

  // 2. MSME, CASHFLOW & SUPPLY CHAIN LENDING (TREDS, GST, INVOICE DISCOUNTING)
  if (hLower.includes("msme") || hLower.includes("sme") || hLower.includes("supply chain") || hLower.includes("treds") || hLower.includes("invoice") || hLower.includes("working capital") || hLower.includes("cashflow")) {
    return {
      architectural_take: `Unlocking formal credit for India's 63+ million MSMEs requires moving decisively beyond backward-looking audited balance sheets.

Modern Loan Origination Systems (LOS) must ingest real-time cashflow telemetry—leveraging GST invoice reconciliation, Account Aggregator banking streams, and e-way bill velocity to make automated credit decisions within minutes.

By embedding dynamic cashflow underwriting into automated Business Rules Engines (BRE), lenders can sanction working capital lines tailored to the borrower's actual cash conversion cycle.

The next leap in MSME credit democratization will be won by institutions that bridge digital public infrastructure with agile balance sheet underwriting.

What leading indicators is your credit team monitoring to assess informal MSME liquidity?`,
      risk_lens: `As lenders accelerate cashflow-based lending to Tier-2 and Tier-3 enterprises, maintaining sub-2% delinquency requires proactive supply-chain monitoring.

Evaluating buyer concentration, tax filing regularity, and counterparty payment delays provides critical early warnings well before formal bureau reporting lags.

Risk governance must evolve from periodic reviews to continuous portfolio health checks powered by automated banking analysis.

Balancing rapid credit delivery with early delinquency triggers is the cornerstone of sustainable MSME lending.

How is your risk committee structuring early-warning systems for unsecured business credit?`,
      strategic_outlook: `The transformation of MSME credit from collateral-heavy lending to data-driven cashflow financing is reshaping India's economic growth engine.

Transaction-level financing through platforms like TReDS and OCEN is unlocking working capital for micro-enterprises that previously lacked formal access.

Enduring institutional value will be created by lenders who build deep ecosystem partnerships and automate credit delivery at low distribution cost.

Responsible credit scale is built on the convergence of technology, policy, and borrower protection.

How are partner lenders aligning their underwriting frameworks to scale co-originated MSME portfolios?`
    };
  }

  // 3. CO-LENDING & BANK-NBFC PARTNERSHIPS
  if (hLower.includes("co-lending") || hLower.includes("colending") || hLower.includes("partnership") || hLower.includes("fldg") || hLower.includes("syndicate") || hLower.includes("tie up") || hLower.includes("team up")) {
    return {
      architectural_take: `Bank-NBFC co-lending represents the single most potent bridge between low-cost bank liquidity and grassroots NBFC distribution.

The primary operational bottleneck in co-lending has historically been dual-LOS underwriting latency and real-time tripartite escrow settlements.

Modernizing this pipeline with automated API handshakes enables true straight-through processing across CLM-1 and CLM-2 models, cutting turnaround time from 7 days down to under 2 hours.

As the ecosystem matures, standardized loan origination architecture will be the key catalyst for scaling joint asset books.

How is your technology architecture handling real-time loan book reconciliation with partner banks?`,
      risk_lens: `Under the RBI's Default Loss Guarantee (FLDG) guidelines, aligning disparate risk appetites between banks and NBFCs is crucial.

Bank credit committees require complete portfolio transparency, granular borrower audit trails, and automated compliance verification on every originated loan file.

Building robust risk-sharing protocols ensures that joint credit portfolios remain resilient throughout evolving interest-rate and liquidity cycles.

Sustainable co-lending partnerships are founded on shared risk governance and operational alignment.

What underwriting controls are proving most vital in managing cross-institutional credit approvals?`,
      strategic_outlook: `Co-lending is evolving from tactical balance sheet tie-ups into core structural distribution architecture for Indian banking.

This model combines the underwriting speed and domain reach of specialized originators with the institutional strength of commercial banks.

The future of Indian credit delivery lies in deep collaborative ecosystems that expand priority sector lending responsibly.

Long-term success belongs to institutions that treat co-lending as a strategic technology-led franchise.

How are your partner institutions planning balance sheet allocation for joint lending in the coming quarters?`
    };
  }

  // 4. RBI, REGULATORY POLICY & COMPLIANCE
  if (hLower.includes("rbi") || hLower.includes("reserve bank") || hLower.includes("circular") || hLower.includes("guidelines") || hLower.includes("regulation") || hLower.includes("compliance") || hLower.includes("p2p") || hLower.includes("penalty") || hLower.includes("fined") || hLower.includes("ombudsman") || hLower.includes("cibil") || hLower.includes("recovery")) {
    return {
      architectural_take: `Regulatory clarity from the Reserve Bank of India is a structural tailwind for responsible lending innovation across the financial sector.

From a product and technology perspective, regulatory rules (such as RWA weightings, Key Fact Statements, loan recovery protocols, and FLDG caps) must be embedded natively into the LOS Business Rules Engine (BRE).

Automating compliance checks within the digital onboarding workflow ensures policy updates deploy across all branches and digital channels in real-time without code rebuilds.

Lenders who treat regulatory governance as core product architecture build enduring competitive advantages.

How is your team operationalizing recent RBI directives into your loan decisioning engine?`,
      risk_lens: `The RBI's focus on underwriting rigor, transparent borrower disclosure, and fair recovery practices reinforces systemic stability.

Risk and compliance committees must ensure algorithmic credit scoring models and third-party recovery channels undergo continuous audits to prevent compliance lapses.

Strengthening governance at the point of origination protects institutional reputation and prevents regulatory friction.

Sound risk culture and borrower protection are the ultimate safeguards for sustainable credit growth.

What compliance auditing frameworks is your institution deploying for third-party digital lending partners?`,
      strategic_outlook: `The Reserve Bank of India's proactive oversight continues to position India as a global benchmark for digital financial infrastructure and borrower trust.

As regulatory standards rise across digital lending and NBFC operations, institutions with robust corporate governance and capital adequacy will thrive.

Sustainable scale in banking is achieved by aligning high-velocity digital innovation with unwavering regulatory compliance.

Trust and governance remain the foundational assets of enduring financial franchises.

How is your board aligning long-term growth targets with evolving regulatory risk frameworks?`
    };
  }

  // 5. HOUSING FINANCE & LAP (MORTGAGES)
  if (hLower.includes("housing") || hLower.includes("home loan") || hLower.includes("mortgage") || hLower.includes("lap") || hLower.includes("affordable housing") || hLower.includes("property")) {
    return {
      architectural_take: `Affordable housing finance requires balancing informal income appraisal with automated digital legal and technical property validation.

Digitizing title search workflows, encumbrance verifications, and municipal registry integrations reduces mortgage sanction turnaround time from 14 days down to 48 hours.

A modern Loan Origination System (LOS) enables field officers to capture surrogate income proxies directly on mobile while central credit underwriters validate property valuation parameters in parallel.

Digitized property diligence is the key to expanding retail mortgage books securely across Tier-3 and Tier-4 markets.

How is your institution streamlining legal and technical verification for affordable housing loans?`,
      risk_lens: `In long-tenor mortgage and LAP portfolios, disciplined Asset-Liability Management (ALM) and robust collateral appraisal are paramount.

Risk committees must balance competitive interest-rate pricing with rigorous Loan-to-Value (LTV) buffers to manage property market cyclicality.

Automating collateral valuation tracking and periodic title re-checks ensures portfolio quality remains uncompromised over multi-year repayment tenors.

Prudent underwriting standards in mortgage origination safeguard balance sheet health across interest-rate cycles.

What property valuation safeguards is your credit committee emphasizing for non-salaried self-employed borrowers?`,
      strategic_outlook: `Housing credit remains the foundational anchor of Indian retail asset expansion, driving long-term customer relationships and stable book growth.

The push toward affordable housing finance is empowering millions of families with formal homeownership while strengthening bank-NBFC asset quality.

Scale in mortgage lending requires harmonizing grassroots field underwriting with modern digital collateral management platforms.

Expanding access to long-tenor secured credit is vital for India's ongoing economic transformation.

How do you foresee the growth trajectory of affordable housing finance in semi-urban and rural markets?`
    };
  }

  // 6. FINTECH FUNDING, IPOS & CAPITAL RAISES
  if (hLower.includes("funding") || hLower.includes("raises") || hLower.includes("ipo") || hLower.includes("valuation") || hLower.includes("series") || hLower.includes("seed") || hLower.includes("acquires") || hLower.includes("acquisition")) {
    return {
      architectural_take: `Capital allocation in Indian fintech has clearly transitioned from growth-at-all-costs to unit economics, healthy Net Interest Margins (NIMs), and disciplined collection efficiency.

Investing in core lending infrastructure, automated decisioning, and resilient debt collection technology provides the operational leverage needed for long-term profitability.

Fintech lenders that own their core loan origination stack achieve significantly lower customer acquisition and servicing costs at scale.

Sustainable technological moat-building is the primary driver of institutional valuation.

Where is your leadership team focusing capital investments across your lending tech stack?`,
      risk_lens: `As fintechs and NBFCs scale their balance sheets post-capital raise, maintaining counter-cyclical provisioning and Gross Stage-3 containment is essential.

Rapid disbursement acceleration must always be matched by calibrated risk scoring models and robust early delinquency alerts.

Disciplined capital deployment ensures that book growth translates into durable shareholder value across credit cycles.

Risk governance is the true differentiator between rapid growth and enduring institutional strength.

How is your risk team balancing disbursement velocity targets with strict credit score cutoffs?`,
      strategic_outlook: `The Indian fintech ecosystem is entering a mature phase of sustainable institution-building.

Capital is increasingly backing companies with deep domain expertise, proven underwriting rigor, and transparent corporate governance.

The winners of this decade will be fintechs and lenders that master both technology innovation and balance sheet risk management.

Building resilient, customer-centric financial institutions is the ultimate objective of the ecosystem.

How do you view the consolidation and IPO pipeline for Indian lending tech companies over the next 18 months?`
    };
  }

  // 7. AUTO, VEHICLE & MOBILITY FINANCE
  if (hLower.includes("vehicle") || hLower.includes("auto") || hLower.includes("car") || hLower.includes("cv ") || hLower.includes("commercial vehicle") || hLower.includes("tractor") || hLower.includes("ev ")) {
    return {
      architectural_take: `Originating commercial vehicle and retail auto finance requires seamless point-of-sale integration combined with dynamic residual asset valuation.

Modernizing dealer origination portals with automated Vahan RC verification and instant credit sanctioning enables in-showroom approvals in under 10 minutes.

As EV adoption accelerates across commercial fleets, Loan Origination Systems must incorporate battery lifecycle and secondary-market depreciation analytics into the decisioning rules.

Frictionless dealer channel integration combined with automated underwriting drives market expansion.

How is your team adapting loan origination workflows for electric vehicle financing and battery asset risk?`,
      risk_lens: `In commercial vehicle and fleet financing, underwriting models must account for fuel price volatility, freight demand cycles, and operator cashflow timing.

Deploying IoT telematics and automated collection triggers helps risk teams detect fleet underutilization and potential repayment stress early.

Robust collateral management and proactive borrower engagement ensure low portfolio delinquency across transport sectors.

Managing asset mobility risk requires continuous operational telemetry and dynamic underwriting controls.

What fleet monitoring indicators is your risk committee utilizing to manage commercial vehicle credit risk?`,
      strategic_outlook: `Mobility and commercial vehicle financing are vital arteries for India's logistics, commerce, and infrastructure growth.

Digital innovation in vehicle finance is enabling thousands of first-time fleet operators to enter the formal credit system.

Long-term success in vehicle lending belongs to institutions that combine dealer relationships with advanced automated decisioning platforms.

Financing India's transport infrastructure is a high-impact catalyst for broad-based economic prosperity.

How do you see digital distribution transforming vehicle finance penetration across Tier-2 and Tier-3 markets?`
    };
  }

  // 8. DEFAULT SENIOR BFSI PRACTITIONER COMMENTARY
  return {
    architectural_take: `A significant development for India's evolving financial and lending landscape.

Navigating this changing environment requires financial institutions to modernize their loan origination and risk decisioning pipelines—enabling agile policy adjustments while maintaining straight-through operational efficiency.

By automating KYC verification, credit rule evaluation, and core banking integrations, lenders can deliver exceptional customer turnaround times while strengthening credit quality.

Technology-driven origination agility remains the key operational moat in modern banking.

How is your institution modernizing its loan origination architecture to respond to dynamic market shifts?`,
    risk_lens: `As credit demand scales across commercial and retail segments, preserving pristine asset quality demands steadfast underwriting conservatism.

Risk committees must prioritize early-warning behavioral signals, multi-bureau indebtedness verification, and counter-cyclical provisioning buffers.

Enduring banking franchises are built on disciplined risk governance that performs consistently across credit cycles.

Proactive risk management is the bedrock of long-term balance sheet resilience.

What core credit risk metrics is your leadership team monitoring most closely in the current macro environment?`,
    strategic_outlook: `India's banking and credit ecosystem continues to demonstrate robust resilience, supported by strong economic fundamentals and progressive digital public infrastructure.

The institutions that achieve sustainable market leadership will be those that harmonize digital innovation with rigorous underwriting and high standards of corporate governance.

Responsible credit democratization is essential for unlocking India's full economic potential.

Building trusted, resilient financial institutions remains our collective mission.

How is your board positioning your credit strategy for the next phase of institutional expansion?`
  };
}

async function fetchAllExternalNews() {
  console.log('🌐 [External News Engine] Crawling live financial news across India (Mint, ETBFSI, Financial Express, NDTV Profit, Business Standard)...');
  let currentNews = loadMarketNews();
  let newArticlesAdded = 0;

  for (const stream of SEARCH_STREAMS) {
    try {
      console.log(`[External News] Scanning stream: ${stream.topic}...`);
      const xml = await fetchHttps(stream.url);
      const items = parseGoogleRss(xml, stream.topic);

      for (const item of items) {
        const { isPostBlacklisted } = require("./db");
        if (isPostBlacklisted && isPostBlacklisted(item.link, item.title)) {
          continue; // Permanently excluded via State Guardian rejection memory
        }

        if (currentNews.some(n => n.article_url === item.link || n.headline === item.title)) continue;

        // Deep Content Synthesis: Reads full article content before synthesizing takes
        let takes;
        try {
          const { synthesizeNewsArticleTakes } = require("./deepContentSynthesisAgent");
          takes = await synthesizeNewsArticleTakes(item.link, item.title, item.topic, item.publisher);
        } catch (synthErr) {
          takes = await generateMarketNewsTakes(item.title, item.topic, item.publisher);
        }

        const articleId = 'news_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const articleObj = {
          id: articleId,
          headline: item.title,
          article_url: item.link,
          publisher: item.publisher,
          source_name: item.publisher,
          source_category: item.topic,
          summary: `${item.title} (Reported by ${item.publisher})`,
          published_at: item.pubDate,
          scraped_at: new Date().toISOString(),
          status: "PENDING",
          relevance_tags: [item.publisher, "Lending News", item.topic],
          generated_takes: takes
        };

        currentNews.unshift(articleObj);
        newArticlesAdded++;
      }
    } catch (err) {
      console.error(`[External News] Error fetching stream ${stream.topic}:`, err.message);
    }
  }

  // Keep top 120 recent articles
  if (currentNews.length > 120) currentNews = currentNews.slice(0, 120);
  saveMarketNews(currentNews);

  console.log(`🎉 [External News Engine] Successfully ingested ${newArticlesAdded} fresh real-world lending articles! Total archive: ${currentNews.length}`);
  return { success: true, count: newArticlesAdded, total: currentNews.length };
}

/**
 * Regenerates high-substance takes for all existing market news items
 */
async function upgradeAllExistingNewsTakes() {
  let news = loadMarketNews();
  console.log(`🔄 Upgrading commentary for ${news.length} market news articles...`);
  for (const n of news) {
    n.generated_takes = await generateMarketNewsTakes(n.headline, n.source_category || "Digital Lending", n.publisher || "Financial Media");
  }
  saveMarketNews(news);
  console.log(`✅ Successfully upgraded all ${news.length} news items with Sriram Ganesan's authentic practitioner voice!`);
}

module.exports = {
  fetchAllExternalNews,
  generateMarketNewsTakes,
  upgradeAllExistingNewsTakes,
  loadMarketNews,
  saveMarketNews,
  SEARCH_STREAMS
};
