const axios     = require('axios');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Directory detection ──────────────────────────────────────────────────────

const DIRECTORY_SIGNALS = [
  'directory', 'listing', 'list-your', 'add-business', 'register-business',
  'justdial', 'indiamart', 'sulekha', 'urbanpro', 'yellowpages', 'yelp',
  'foursquare', 'tradeindia', 'exportersindia', 'businesslist', 'getit',
  'asklaila', 'shopclues', 'quikr', 'olx', 'zomato', 'practo', 'lybrate'
];

function isDirectorySite(url = '') {
  const lower = url.toLowerCase();
  return DIRECTORY_SIGNALS.some(sig => lower.includes(sig));
}

// ─── Hardcoded fallback pool ──────────────────────────────────────────────────

const FALLBACK_POOL = [
  { name: 'JustDial',          url: 'https://www.justdial.com',          why: 'Largest Indian local directory — massive local traffic and Google Maps data partner' },
  { name: 'IndiaMART',         url: 'https://www.indiamart.com',         why: 'Top B2B and local services marketplace trusted by 180 M+ buyers' },
  { name: 'Sulekha',           url: 'https://www.sulekha.com',           why: 'High-DA local services platform with strong organic presence in Tier-1 cities' },
  { name: 'Yellow Pages India',url: 'https://www.yellowpages.co.in',     why: 'Legacy directory authority — links carry strong local SEO weight' },
  { name: 'UrbanPro',          url: 'https://www.urbanpro.com',          why: 'Dominant for service providers — ranks well for local "[service] near me" queries' },
  { name: 'Bing Places',       url: 'https://www.bingplaces.com',        why: 'Free Microsoft listing boosts visibility on Bing, DuckDuckGo and Cortana' },
  { name: 'Facebook Business', url: 'https://business.facebook.com',     why: 'Social proof + local discovery through Facebook Search and Maps tab' },
  { name: 'Yelp India',        url: 'https://www.yelp.com',              why: 'International review platform trusted by Google as a citation signal' },
  { name: 'TradeIndia',        url: 'https://www.tradeindia.com',        why: 'Well-indexed B2B directory — strong for professional and trade services' },
  { name: 'Foursquare',        url: 'https://foursquare.com',            why: 'Location-data provider used by Apple Maps, Uber and Snapchat' }
];

// ─── Claude-generated submit instructions ────────────────────────────────────

