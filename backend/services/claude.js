const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Shared context builder ───────────────────────────────────────────────────
// Builds a rich, consistent business context string used in ALL Claude prompts.
// The more fields populated, the better the output quality.
function buildClientContext(clientData) {
  const name     = clientData.businessName || clientData.name || 'Business';
  const city     = clientData.city         || 'India';
  const colony   = clientData.colony       || '';
  const country  = clientData.country      || 'India';
  const category = clientData.category     || 'Business';
  const services = (clientData.services    || []).slice(0, 8).join(', ');
  const keywords = (clientData.keywords    || []).slice(0, 6).join(', ');
  const tone     = clientData.brandTone    || clientData.tone || 'Professional & Authoritative';

  const lines = [
    `Business Name: ${name}`,
    `Category: ${category}`,
    `Location: ${colony ? `${colony}, ` : ''}${city}, ${country}`,
  ];

  if (clientData.address)       lines.push(`Address: ${clientData.address}`);
  if (clientData.phone)         lines.push(`Phone: ${clientData.phone}`);
  if (clientData.website)       lines.push(`Website: ${clientData.website}`);
  if (clientData.openingHours)  lines.push(`Opening Hours: ${clientData.openingHours}`);
  if (services)                 lines.push(`Services: ${services}`);
  if (keywords)                 lines.push(`Target Keywords: ${keywords}`);
  lines.push(`Brand Tone: ${tone}`);

  // Rich AI context fields
  if (clientData.ownerName)        lines.push(`Owner/Practitioner: ${clientData.ownerName}`);
  if (clientData.yearEstablished)  lines.push(`Established: ${clientData.yearEstablished}`);
  if (clientData.priceRange)       lines.push(`Price Range: ${clientData.priceRange}`);
  if (clientData.aboutBusiness)    lines.push(`About the Business: ${clientData.aboutBusiness}`);
  if (clientData.targetCustomers)  lines.push(`Target Customers: ${clientData.targetCustomers}`);

  if ((clientData.usps || []).length)
    lines.push(`Unique Selling Points:\n${clientData.usps.map(u => `  - ${u}`).join('\n')}`);

  if ((clientData.certifications || []).length)
    lines.push(`Certifications/Awards: ${clientData.certifications.join(', ')}`);

  if ((clientData.nearbyLandmarks || []).length)
    lines.push(`Nearby Landmarks: ${clientData.nearbyLandmarks.join(', ')}`);

  if (clientData.instagram) lines.push(`Instagram: ${clientData.instagram}`);
  if (clientData.facebook)  lines.push(`Facebook: ${clientData.facebook}`);

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are a Google Business Profile content expert for Indian local businesses.
Write posts that rank in Google Maps.
Rules:
- Include city name 2-3 times naturally
- Include primary keyword in every post
- Every post must have a clear, specific CTA
- Vary post types: SERVICE, TIP, OFFER, LOCAL
- Write in the specified brand tone
- Keep body 150-220 words
- No hashtags, no emojis in body
- Return ONLY valid JSON array, no markdown, no explanation`;

const POST_TYPE_GUIDES = {
  SERVICE:  'Highlight one specific service. Focus on benefits, expertise, and local relevance.',
  TIP:      'Educational tip relevant to the business category. Build trust and authority.',
  OFFER:    'Promotional post with a specific offer or discount. Create urgency with deadline.',
  LOCAL:    'Community connection post. Reference local landmarks, events, or neighborhood pride.'
};

// Generate a full month batch of 8 posts in one API call
async function generateContent(clientData, monthYear) {
  const name = clientData.businessName || clientData.name || 'Business';
  const city = clientData.city || 'India';

  // Distribute 8 posts: 3 SERVICE, 2 TIP, 2 OFFER, 1 LOCAL
  const types = ['SERVICE', 'TIP', 'OFFER', 'SERVICE', 'LOCAL', 'TIP', 'OFFER', 'SERVICE'];

  // Spread posts across the month
  const [year, month] = monthYear.split('-').map(Number);
  const scheduleDates = types.map((_, i) => {
    const d = new Date(year, month - 1, 1 + i * 3);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  });

  const typeDescriptions = types.map((t, i) =>
    `Post ${i + 1} (${t}): ${POST_TYPE_GUIDES[t]}`
  ).join('\n');

  const userPrompt = `Generate 8 GMB posts for ${name} — month: ${monthYear}.

${buildClientContext(clientData)}

Post Requirements:
${typeDescriptions}

Instructions:
- Each post body MUST include "${city}" 2–3 times naturally
- Reference USPs and certifications where relevant
- For LOCAL posts, mention nearby landmarks if available
- For OFFER posts, reference price range appropriately
- Write as ${clientData.ownerName ? clientData.ownerName + ' at ' + name : name}

Return a JSON array of exactly 8 objects. Each object must have:
{
  "type": "SERVICE|TIP|OFFER|LOCAL",
  "title": "headline under 60 characters",
  "body": "post body 150-220 words",
  "cta": "call to action under 40 characters",
  "imagePrompt": "detailed image generation prompt (scene, mood, style, no text in image)"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = message.content[0].text.trim();
    let posts = parseJSONArray(text);

    // Attach scheduled dates and normalize
    return posts.slice(0, 8).map((post, i) => ({
      type:        types[i] || post.type || 'SERVICE',
      title:       post.title || `${name} — ${types[i]} Post`,
      body:        post.body  || '',
      cta:         post.cta   || 'Contact us today!',
      imagePrompt: post.imagePrompt || `${category} business in ${city}, professional photography`,
      scheduledAt: scheduleDates[i]
    }));
  } catch (err) {
    console.error('[claude] generateContent error:', err.message);
    // Return fallback structure so generation never fully fails
    return types.map((type, i) => ({
      type,
      title: `${name} — ${type} Update`,
      body:  `Visit ${name} in ${city} for professional ${category.toLowerCase()} services. Located in ${city}, we serve the community with dedication and expertise. Contact us today for more information about our services in ${city}.`,
      cta:   'Call us today!',
      imagePrompt: `${category} business in ${city}, professional`,
      scheduledAt: scheduleDates[i]
    }));
  }
}

