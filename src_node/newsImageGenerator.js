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
  pulseLogo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  radar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h.01"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/></svg>`,
  origination: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  shield: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  scale: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  chart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
  sparkle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  arrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
};

function getThemeColors(topic = '', headline = '') {
  const combined = `${topic} ${headline}`.toLowerCase();
  
  if (combined.includes('rbi') || combined.includes('regulation') || combined.includes('governance') || combined.includes('compliance') || combined.includes('kfs') || combined.includes('flgd') || combined.includes('policy')) {
    return {
      gradient: 'linear-gradient(145deg, #070c18 0%, #0d1630 45%, #132048 100%)',
      accent: '#6366f1',
      accentLight: '#818cf8',
      accentGlow: 'rgba(99, 102, 241, 0.4)',
      cardBg: 'rgba(19, 32, 72, 0.65)',
      cardBorder: 'rgba(99, 102, 241, 0.35)',
      badgeBg: 'rgba(99, 102, 241, 0.2)',
      badgeBorder: 'rgba(99, 102, 241, 0.5)',
      badgeText: '#c7d2fe',
      icon1: ICONS.radar,
      icon2: ICONS.origination,
      icon3: ICONS.shield,
      category: 'REGULATORY & POLICY TELEMETRY'
    };
  }
  if (combined.includes('gold') || combined.includes('lap') || combined.includes('secured') || combined.includes('msme') || combined.includes('mortgage') || combined.includes('asset quality') || combined.includes('npa') || combined.includes('unsecured')) {
    return {
      gradient: 'linear-gradient(145deg, #100a04 0%, #241405 45%, #381f08 100%)',
      accent: '#f59e0b',
      accentLight: '#fbbf24',
      accentGlow: 'rgba(245, 158, 11, 0.4)',
      cardBg: 'rgba(56, 31, 8, 0.65)',
      cardBorder: 'rgba(245, 158, 11, 0.35)',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      badgeBorder: 'rgba(245, 158, 11, 0.5)',
      badgeText: '#fef3c7',
      icon1: ICONS.radar,
      icon2: ICONS.scale,
      icon3: ICONS.shield,
      category: 'SECURED CREDIT & NBFC GROWTH'
    };
  }
  if (combined.includes('digital') || combined.includes('upi') || combined.includes('card') || combined.includes('fintech') || combined.includes('app') || combined.includes('origination')) {
    return {
      gradient: 'linear-gradient(145deg, #030f18 0%, #061e30 45%, #0b304c 100%)',
      accent: '#06b6d4',
      accentLight: '#22d3ee',
      accentGlow: 'rgba(6, 182, 212, 0.4)',
      cardBg: 'rgba(11, 48, 76, 0.65)',
      cardBorder: 'rgba(6, 182, 212, 0.35)',
      badgeBg: 'rgba(6, 182, 212, 0.2)',
      badgeBorder: 'rgba(6, 182, 212, 0.5)',
      badgeText: '#cffafe',
      icon1: ICONS.radar,
      icon2: ICONS.origination,
      icon3: ICONS.chart,
      category: 'DIGITAL LENDING & PAYMENTS'
    };
  }
  return {
    gradient: 'linear-gradient(145deg, #04120e 0%, #08201a 45%, #0f352c 100%)',
    accent: '#10b981',
    accentLight: '#34d399',
    accentGlow: 'rgba(16, 185, 129, 0.4)',
    cardBg: 'rgba(15, 53, 44, 0.65)',
    cardBorder: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeBorder: 'rgba(16, 185, 129, 0.5)',
    badgeText: '#d1fae5',
    icon1: ICONS.radar,
    icon2: ICONS.chart,
    icon3: ICONS.shield,
    category: 'BFSI & CREDIT INTELLIGENCE'
  };
}

function extractKeyMetric(headline = '', text = '') {
  const combined = `${headline} ${text}`;
  const m = combined.match(/(?:₹\s*[\d,.]+\s*(?:crore|cr|lakh|bn|trillion)?|\$[\d,.]+\s*(?:million|billion|M|B)?|\b\d+(?:\.\d+)?%\b|\b\d+\s*bps\b)/i);
  return m ? m[0] : '';
}

/**
 * Extracts 3 distinct, complete, high-impact executive takeaways for the 3-pillar infographic
 */
