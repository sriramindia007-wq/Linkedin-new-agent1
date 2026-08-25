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
      architectural_take: `The influx of institutional capital into gold loans reflects a massive shift from unorganized pawn channels to formal lending. From an LOS architecture standpoint, the winning differentiator is no longer just branch appraisal, but doorstep digitization, live LTV tracking against daily gold-price feeds, and automated instant disbursal in under 15 minutes.`,
      risk_lens: `With rapid expansion in gold-backed credit, how are risk committees strengthening automated margin-call triggers and collateral re-valuation workflows to safeguard against sudden commodity price corrections while maintaining the 75% RBI LTV ceiling?`,
      strategic_outlook: `Gold loans remain one of India's most resilient secured retail credit categories. As large corporations and NBFCs enter this segment, scalable digital origination combined with robust vault custodian governance will decide market leadership.`
    };
  }

  // 2. MSME, CASHFLOW & SUPPLY CHAIN LENDING (TREDS, GST, INVOICE DISCOUNTING)
  if (hLower.includes("msme") || hLower.includes("sme") || hLower.includes("supply chain") || hLower.includes("treds") || hLower.includes("invoice") || hLower.includes("working capital") || hLower.includes("cashflow")) {
    return {
      architectural_take: `Unlocking formal credit for informal MSMEs requires moving beyond static audited balance sheets. Modern LOS platforms must ingest real-time cashflow telemetry—leveraging GST invoice reconciliation, Account Aggregator banking streams, and e-way bill velocity to make automated credit decisions within minutes.`,
      risk_lens: `As lenders accelerate cashflow-based lending to Tier-2/3 enterprises, what early-warning indicators (SMA-0 behavior, buyer concentration, tax filing gaps) are proving most effective in mitigating cashflow compression before repayment stress occurs?`,
      strategic_outlook: `The next wave of MSME credit growth in India will be driven by transaction-level financing rather than pure collateral. Bridging the credit gap requires seamless integration between fintech originators, digital public infrastructure, and balance-sheet lenders.`
    };
  }

  // 3. CO-LENDING & BANK-NBFC PARTNERSHIPS
  if (hLower.includes("co-lending") || hLower.includes("colending") || hLower.includes("partnership") || hLower.includes("fldg") || hLower.includes("syndicate") || hLower.includes("tie up") || hLower.includes("team up")) {
    return {
      architectural_take: `Bank-NBFC co-lending is the single most potent bridge between low-cost bank deposits and grassroots NBFC distribution. The critical tech bottleneck has always been dual-LOS underwriting latency and real-time tripartite escrow settlements. Modernizing this pipeline enables true straight-through processing across CLM-1 and CLM-2 models.`,
      risk_lens: `Under the RBI's Default Loss Guarantee (FLDG) guidelines, how are partner institutions aligning their risk appetite matrices to prevent underwriting friction while ensuring complete portfolio transparency on the bank's books?`,
      strategic_outlook: `Co-lending is evolving from opportunistic tie-ups into core distribution architecture for Indian banking. Sustainable scale requires standardized risk-sharing protocols and automated compliance auditing.`
    };
  }

  // 4. RBI, REGULATORY POLICY & COMPLIANCE
  if (hLower.includes("rbi") || hLower.includes("reserve bank") || hLower.includes("circular") || hLower.includes("guidelines") || hLower.includes("regulation") || hLower.includes("compliance") || hLower.includes("p2p") || hLower.includes("penalty") || hLower.includes("fined") || hLower.includes("ombudsman") || hLower.includes("cibil") || hLower.includes("recovery")) {
    return {
      architectural_take: `Regulatory clarity from the RBI is a structural tailwind for responsible lending innovation. From a product perspective, regulatory rules (such as RWA weightings, key fact statements, loan recovery guidelines, and FLDG caps) must be embedded natively into the LOS business rules engine (BRE) so policy updates deploy in real-time without code rebuilds.`,
      risk_lens: `How are compliance and risk teams auditing automated lending workflows to ensure algorithmic underwriting and third-party recovery channels remain 100% compliant with RBI directives?`,
      strategic_outlook: `The RBI's proactive oversight reinforces trust in India's digital financial architecture. Long-term institutional value is created by lenders who treat regulatory governance and borrower protection as core competitive moats.`
    };
  }

  // 5. HOUSING FINANCE & LAP (MORTGAGES)
  if (hLower.includes("housing") || hLower.includes("home loan") || hLower.includes("mortgage") || hLower.includes("lap") || hLower.includes("affordable housing") || hLower.includes("property")) {
    return {
      architectural_take: `Affordable housing finance requires balancing informal income assessment with digital legal/technical property validation. Digitizing title search workflows and municipal registry integrations reduces TAT from 14 days down to 48 hours without compromising credit diligence.`,
      risk_lens: `In long-tenor mortgage portfolios, what asset-liability management (ALM) safeguards and interest-rate transmission mechanisms are risk teams prioritizing during shifting monetary policy cycles?`,
      strategic_outlook: `Housing credit remains the bedrock of Indian retail asset expansion. Digital enablement in Tier-3/4 markets is unlocking homeownership for millions of previously unserved families.`
    };
  }

  // 6. FINTECH FUNDING, IPOS & CAPITAL RAISES
  if (hLower.includes("funding") || hLower.includes("raises") || hLower.includes("ipo") || hLower.includes("valuation") || hLower.includes("series") || hLower.includes("seed") || hLower.includes("acquires") || hLower.includes("acquisition")) {
    return {
      architectural_take: `Capital allocation in Indian fintech has clearly shifted from growth-at-all-costs to unit economics, sustainable net interest margins (NIMs), and disciplined collection efficiency. Investing in core lending infrastructure and automated decisioning provides the operational leverage needed for long-term profitability.`,
      risk_lens: `As fintechs scale their asset books post-funding, how are leadership teams balancing rapid disbursement growth with counter-cyclical provisioning and Gross Stage-3 containment?`,
      strategic_outlook: `The Indian fintech ecosystem is maturing into sustainable institution-building. Capital backing institutions with strong governance, deep domain expertise, and sound risk underwriting will define the decade.`
    };
  }

  // 7. AUTO, VEHICLE & MOBILITY FINANCE
  if (hLower.includes("vehicle") || hLower.includes("auto") || hLower.includes("car") || hLower.includes("cv ") || hLower.includes("commercial vehicle") || hLower.includes("tractor") || hLower.includes("ev ")) {
    return {
      architectural_take: `Originating commercial and retail vehicle finance requires seamless coordination at the point of sale combined with dynamic residual asset valuation. Modernizing dealer origination portals and automated RC verification enables instant in-showroom credit sanctioning.`,
      risk_lens: `In commercial vehicle and fleet financing, how are risk teams structuring underwriting to accommodate fuel/operational cost volatility while maintaining timely collection cycles?`,
      strategic_outlook: `Mobility and asset financing thrive when sound collateral governance and fast dealer-channel origination work in tandem to support productive enterprise transport.`
    };
  }

  // 8. DEFAULT SENIOR BFSI PRACTITIONER COMMENTARY
  return {
    architectural_take: `A significant development for the Indian credit landscape. Navigating this evolving market environment requires financial institutions to modernize their loan origination and risk decisioning pipelines—enabling agile policy adjustments while maintaining straight-through operational efficiency.`,
    risk_lens: `As credit demand scales across retail and commercial segments, what underwriting controls and portfolio monitoring mechanisms are risk committees prioritizing to preserve pristine asset quality across credit cycles?`,
    strategic_outlook: `Sustainable financial leadership in India is built on the pillars of disciplined underwriting, robust regulatory governance, and customer-centric digital technology.`
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
        if (currentNews.some(n => n.article_url === item.link || n.headline === item.title)) continue;

        // Generate Sriram Ganesan Bespoke Authority Repost Takes
        const takes = await generateMarketNewsTakes(item.title, item.topic, item.publisher);

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
