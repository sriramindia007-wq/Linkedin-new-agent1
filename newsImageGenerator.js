const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, 'public', 'generated_cards');

function ensureOutputDir() {
  const dirs = [
    OUTPUT_DIR,
    path.join(__dirname, 'data', 'generated_cards'),
    path.join(__dirname, 'src_node', 'public', 'generated_cards'),
    path.join(__dirname, 'src_node', 'data', 'generated_cards')
  ];
  dirs.forEach(d => {
    try {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    } catch (e) {}
  });
}

// Vector SVG Icons for FinTech / BFSI Visual Storytelling
const ICONS = {
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
  scale: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>`,
  lightning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  chart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>`,
  building: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M8 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M16 14h.01"></path></svg>`,
  sparkle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>`,
  pulse: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
};

function getThemeColors(topic = '', headline = '') {
  const combined = `${topic} ${headline}`.toLowerCase();
  
  if (combined.includes('rbi') || combined.includes('regulation') || combined.includes('governance') || combined.includes('compliance') || combined.includes('kfs') || combined.includes('flgd')) {
    return {
      gradient: 'linear-gradient(135deg, #090e1a 0%, #0f1c3f 50%, #172a5a 100%)',
      accent: '#6366f1',
      accentLight: '#818cf8',
      accentGlow: 'rgba(99, 102, 241, 0.35)',
      cardBg: 'rgba(15, 28, 63, 0.75)',
      cardBorder: 'rgba(99, 102, 241, 0.45)',
      badgeBg: 'rgba(99, 102, 241, 0.2)',
      badgeBorder: 'rgba(99, 102, 241, 0.5)',
      badgeText: '#c7d2fe',
      icon: ICONS.shield,
      category: 'REGULATORY & POLICY TELEMETRY'
    };
  }
  if (combined.includes('gold') || combined.includes('lap') || combined.includes('secured') || combined.includes('msme') || combined.includes('mortgage') || combined.includes('asset quality') || combined.includes('npa') || combined.includes('unsecured')) {
    return {
      gradient: 'linear-gradient(135deg, #140d04 0%, #2b1805 50%, #422507 100%)',
      accent: '#f59e0b',
      accentLight: '#fbbf24',
      accentGlow: 'rgba(245, 158, 11, 0.35)',
      cardBg: 'rgba(43, 24, 5, 0.75)',
      cardBorder: 'rgba(245, 158, 11, 0.45)',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      badgeBorder: 'rgba(245, 158, 11, 0.5)',
      badgeText: '#fef3c7',
      icon: ICONS.scale,
      category: 'SECURED CREDIT & NBFC GROWTH'
    };
  }
  if (combined.includes('digital') || combined.includes('upi') || combined.includes('card') || combined.includes('fintech') || combined.includes('app') || combined.includes('origination')) {
    return {
      gradient: 'linear-gradient(135deg, #05131e 0%, #08283e 50%, #0d4263 100%)',
      accent: '#06b6d4',
      accentLight: '#22d3ee',
      accentGlow: 'rgba(6, 182, 212, 0.35)',
      cardBg: 'rgba(8, 40, 62, 0.75)',
      cardBorder: 'rgba(6, 182, 212, 0.45)',
      badgeBg: 'rgba(6, 182, 212, 0.2)',
      badgeBorder: 'rgba(6, 182, 212, 0.5)',
      badgeText: '#cffafe',
      icon: ICONS.lightning,
      category: 'DIGITAL LENDING & PAYMENTS'
    };
  }
  return {
    gradient: 'linear-gradient(135deg, #061512 0%, #0b241e 50%, #11382f 100%)',
    accent: '#10b981',
    accentLight: '#34d399',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    cardBg: 'rgba(17, 56, 47, 0.75)',
    cardBorder: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeBorder: 'rgba(16, 185, 129, 0.5)',
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

function extractExecutiveTakeaways(text = '', headline = '', topic = '') {
  let combined = (text || '').replace(/\r?\n/g, ' ');
  combined = combined.replace(/https?:\/\/\S+/g, '').replace(/#[a-zA-Z0-9_]+/g, '').trim();

  // If text contains quotes of headline, remove them to get substantive analysis
  if (headline) {
    const escaped = headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    combined = combined.replace(new RegExp(`"?${escaped}"?`, 'gi'), '').trim();
  }

  const rawSentences = combined
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && 
                 !s.toLowerCase().includes('how is your') && 
                 !s.toLowerCase().includes('how do you') && 
                 !s.toLowerCase().includes('recent financial reporting') &&
                 !s.toLowerCase().includes('detailed article link') &&
                 !s.toLowerCase().includes('highlights significant developments') &&
                 !s.toLowerCase().includes('the structural developments surrounding') &&
                 !s.toLowerCase().includes('the report from'));

  let architectural = '';
  let impact = '';

  for (const s of rawSentences) {
    const lower = s.toLowerCase();
    if (!architectural && (lower.includes('origination') || lower.includes('bre') || lower.includes('stp') || lower.includes('architecture') || lower.includes('balance sheet') || lower.includes('structural') || lower.includes('infrastructure') || lower.includes('growth') || lower.includes('shift') || lower.includes('digital') || lower.includes('technology') || lower.includes('platform') || lower.includes('lenders') || lower.includes('portfolio'))) {
      architectural = s;
    } else if (!impact && (lower.includes('risk') || lower.includes('underwriting') || lower.includes('governance') || lower.includes('telemetry') || lower.includes('compliance') || lower.includes('delinquency') || lower.includes('credit') || lower.includes('provisioning') || lower.includes('discipline') || lower.includes('safeguard') || lower.includes('capital'))) {
      impact = s;
    }
  }

  // High-value domain fallback takes if text was generic
  if (!architectural) {
    architectural = 'Structural recalibration towards secured balance sheet growth, modular BRE rule orchestration, and lower cost of funds.';
  }
  if (!impact) {
    impact = 'Tightening underwriting boundaries with proactive delinquency telemetry, counter-cyclical provisioning, and credit discipline.';
  }

  // Clean trailing punctuation or hanging quotes
  architectural = architectural.replace(/^[“"':-]\s*/, '').replace(/\s*[”"']$/, '').trim();
  impact = impact.replace(/^[“"':-]\s*/, '').replace(/\s*[”"']$/, '').trim();

  // Natural sentence wrap bounds (no slicing mid-word)
  if (architectural.length > 185) {
    const trimmed = architectural.slice(0, 180);
    architectural = trimmed.slice(0, trimmed.lastIndexOf(' ')) + '.';
  }
  if (impact.length > 185) {
    const trimmed = impact.slice(0, 180);
    impact = trimmed.slice(0, trimmed.lastIndexOf(' ')) + '.';
  }

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
  const takeaways = extractExecutiveTakeaways(takeText, headline, topic);

  // Clean headline
  let cleanHeadline = (headline || 'Financial Market Intelligence Briefing')
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
    color: #ffffff;
    overflow: hidden;
    position: relative;
    padding: 0;
  }

  .container {
    width: 1200px;
    height: 630px;
    padding: 36px 48px;
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
    opacity: 0.22;
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
    opacity: 0.14;
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
    background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%);
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
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    flex: 1;
    margin: 14px 0;
    gap: 16px;
  }

  .headline-box {
    position: relative;
  }

  .headline-title {
    font-size: 32px;
    line-height: 1.25;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }

  /* 2-Column Executive Impact Cards */
  .takeaway-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .takeaway-card {
    background: ${theme.cardBg};
    border: 1.5px solid ${theme.cardBorder};
    backdrop-filter: blur(16px);
    border-radius: 16px;
    padding: 22px 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 150px;
  }

  .card-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${theme.accentLight};
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .card-body-text {
    font-size: 15.5px;
    line-height: 1.5;
    color: #f1f5f9;
    font-weight: 500;
  }

  /* Footer Row */
  .footer-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-top: 14px;
    position: relative;
    z-index: 10;
    height: 56px;
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

  <div class="container">
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
          <div class="author-subtitle">BFSI Thought Leader &amp; Lending Practitioner</div>
        </div>
      </div>

      <div class="footer-meta-pill">
        ${ICONS.pulse}
        <span>Executive Intelligence Briefing</span>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: outputPath, type: 'png' });
    await browser.close();

    // Mirror to sync paths
    const mirrorPaths = [
      path.join(__dirname, 'data', 'generated_cards', filename),
      path.join(__dirname, 'src_node', 'public', 'generated_cards', filename),
      path.join(__dirname, 'src_node', 'data', 'generated_cards', filename)
    ];
    mirrorPaths.forEach(mp => {
      try {
        fs.copyFileSync(outputPath, mp);
      } catch (e) {}
    });

    console.log(`🎨 [Fintech Pulse] Generated 1200x630 visual card: ${outputPath}`);
    return {
      imageUrl: `/generated_cards/${filename}`,
      imagePath: outputPath
    };
  } catch (err) {
    console.error('Error generating card image:', err.message);
    return null;
  }
}

module.exports = {
  generateNewsCardImage
};
