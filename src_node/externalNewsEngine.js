const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateCommentsForPost } = require('./commentGenerator');

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

    // Split publisher from title if format is "Headline - Publisher"
    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      if (!publisher) publisher = parts[parts.length - 1].trim();
      rawTitle = parts.slice(0, parts.length - 1).join(' - ').trim();
    }

    if (!publisher) publisher = "Financial Media";

    // Strict Noise Filter
    const lower = `${rawTitle} ${publisher}`.toLowerCase();
    if (/mlb\.com|baseball|rbi single|rbi double|homerun|cricket|marathon|fcnr|fixed deposit|nri deposit|celebration|bollywood|horoscope/i.test(lower)) {
      continue;
    }

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
    
    // Also mirror to root data
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

        // Generate Sriram Ganesan Authority Repost Draft
        const promptContext = `NEWS HEADLINE: ${item.title}\nPUBLISHER: ${item.publisher}\nTOPIC: ${item.topic}`;
        const generatedTake = await generateCommentsForPost(promptContext, item.publisher, "Fintech & Lending News");

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
          generated_takes: {
            architectural_take: generatedTake.value_add || `Critical update reported by ${item.publisher}: "${item.title}". For lending tech architects and risk leaders, modernizing LOS decisioning and automated verification pipelines is essential to capitalize on this development.`,
            risk_lens: generatedTake.provocative_question || `As highlighted by ${item.publisher}, how should credit risk and underwriting committees calibrate policy parameters to navigate this shift without spiking Gross Stage-3?`,
            strategic_outlook: generatedTake.executive_perspective || `Strategic moves in Indian lending require balancing aggressive disbursement velocity with robust credit risk governance and resilient technology infrastructure.`
          }
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

module.exports = {
  fetchAllExternalNews,
  loadMarketNews,
  saveMarketNews,
  SEARCH_STREAMS
};