function extractPictorialPillars(text = '', headline = '', topic = '') {
  let combined = (text || '').replace(/\r?\n/g, ' ');
  combined = combined.replace(/https?:\/\/\S+/g, '').replace(/#[a-zA-Z0-9_]+/g, '').trim();

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

  let p1 = ''; // Market Shift
  let p2 = ''; // Platform / Origination
  let p3 = ''; // Risk / Governance

  for (const s of rawSentences) {
    const lower = s.toLowerCase();
    if (!p1 && (lower.includes('market') || lower.includes('growth') || lower.includes('trend') || lower.includes('shift') || lower.includes('banks') || lower.includes('nbfc') || lower.includes('sector'))) {
      p1 = s;
    } else if (!p2 && (lower.includes('origination') || lower.includes('bre') || lower.includes('stp') || lower.includes('workflow') || lower.includes('platform') || lower.includes('digital') || lower.includes('automation') || lower.includes('architecture'))) {
      p2 = s;
    } else if (!p3 && (lower.includes('risk') || lower.includes('underwriting') || lower.includes('governance') || lower.includes('telemetry') || lower.includes('delinquency') || lower.includes('compliance') || lower.includes('provisioning') || lower.includes('safeguard'))) {
      p3 = s;
    }
  }

  // Fallbacks if not detected in text
  if (!p1) p1 = rawSentences[0] || 'Market recalibration shifting capital towards disciplined, high-quality balance sheet assets.';
  if (!p2) p2 = rawSentences[1] || 'Institutions modernizing rule orchestration engines (BRE) and straight-through origination.';
  if (!p3) p3 = rawSentences[2] || 'Strengthening early delinquency telemetry, risk-based pricing, and underwriting governance.';

  // Clean quotes
  const clean = str => {
    let s = str.replace(/^[“"':-]\s*/, '').replace(/\s*[”"']$/, '').trim();
    if (s.length > 140) {
      const trimmed = s.slice(0, 135);
      s = trimmed.slice(0, trimmed.lastIndexOf(' ')) + '.';
    }
    return s;
  };

  return {
    pillar1: clean(p1),
    pillar2: clean(p2),
    pillar3: clean(p3)
  };
}

/**
 * Generates a high-resolution 1200x630 Executive Infographic Card with Fintech Pulse branding
 */
async function generateNewsCardImage(articleId, headline, takeText = '', topic = '', publisher = '') {
  ensureOutputDir();
  const filename = `card_${articleId.replace(/[^a-z0-9_-]/gi, '_')}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  const theme = getThemeColors(topic, headline);
  const metric = extractKeyMetric(headline, takeText);
  const pillars = extractPictorialPillars(takeText, headline, topic);

  // Clean headline
  let cleanHeadline = (headline || 'Financial Market Intelligence Briefing')
    .replace(/[^\w\s.,'’"?!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Dynamic font sizing to prevent any overflow
  const headlineFontSize = cleanHeadline.length > 75 ? '25px' : '29px';

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
  }

  .container {
    width: 1200px;
    height: 630px;
    padding: 32px 46px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    z-index: 10;
  }

  /* Grid pattern overlay */
  .grid-pattern {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1.2px, transparent 1.2px);
    background-size: 26px 26px;
    opacity: 0.75;
    z-index: 1;
  }

  /* Glowing background orbs */
  .glow-orb-1 {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, ${theme.accent} 0%, rgba(0,0,0,0) 70%);
    opacity: 0.22;
    top: -200px;
    right: -100px;
    border-radius: 50%;
    filter: blur(60px);
    z-index: 2;
  }
  .glow-orb-2 {
    position: absolute;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, #0284c7 0%, rgba(0,0,0,0) 70%);
    opacity: 0.15;
    bottom: -180px;
    left: -100px;
    border-radius: 50%;
    filter: blur(65px);
    z-index: 2;
  }

  /* Header Bar with prominent FINTECH PULSE Branding */
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 46px;
  }

  .brand-masthead {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-emblem {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%);
    border: 1.5px solid ${theme.accentLight};
    box-shadow: 0 0 24px ${theme.accentGlow}, inset 0 0 12px rgba(255,255,255,0.1);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 7px 18px;
    border-radius: 100px;
  }

  .pulse-icon-svg {
    color: ${theme.accentLight};
    display: flex;
    align-items: center;
  }

  .category-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: ${theme.badgeBg};
    border: 1px solid ${theme.badgeBorder};
    color: ${theme.badgeText};
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 100px;
  }

  .metric-pill {
    display: ${metric ? 'inline-flex' : 'none'};
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1.5px solid ${theme.accentLight};
    box-shadow: 0 0 16px ${theme.accentGlow};
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    padding: 6px 16px;
    border-radius: 100px;
  }

  /* Headline Block */
  .headline-section {
    margin: 4px 0 10px 0;
  }

  .headline-text {
    font-size: ${headlineFontSize};
    line-height: 1.28;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.015em;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }

  /* 3-Pillar Pictorial Infographic Grid */
  .infographic-flow {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 6px;
  }

  .pillar-card {
    background: ${theme.cardBg};
    border: 1.5px solid ${theme.cardBorder};
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.45);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 230px;
    position: relative;
  }

  .pillar-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .pillar-icon-medallion {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${theme.accent} 0%, rgba(255,255,255,0.1) 100%);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 14px ${theme.accentGlow};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
  }

  .pillar-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pillar-step-badge {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: ${theme.accentLight};
    text-transform: uppercase;
  }

  .pillar-title {
    font-size: 13.5px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .pillar-body {
    font-size: 14.5px;
    line-height: 1.48;
    color: #f1f5f9;
    font-weight: 500;
    margin-top: 4px;
  }

  .pillar-footer-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: ${theme.accentLight};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 10px;
  }

  /* Footer Bar */
  .footer-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-top: 12px;
    height: 52px;
  }

  .author-profile {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar-badge {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: linear-gradient(135deg, ${theme.accent} 0%, #1e1b4b 100%);
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .author-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .author-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
  }

  .author-subtitle {
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 500;
  }

  .footer-series-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 7px 16px;
    border-radius: 10px;
    font-size: 11.5px;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="glow-orb-1"></div>
  <div class="glow-orb-2"></div>

  <div class="container">
    <!-- Header Bar with FINTECH PULSE Branding -->
    <div class="header-bar">
      <div class="brand-masthead">
        <div class="brand-emblem">
          <div class="pulse-icon-svg">${ICONS.pulseLogo}</div>
          <span>FINTECH PULSE</span>
        </div>
        <div class="category-pill">
          <span>${theme.category}</span>
        </div>
      </div>
      ${metric ? `
        <div class="metric-pill">
          ${ICONS.sparkle}
          <span>${metric}</span>
        </div>
      ` : ''}
    </div>

    <!-- Headline Section -->
    <div class="headline-section">
      <h1 class="headline-text">${cleanHeadline}</h1>
    </div>

    <!-- 3-Pillar Pictorial Infographic Flow -->
    <div class="infographic-flow">
      <!-- Pillar 1: Market Catalyst -->
      <div class="pillar-card">
        <div>
          <div class="pillar-header">
            <div class="pillar-icon-medallion">${theme.icon1}</div>
            <div class="pillar-meta">
              <span class="pillar-step-badge">Pillar 01</span>
              <h3 class="pillar-title">Market Catalyst &amp; Shift</h3>
            </div>
          </div>
          <p class="pillar-body">${pillars.pillar1}</p>
        </div>
        <div class="pillar-footer-indicator">
          <span>Macro Dynamics</span>
          ${ICONS.arrowRight}
        </div>
      </div>

      <!-- Pillar 2: Origination & STP Architecture -->
      <div class="pillar-card">
        <div>
          <div class="pillar-header">
            <div class="pillar-icon-medallion">${theme.icon2}</div>
            <div class="pillar-meta">
              <span class="pillar-step-badge">Pillar 02</span>
              <h3 class="pillar-title">Origination &amp; STP Impact</h3>
            </div>
          </div>
          <p class="pillar-body">${pillars.pillar2}</p>
        </div>
        <div class="pillar-footer-indicator">
          <span>BRE &amp; Platform</span>
          ${ICONS.arrowRight}
        </div>
      </div>

      <!-- Pillar 3: Risk & Underwriting Lens -->
      <div class="pillar-card">
        <div>
          <div class="pillar-header">
            <div class="pillar-icon-medallion">${theme.icon3}</div>
            <div class="pillar-meta">
              <span class="pillar-step-badge">Pillar 03</span>
              <h3 class="pillar-title">Risk &amp; Underwriting Lens</h3>
            </div>
          </div>
          <p class="pillar-body">${pillars.pillar3}</p>
        </div>
        <div class="pillar-footer-indicator">
          <span>Credit Discipline</span>
          ${ICONS.arrowRight}
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

      <div class="footer-series-pill">
        <span style="color: ${theme.accentLight};">⚡</span>
        <span>Fintech Pulse™ Intelligence</span>
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

    console.log(`🎨 [Fintech Pulse] Generated 1200x630 visual infographic card: ${outputPath}`);
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