// Single post generation (used for on-demand regeneration)
async function generatePostContent(clientData, postType) {
  const name = clientData.businessName || clientData.name || 'Business';
  const city = clientData.city || 'India';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate 1 GMB post.

${buildClientContext(clientData)}

Post type: ${postType} — ${POST_TYPE_GUIDES[postType] || POST_TYPE_GUIDES.SERVICE}
Requirements: include "${city}" 2–3 times, mention USPs or certifications if relevant.

Return ONLY this JSON object (no array, no markdown):
{"title":"...","body":"...","cta":"...","imagePrompt":"..."}`
    }]
  });

  const text = message.content[0].text.trim();
  try {
    const parsed = parseJSONObject(text);
    return parsed;
  } catch {
    return {
      title: `${name} — ${postType}`,
      body:  `Professional ${category.toLowerCase()} services in ${city}. Visit ${name} today.`,
      cta:   'Contact us today!',
      imagePrompt: `${category} business ${city} professional`
    };
  }
}

// Review reply generation — uses Haiku (faster + cheaper for short replies)
async function generateReply(review, clientData) {
  const name   = clientData.businessName || clientData.name || 'our business';
  const city   = clientData.city         || '';
  const owner  = clientData.ownerName    || '';
  const years  = clientData.yearEstablished
    ? `(established ${clientData.yearEstablished})`
    : '';
  const services = (clientData.services || []).slice(0, 3).join(', ');
  const tone     = clientData.brandTone  || clientData.tone || 'professional';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: `Write GBP review replies for Indian local businesses.
Rules: 2-3 sentences max. Mention city once. Human and warm tone. No generic openers like "We appreciate your feedback" or "Thank you for choosing us". Return reply text only.`,
    messages: [{
      role: 'user',
      content: `Business: ${name}${city ? ` in ${city}` : ''} ${years}
${owner ? `Owner/Manager: ${owner}` : ''}
Services: ${services || 'various services'}
Brand Tone: ${tone}
Rating: ${review.rating}/5 stars
Reviewer: ${review.reviewerName || 'the customer'}
Review: "${review.text || '(no text)'}"

Write a genuine 2-3 sentence reply${owner ? ` signing off as ${owner.split(' ')[0]}` : ''}.`
    }]
  });
  return message.content[0].text.trim();
}

// Backward-compatible alias (param order was clientData, review)
async function generateReviewReply(clientData, review) {
  return generateReply(review, clientData);
}

// ─── Report email generation ──────────────────────────────────────────────────

async function generateReportEmail(metrics, clientData) {
  const name     = clientData.businessName  || clientData.name || 'Business';
  const city     = clientData.city          || '';
  const category = clientData.category      || 'Business';
  const owner    = clientData.ownerName     || clientData.clientName || '';
  const month    = metrics.month           || new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const appUrl   = process.env.APP_URL     || 'https://ampwake.com';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3500,
    system: `You are a professional digital marketing analyst for an Indian agency called AmpWake.
Write monthly GBP performance report emails for local business clients.
Return ONLY the complete HTML — no markdown fences, no explanation, nothing before <!DOCTYPE or after </html>.
Use only inline CSS. Email must render correctly in Gmail, Outlook, and Apple Mail.`,
    messages: [{
      role: 'user',
      content: `Generate a professional monthly Google Business Profile report email.

Business: ${name}
Category: ${category}${city ? `\nCity: ${city}` : ''}${owner ? `\nOwner: ${owner}` : ''}
Report Period: ${month}

Performance Metrics:
- Profile Views:        ${metrics.profileViews        || 0}
- Search Impressions:   ${metrics.searchImpressions   || 0}
- Phone Calls:          ${metrics.phoneCalls          || 0}
- Direction Clicks:     ${metrics.directionClicks     || 0}
- Website Clicks:       ${metrics.websiteClicks       || 0}
- Posts Published:      ${metrics.postsPublished      || 0}
- Reviews Received:     ${metrics.reviewsTotal        || 0}
- Reviews Replied:      ${metrics.reviewsReplied      || 0}
- Average Rating:       ${metrics.avgRating           || 'N/A'}

Email structure (strictly follow this):
1. HEADER — #2563EB background, white text. Logo text "AmpWake" (small, above heading), heading "Monthly GBP Report", subheading "${name} · ${month}"
2. GREETING — "Dear ${owner || clientData.clientName || name} Team," + one warm opening sentence
3. METRICS GRID — 3×3 responsive table-based grid (inline table layout). Each cell: big bold number, small grey label. Include all 9 metrics above.
4. ANALYSIS — 2-3 sentences interpreting the data. Be specific — mention actual numbers, call out the strongest metric and one area to improve.
5. RECOMMENDATIONS — "Top 3 Recommendations for ${month.split(' ').pop()}" — numbered list, each with bold heading + 1-2 sentence specific action for ${category} in ${city || 'your city'}.
6. FOOTER — light grey background. "Powered by AmpWake Agency" bold. "${appUrl}" linked. "To unsubscribe reply STOP" small grey text.

Color palette: #2563EB (blue), #111827 (dark), #374151 (body text), #6B7280 (labels), #F9FAFB (backgrounds), #E5E7EB (borders).
Font: -apple-system, 'Segoe UI', Arial, sans-serif.
Container max-width: 600px, centered.`
    }]
  });

  let html = message.content[0].text.trim();
  // Strip any accidental markdown fences
  html = html.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
  return html;
}

// ─── Keyword generation ───────────────────────────────────────────────────────

async function generateKeywords(clientData) {
  const name   = clientData.businessName || clientData.name || 'Business';
  const city   = clientData.city         || 'India';
  const colony = clientData.colony       || '';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: 'You are an Indian local SEO expert specialising in Google Business Profile optimisation. Return ONLY valid JSON, no markdown, no explanation.',
    messages: [{
      role: 'user',
      content: `Generate 40 local SEO keywords for this business:

${buildClientContext(clientData)}
${colony ? `Locality: ${colony}` : ''}

Generate keywords that reflect:
- The specific services offered
- The target customer profile and their search intent
- The unique selling points (people search for specific differentiators)
- Nearby landmarks for hyper-local queries
- The owner/practitioner name if well-known${clientData.ownerName ? ` (${clientData.ownerName})` : ''}

Return a JSON object with exactly 4 keys, each an array of exactly 10 strings:
{
  "transactional": [10 high-intent buy/book/hire keywords — include city "${city}"],
  "nearMe": [10 "near me" and hyper-local search phrases including locality/landmarks],
  "informational": [10 educational how-to/what-is/guide keywords relevant to this category],
  "hindi": [10 Hindi Devanagari keywords for the same intent mix]
}
No duplicates across categories.`
    }]
  });

  const text = message.content[0].text.trim();
  try {
    const parsed = parseJSONObject(text);
    return {
      transactional: (parsed.transactional || []).slice(0, 10),
      nearMe:        (parsed.nearMe        || []).slice(0, 10),
      informational: (parsed.informational || []).slice(0, 10),
      hindi:         (parsed.hindi         || []).slice(0, 10)
    };
  } catch {
    // Fallback: basic keywords
    const cat = category.toLowerCase();
    return {
      transactional: [`best ${cat} in ${city}`, `${cat} near me`, `affordable ${cat} ${city}`, `${cat} booking ${city}`, `top rated ${cat} ${city}`],
      nearMe:        [`${cat} near me`, `best ${cat} near me`, `${cat} open now near me`],
      informational: [`how to choose ${cat}`, `${cat} tips`, `${cat} cost India`],
      hindi:         [`${city} में ${cat}`, `सबसे अच्छा ${cat}`]
    };
  }
}

// ─── GBP optimization generation ─────────────────────────────────────────────

async function generateGbpOptimization(clientData) {
  const gbpProfile = clientData.gbpProfile || {};

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 2048,
    system: `You are a Google Business Profile optimization expert for Indian local businesses.
Generate optimized GBP profile content that maximizes local search ranking on Google Maps.
Return ONLY valid JSON, no other text.`,
    messages: [{
      role: 'user',
      content: `Optimize this Google Business Profile:

${buildClientContext(clientData)}

Current GBP State:
- Current Name: ${gbpProfile.name || 'Not set'}
- Current Primary Category: ${gbpProfile.primaryCategory || 'Not set'}
- Current Description: ${gbpProfile.description || 'Not set'}

Optimization goals:
- Maximize Google Maps local ranking for target keywords
- Highlight USPs, credentials, and certifications prominently
- Include city name exactly 3 times in description
- Reference nearby landmarks for hyper-local relevance
- Match brand tone consistently
- Description must be max 700 characters, end with a CTA

Return this JSON object exactly:
{
  "name": "optimized business name (add city only if truly improves searchability)",
  "primaryCategory": "best matching Google Maps category string",
  "secondaryCategories": ["up to 5 additional relevant category strings"],
  "description": "optimized max-700-char description — no hashtags, no emojis",
  "services": ["service names to show on GBP listing"],
  "reasoning": {
    "nameChange": "why name was changed or 'No change needed'",
    "categoryChoice": "why this primary category maximizes ranking",
    "descriptionStrategy": "which SEO signals and USPs were prioritized"
  }
}`
    }]
  });

  const text = message.content[0].text.trim();
  return parseJSONObject(text);
}

// ─── Quick keyword suggestions (for Add Client form) ─────────────────────────

async function generateKeywordSuggestions(businessName, category, city, services) {
  const svcStr = Array.isArray(services) ? services.join(', ') : services || '';
  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 512,
    system: 'You are an Indian local SEO expert. Return ONLY a JSON array of 10 keyword strings, no explanation.',
    messages: [{
      role: 'user',
      content: `Generate 10 high-intent local SEO keywords:
Business: ${businessName || 'Business'}
Category: ${category || 'Business'}
City: ${city || 'India'}
Services: ${svcStr || 'General services'}

Return a JSON array of exactly 10 keyword strings. Focus on transactional and local search intent.`
    }]
  });
  const text = message.content[0].text.trim();
  try { return parseJSONArray(text).slice(0, 10); }
  catch {
    const cat = (category || 'business').toLowerCase();
    return [
      `best ${cat} in ${city}`, `${cat} near me`, `affordable ${cat} ${city}`,
      `top ${cat} ${city}`, `${cat} booking ${city}`,
      `${cat} services ${city}`, `experienced ${cat} ${city}`,
      `${cat} specialist ${city}`, `${cat} clinic ${city}`,
      `professional ${cat} ${city}`
    ];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJSONArray(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Extract array from surrounding text
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  // Try extracting individual objects
  const objects = [];
  const objectMatches = text.matchAll(/\{[\s\S]*?\}/g);
  for (const m of objectMatches) {
    try { objects.push(JSON.parse(m[0])); } catch {}
  }
  if (objects.length > 0) return objects;
  throw new Error('Could not parse JSON array from response');
}

function parseJSONObject(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Could not parse JSON object');
}

module.exports = {
  generateContent, generatePostContent,
  generateReply, generateReviewReply,
  generateKeywords, generateKeywordSuggestions,
  generateReportEmail, generateGbpOptimization
};
