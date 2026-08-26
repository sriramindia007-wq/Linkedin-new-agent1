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

// Inline Crisp SVG Icons
const ICONS = {
  pulse: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>`,
  lightning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  chart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  scale: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>`,
  building: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="2"></line><line x1="8" y1="6" x2="10" y2="6"></line><line x1="14" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="10" y2="10"></line><line x1="14" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="10" y2="14"></line><line x1="14" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="10" y2="18"></line><line x1="14" y1="18" x2="16" y2="18"></line></svg>`,
  sparkle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.8 9.2L24 12l-9.2 2.8L12 24l-2.8-9.2L0 12l9.2-2.8z"></path></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

function getThemeColors(topic = '', headline = '') {
  const text = `${topic} ${headline}`.toLowerCase();
  
  if (text.includes('rbi') || text.includes('regulat') || text.includes('threshold') || text.includes('governance') || text.includes('idf') || text.includes('exposure')) {
    return {
      gradient: 'linear-gradient(135deg, #070d1e 0%, #0d172e 50%, #171c38 100%)',
      accent: '#6366f1',
      accentLight: '#818cf8',
      accentGlow: 'rgba(99, 102, 241, 0.25)',
      cardBg: 'rgba(30, 41, 59, 0.55)',
      cardBorder: 'rgba(99, 102, 241, 0.35)',
      badgeBg: 'rgba(99, 102, 241, 0.18)',
      badgeBorder: 'rgba(99, 102, 241, 0.45)',
      badgeText: '#c7d2fe',
      icon: ICONS.shield,
      category: 'REGULATORY & POLICY TELEMETRY'
    };
  }
  if (text.includes('gold') || text.includes('secured') || text.includes('asset quality') || text.includes('npa') || text.includes('nbfc')) {
    return {
      gradient: 'linear-gradient(135deg, #150f04 0%, #1e1507 50%, #2a1f0a 100%)',
      accent: '#f59e0b',
      accentLight: '#fbbf24',
      accentGlow: 'rgba(245, 158, 11, 0.25)',
      cardBg: 'rgba(42, 31, 10, 0.55)',
      cardBorder: 'rgba(245, 158, 11, 0.35)',
      badgeBg: 'rgba(245, 158, 11, 0.18)',
      badgeBorder: 'rgba(245, 158, 11, 0.45)',
      badgeText: '#fef3c7',
      icon: ICONS.scale,
      category: 'SECURED CREDIT & NBFC GROWTH'
    };
  }
  if (text.includes('card') || text.includes('upi') || text.includes('payment') || text.includes('los') || text.includes('digital lending') || text.includes('fintech')) {
    return {
      gradient: 'linear-gradient(135deg, #021724 0%, #062b3d 50%, #0b3d54 100%)',
      accent: '#06b6d4',
      accentLight: '#22d3ee',
      accentGlow: 'rgba(6, 182, 212, 0.25)',
      cardBg: 'rgba(11, 61, 84, 0.55)',
      cardBorder: 'rgba(6, 182, 212, 0.35)',
      badgeBg: 'rgba(6, 182, 212, 0.18)',
      badgeBorder: 'rgba(6, 182, 212, 0.45)',
      badgeText: '#cffafe',
      icon: ICONS.lightning,
      category: 'DIGITAL LENDING & PAYMENTS'
    };
  }
  return {
    gradient: 'linear-gradient(135deg, #061512 0%, #0b241e 50%, #11382f 100%)',
    accent: '#10b981',
    accentLight: '#34d399',
    accentGlow: 'rgba(16, 185, 129, 0.25)',
    cardBg: 'rgba(17, 56, 47, 0.55)',
    cardBorder: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    badgeBorder: 'rgba(16, 185, 129, 0.45)',
    badgeText: '#d1fae5',
    icon: ICONS.chart,
    category: 'BFSI & CREDIT INTELLIGENCE'
  };
}

function extractKeyMetric(headline = '', text = '') {
  const combined = `${headline} ${text}`;
  const m = combined.match(/(?:₹\s*[\d,.]+\s*(?:crore|cr|lakh|bn|trillion)?|\$[\d,.]+\s*(?:million|billion|M|B)?|\b\d+(?:\.\d+)?%\b|\b\d+\s*bps\b)/i);
  return m ? m[0] : '';
}

function extractExecutiveTakeaways(text = '', headline = '') {
  const combined = text || headline || '';
  const sentences = combined
    .replace(/[^\w\s.,'’"%-]/g, ' ')
    .split(/[.?!]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && !s.toLowerCase().includes('how do you') && !s.toLowerCase().includes('recent financial'));

  let architectural = sentences[0] || 'Strategic recalibration of balance sheet risk and operational infrastructure.';
  let impact = sentences[1] || sentences[2] || 'Proactive risk governance and automated underwriting safeguards.';

  // Bound lengths tightly to avoid any cut-off
  if (architectural.length > 105) architectural = architectural.slice(0, 102) + '...';
  if (impact.length > 105) impact = impact.slice(0, 102) + '...';

  return { architectural, impact };
}

/**
 * Generates a high-resolution 1200x630 B2B Authority Card Image with Fintech Pulse branding
 */
async function generateNewsCardImage(articleId, headline, takeText = '', topic = '', publisher = '') {
  ensureOutputDir();
  const filename = `card_${articleId.replace(/[^a-z0-9_-]/gi, '_')}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  const theme = getThemeColors(topic, headline);
  const metric = extractKeyMetric(headline, takeText);
  const takeaways = extractExecutiveTakeaways(takeText, headline);

  // Clean and clamp headline
  let cleanHeadline = (headline || 'Financial Market Intelligence Briefing')
    .replace(/[^\w\s.,'’"?!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanHeadline.length > 115) {
    cleanHeadline = cleanHeadline.slice(0, 112) + '...';
  }

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
    padding: 34px 44px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  /* Grid pattern overlay */
  .grid-pattern {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.7;
    z-index: 1;
  }

  /* Glowing background orbs */
  .glow-orb-top {
    position: absolute;
    width: 550px;
    height: 550px;
    background: radial-gradient(circle, ${theme.accent} 0%, rgba(0,0,0,0) 70%);
    opacity: 0.18;
    top: -160px;
    right: -120px;
    border-radius: 50%;
    filter: blur(55px);
    z-index: 2;
  }
  .glow-orb-bottom {
    position: absolute;
    width: 450px;
    height: 450px;
    background: radial-gradient(circle, #3b82f6 0%, rgba(0,0,0,0) 70%);
    opacity: 0.12;
    bottom: -160px;
    left: -120px;
    border-radius: 50%;
    filter: blur(60px);
    z-index: 2;
  }

  /* Header Row */
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 10;
    height: 44px;
  }

  .brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pulse-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%);
    border: 1.5px solid ${theme.accent};
    box-shadow: 0 0 20px ${theme.accentGlow};
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 7px 16px;
    border-radius: 100px;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background: ${theme.accentLight};
    border-radius: 50%;
    box-shadow: 0 0 8px ${theme.accentLight};
  }

  .category-tag {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: ${theme.badgeBg};
    border: 1px solid ${theme.badgeBorder};
    color: ${theme.badgeText};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 100px;
  }

  .metric-badge {
    display: ${metric ? 'inline-flex' : 'none'};
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1.5px solid ${theme.accentLight};
    box-shadow: 0 0 16px ${theme.accentGlow};
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    padding: 7px 18px;
    border-radius: 100px;
  }

  /* Center Main Content */
  .content-area {
    position: relative;
    z-index: 10;
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .headline-box {
    position: relative;
  }

  .headline-title {
    font-size: 30px;
    line-height: 1.28;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    max-height: 80px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* 2-Column Executive Impact Cards */
  .takeaway-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .takeaway-card {
    background: ${theme.cardBg};
    border: 1.5px solid ${theme.cardBorder};
    backdrop-filter: blur(16px);
    border-radius: 14px;
    padding: 16px 20px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${theme.accentLight};
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .card-body-text {
    font-size: 15px;
    line-height: 1.42;
    color: #e2e8f0;
    font-weight: 500;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  /* Footer Row */
  .footer-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-top: 16px;
    position: relative;
    z-index: 10;
    height: 60px;
  }

  .author-profile {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .avatar-badge {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${theme.accent} 0%, #1e1b4b 100%);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 17px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .author-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .author-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
  }

  .author-subtitle {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .footer-meta-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="glow-orb-top"></div>
  <div class="glow-orb-bottom"></div>

  <!-- Header Bar -->
  <div class="header-bar">
    <div class="brand-group">
      <div class="pulse-badge">
        <div class="pulse-dot"></div>
        <span>FINTECH PULSE</span>
      </div>
      <div class="category-tag">
        ${theme.icon}
        <span>${theme.category}</span>
      </div>
    </div>
    ${metric ? `
      <div class="metric-badge">
        ${ICONS.lightning}
        <span>${metric}</span>
      </div>
    ` : ''}
  </div>

  <!-- Main Content Area -->
  <div class="content-area">
    <div class="headline-box">
      <h1 class="headline-title">${cleanHeadline}</h1>
    </div>

    <!-- 2-Column Impact Cards -->
    <div class="takeaway-grid">
      <div class="takeaway-card">
        <div class="card-label-row">
          ${ICONS.shield}
          <span>Architectural &amp; Balance Sheet Shift</span>
        </div>
        <p class="card-body-text">${takeaways.architectural}</p>
      </div>

      <div class="takeaway-card">
        <div class="card-label-row">
          ${ICONS.chart}
          <span>Risk, Underwriting &amp; Market Outlook</span>
        </div>
        <p class="card-body-text">${takeaways.impact}</p>
      </div>
    </div>
  </div>

  <!-- Footer Bar -->
  <div class="footer-bar">
    <div class="author-profile">
      <div class="avatar-badge">SG</div>
      <div class="author-info">
        <div class="author-name-row">
          <span>Sriram Ganesan</span>
          <span style="color: ${theme.accentLight};">${ICONS.sparkle}</span>
        </div>
        <div class="author-subtitle">Corporate Director Aspirant &amp; BFSI Thought Leader</div>
      </div>
    </div>

    <div class="footer-meta-pill">
      ${ICONS.pulse}
      <span>Executive Intelligence Briefing</span>
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
