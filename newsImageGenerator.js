const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(__dirname.includes('src_node') || __dirname.includes('src') 
  ? path.join(__dirname, '..', 'public', 'generated_cards') 
  : path.join(__dirname, 'public', 'generated_cards'));

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function getThemeColors(topic = '') {
  const t = (topic || '').toLowerCase();
  if (t.includes('rbi') || t.includes('regulat') || t.includes('governance')) {
    return {
      gradient: 'linear-gradient(135deg, #091326 0%, #0f172a 50%, #1e1b4b 100%)',
      accent: '#6366f1',
      accentLight: '#a5b4fc',
      badgeBg: 'rgba(99, 102, 241, 0.15)',
      badgeBorder: 'rgba(99, 102, 241, 0.4)',
      badgeText: '#c7d2fe',
      category: '🏛️ REGULATORY & POLICY TELEMETRY'
    };
  }
  if (t.includes('gold') || t.includes('secured') || t.includes('asset')) {
    return {
      gradient: 'linear-gradient(135deg, #1c1304 0%, #17120a 50%, #2a1f0a 100%)',
      accent: '#f59e0b',
      accentLight: '#fde68a',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeBorder: 'rgba(245, 158, 11, 0.4)',
      badgeText: '#fef3c7',
      category: '🪙 SECURED RETAIL & GOLD CREDIT'
    };
  }
  if (t.includes('card') || t.includes('upi') || t.includes('payment') || t.includes('fintech')) {
    return {
      gradient: 'linear-gradient(135deg, #021a24 0%, #082f49 50%, #0c4a6e 100%)',
      accent: '#06b6d4',
      accentLight: '#67e8f9',
      badgeBg: 'rgba(6, 182, 212, 0.15)',
      badgeBorder: 'rgba(6, 182, 212, 0.4)',
      badgeText: '#cffafe',
      category: '⚡ DIGITAL LENDING & PAYMENTS'
    };
  }
  return {
    gradient: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1f2937 100%)',
    accent: '#10b981',
    accentLight: '#6ee7b7',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    badgeText: '#d1fae5',
    category: '📊 BFSI MARKET INTELLIGENCE'
  };
}

function extractKeyMetric(headline = '', text = '') {
  const combined = `${headline} ${text}`;
  const m = combined.match(/(?:₹\s*[\d,.]+\s*(?:crore|cr|lakh|bn|trillion)?|\$[\d,.]+\s*(?:million|billion|M|B)?|\b\d+(?:\.\d+)?%\b|\b\d+\s*bps\b)/i);
  return m ? m[0] : '';
}

function extractKeyPoints(text = '') {
  if (!text) return [
    'Risk-proportional supervision & market formalization',
    'Balance sheet resilience across shifting rate cycles'
  ];
  
  const sentences = text.split(/[.?!]\s+/).filter(s => s.trim().length > 25);
  const points = [];
  for (const s of sentences) {
    if (points.length >= 2) break;
    let clean = s.replace(/[^\w\s.,'’"%-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 95) clean = clean.slice(0, 92) + '...';
    if (!clean.toLowerCase().includes('how do you') && !clean.toLowerCase().includes('recent financial')) {
      points.push(clean);
    }
  }
  if (points.length === 0) {
    points.push('Strategic shift in credit dynamics and supervision');
    points.push('Operational adaptability and balance sheet governance');
  }
  return points;
}

/**
 * Generates a high-resolution 1200x630 B2B Authority Card Image
 */
async function generateNewsCardImage(articleId, headline, takeText = '', topic = '', publisher = '') {
  ensureOutputDir();
  const filename = `card_${articleId.replace(/[^a-z0-9_-]/gi, '_')}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  const theme = getThemeColors(`${topic} ${headline}`);
  const metric = extractKeyMetric(headline, takeText);
  const points = extractKeyPoints(takeText);
  const cleanHeadline = (headline || 'Financial Market Update')
    .replace(/[^\w\s.,'’"?!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: ${theme.gradient};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #f8fafc;
    padding: 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  
  /* Decorative glowing orb background */
  .glow-orb {
    position: absolute;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, ${theme.accent} 0%, rgba(0,0,0,0) 70%);
    opacity: 0.12;
    top: -100px;
    right: -100px;
    border-radius: 50%;
    filter: blur(40px);
  }

  .glow-orb-2 {
    position: absolute;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, #3b82f6 0%, rgba(0,0,0,0) 70%);
    opacity: 0.08;
    bottom: -100px;
    left: -100px;
    border-radius: 50%;
    filter: blur(50px);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 10;
  }

  .category-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: ${theme.badgeBg};
    border: 1px solid ${theme.badgeBorder};
    color: ${theme.badgeText};
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 100px;
  }

  .metric-chip {
    display: ${metric ? 'inline-flex' : 'none'};
    align-items: center;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: ${theme.accentLight};
    font-size: 16px;
    font-weight: 800;
    padding: 8px 18px;
    border-radius: 100px;
  }

  .main-content {
    position: relative;
    z-index: 10;
    margin: 20px 0;
  }

  .headline-text {
    font-size: 34px;
    line-height: 1.25;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
    max-height: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .takeaway-box {
    background: rgba(255, 255, 255, 0.04);
    border-left: 4px solid ${theme.accent};
    border-radius: 0 12px 12px 0;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .takeaway-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 16px;
    color: #cbd5e1;
    line-height: 1.4;
    font-weight: 500;
  }

  .takeaway-bullet {
    color: ${theme.accent};
    font-weight: 900;
    font-size: 18px;
    line-height: 1;
  }

  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
    position: relative;
    z-index: 10;
  }

  .author-meta {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .author-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: ${theme.accent};
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 18px;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .author-details {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
  }

  .author-title {
    font-size: 13px;
    color: #94a3b8;
  }

  .brand-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
</head>
<body>
  <div class="glow-orb"></div>
  <div class="glow-orb-2"></div>

  <div class="header-row">
    <div class="category-badge">${theme.category}</div>
    ${metric ? `<div class="metric-chip">⚡ KEY METRIC: ${metric}</div>` : ''}
  </div>

  <div class="main-content">
    <h1 class="headline-text">${cleanHeadline}</h1>
    
    <div class="takeaway-box">
      ${points.map(pt => `
        <div class="takeaway-item">
          <span class="takeaway-bullet">›</span>
          <span>${pt}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="footer-row">
    <div class="author-meta">
      <div class="author-avatar">SG</div>
      <div class="author-details">
        <div class="author-name">Sriram Ganesan</div>
        <div class="author-title">Head of LOS Product &amp; Solutions • M2P Fintech</div>
      </div>
    </div>
    <div class="brand-pill">
      <span>Strategic Industry Analysis</span>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: outputPath, type: 'png' });
    await browser.close();

    // Also sync to src_node/public/generated_cards
    const altPath = path.resolve(__dirname.includes('src_node') 
      ? path.join(__dirname, 'public', 'generated_cards', filename)
      : path.join(__dirname, 'src_node', 'public', 'generated_cards', filename));
    
    try {
      if (!fs.existsSync(path.dirname(altPath))) fs.mkdirSync(path.dirname(altPath), { recursive: true });
      fs.copyFileSync(outputPath, altPath);
    } catch (e) {}

    const webPath = `/generated_cards/${filename}`;
    return { success: true, imagePath: outputPath, imageUrl: webPath };
  } catch (err) {
    console.error(`[News Card Generator] Error generating card for ${articleId}:`, err.message);
    return null;
  }
}

module.exports = {
  generateNewsCardImage,
  getThemeColors
};