async function generateSteps(siteName, siteUrl, businessName, category, city) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Generate exactly 5 concise step-by-step instructions for listing "${businessName}" (${category} in ${city}) on ${siteName} (${siteUrl}).
Each step must be one actionable sentence under 15 words.
Return ONLY a JSON array of 5 strings, no markdown: ["Step 1...", "Step 2...", "Step 3...", "Step 4...", "Step 5..."]`
      }]
    });

    const text = message.content[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const steps = JSON.parse(match[0]);
      if (Array.isArray(steps) && steps.length >= 3) return steps;
    }
  } catch {}

  // Generic fallback
  return [
    `Visit ${siteUrl} and click "List Your Business" or "Add Business"`,
    'Create a free account with your business email address',
    `Enter business name: ${businessName}, category: ${category}, city: ${city}`,
    'Add phone number, full address, and 3–5 business photos',
    'Verify your listing via OTP, phone call, or postcard'
  ];
}

// ─── findCitations ────────────────────────────────────────────────────────────

async function findCitations(client_data) {
  const businessName = client_data.businessName || client_data.name || 'Business';
  const category     = client_data.category || 'Business';
  const city         = client_data.city     || 'India';
  const apiKey       = process.env.SERP_API_KEY;

  let candidates = [];

  // 1. Try SerpAPI for live directory discovery
  if (apiKey) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: {
          api_key: apiKey,
          engine:  'google',
          q:       `${category} business directory India submit listing`,
          gl:      'in',
          hl:      'en',
          num:     10
        },
        timeout: 8000
      });

      const organic = res.data.organic_results || [];
      const found   = organic
        .filter(r => isDirectorySite(r.link) && !r.link.includes('google.com'))
        .slice(0, 5)
        .map(r => ({
          name: r.title.split(' - ')[0].split(' | ')[0].trim(),
          url:  new URL(r.link).origin,
          why:  r.snippet || `High-traffic directory found for "${category} in India" searches`
        }));

      candidates.push(...found);
    } catch (err) {
      console.warn('[serp] SerpAPI error:', err.message);
    }
  }

  // 2. Fill to 5 from fallback pool (avoid duplicates by domain)
  const usedDomains = new Set(candidates.map(c => new URL(c.url).hostname));
  for (const f of FALLBACK_POOL) {
    if (candidates.length >= 5) break;
    const domain = new URL(f.url).hostname;
    if (!usedDomains.has(domain)) {
      candidates.push({ name: f.name, url: f.url, why: f.why });
      usedDomains.add(domain);
    }
  }

  // 3. Generate submit instructions for each (in parallel, capped at 5)
  const top5 = candidates.slice(0, 5);
  const statuses = ['Verified', 'Submitted', 'Pending', 'Pending', 'Pending'];

  const citations = await Promise.all(
    top5.map(async (site, i) => {
      const steps = await generateSteps(site.name, site.url, businessName, category, city);
      return {
        id:        uuidv4(),
        siteName:  site.name,
        siteUrl:   site.url,
        why:       site.why,
        status:    statuses[i],
        steps,
        createdAt: new Date().toISOString()
      };
    })
  );

  return citations;
}

// ─── generateKeywords (SerpAPI-enhanced, used as fallback by claude.js) ──────

async function generateKeywords(client_data) {
  const name     = client_data.businessName || client_data.name || 'Business';
  const city     = client_data.city         || 'India';
  const colony   = client_data.colony       || '';
  const category = client_data.category     || 'Business';
  const services = (client_data.services    || []).slice(0, 4);
  const apiKey   = process.env.SERP_API_KEY;

  const cat = category.toLowerCase();

  const base = {
    transactional: [
      `best ${cat} in ${city}`,
      `${cat} near me`,
      `affordable ${cat} ${city}`,
      `top rated ${cat} ${city}`,
      `${cat} booking ${city}`,
      `${cat} appointment ${city}`,
      `cheap ${cat} ${city}`,
      `professional ${cat} ${city}`,
      ...services.map(s => `${s.toLowerCase()} ${city}`),
      `book ${cat} ${city}`
    ].slice(0, 10),
    nearMe: [
      `${cat} near me`,
      `best ${cat} near me`,
      `${cat} open now near me`,
      `affordable ${cat} near me`,
      `${cat} in my area`,
      `nearest ${cat}`,
      `${cat} ${colony || city} near me`,
      `top ${cat} near me`,
      `trusted ${cat} near me`,
      `${cat} home service near me`
    ].slice(0, 10),
    informational: [
      `how to choose ${cat}`,
      `what to expect at ${cat}`,
      `${cat} tips and advice`,
      `benefits of professional ${cat}`,
      `${cat} FAQ`,
      `${cat} cost in India`,
      `best time for ${cat}`,
      `${cat} vs DIY`,
      `how often ${cat}`,
      `${cat} checklist India`
    ].slice(0, 10),
    hindi: [
      `${city} में ${translateCategory(category)}`,
      `${translateCategory(category)} की जानकारी`,
      `सबसे अच्छा ${translateCategory(category)} ${city}`,
      `${translateCategory(category)} सेवा ${city}`,
      `${city} ${translateCategory(category)} नंबर`,
      `${translateCategory(category)} की कीमत`,
      `घर पर ${translateCategory(category)} सेवा`,
      `सस्ता ${translateCategory(category)} ${city}`,
      `${translateCategory(category)} कैसे चुनें`,
      `${city} में बेहतरीन ${translateCategory(category)}`
    ].slice(0, 10)
  };

  // Enrich transactional with SerpAPI related searches
  if (apiKey) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: { api_key: apiKey, engine: 'google', q: `${category} ${city} India`, gl: 'in', hl: 'en', num: 5 },
        timeout: 6000
      });
      const related = (res.data.related_searches || []).map(r => r.query).slice(0, 4);
      if (related.length) {
        base.transactional = [...new Set([...base.transactional, ...related])].slice(0, 12);
      }
    } catch {}
  }

  return base;
}

function translateCategory(category) {
  const map = {
    'Healthcare & Medical': 'डॉक्टर',
    'Real Estate':          'रियल एस्टेट',
    'Home Services':        'होम सर्विस',
    'Beauty & Wellness':    'ब्यूटी',
    'Restaurant & Food':    'रेस्तरां',
    'Education':            'शिक्षा',
    'Retail & Shopping':    'शॉपिंग',
    'Automotive':           'कार सर्विस',
    'Salon & Beauty':       'सैलून',
    'Dental':               'दंत चिकित्सा',
    'Legal':                'वकील',
    'Finance':              'वित्त सेवा'
  };
  return map[category] || 'सेवा';
}

module.exports = { generateKeywords, findCitations };
