require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const OpenAI = require('openai');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const http   = require('http');
const { v4: uuidv4 } = require('uuid');

const CATEGORY_CONTEXTS = {
  'Healthcare & Medical': 'dental clinic or medical office, bright clean aesthetic, professional healthcare staff',
  'Real Estate':          'modern Indian residential or commercial property, architectural photography',
  'Home Services':        'uniformed professional technician doing home repair work, clean workspace',
  'Beauty & Wellness':    'luxury spa interior, soft warm lighting, serene wellness atmosphere',
  'Restaurant & Food':    'appetizing Indian food photography, warm restaurant interior lighting',
  'Education':            'bright modern classroom, students engaged in learning, educational environment',
  'Retail & Shopping':    'clean organized retail store, attractive product display, welcoming storefront',
  'Automotive':           'professional car service workshop, modern garage, skilled mechanic',
  'Salon & Beauty':       'stylish modern salon interior, professional hair styling chair, clean aesthetic',
  'Other':                'professional Indian business environment, welcoming commercial space'
};

const TYPE_MOOD = {
  SERVICE: 'professional and trustworthy, clean and bright, showcase of expertise',
  TIP:     'educational and informative, clean minimal background, warm friendly tone',
  OFFER:   'vibrant and exciting, festive Indian aesthetic, bold colors suggesting value',
  LOCAL:   'warm community feeling, Indian neighborhood, golden hour lighting, authentic'
};

function buildPrompt(clientData, postType, titleOrPrompt) {
  const name     = clientData.businessName || clientData.name || 'Business';
  const city     = clientData.city || 'India';
  const category = clientData.category || 'Business';

  const catContext = CATEGORY_CONTEXTS[category] || CATEGORY_CONTEXTS.Other;
  const typeMood   = TYPE_MOOD[postType] || TYPE_MOOD.SERVICE;

  const hint = typeof titleOrPrompt === 'string' && titleOrPrompt.length > 60
    ? titleOrPrompt
    : `${name} — ${titleOrPrompt || postType}`;

  const raw = `${hint}. ${catContext}. ${typeMood}. Indian business context, ${city}. High quality, photorealistic. No text overlays, no watermarks, no logos.`;
  return raw.length > 3900 ? raw.slice(0, 3900) : raw;
}

// Strict — throws on any failure. Used by explicit user-triggered regeneration.
async function generatePostImageStrict(clientData, postType, titleOrPrompt) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildPrompt(clientData, postType, titleOrPrompt);

  const response = await openai.images.generate({
    model:           'dall-e-3',
    prompt,
    n:               1,
    size:            '1024x1024',
    quality:         'standard',
    response_format: 'url'
  });

  const url = response.data[0]?.url;
  if (!url) throw new Error('No image URL returned from dall-e-3');

  return await downloadAndSaveImage(url);
}

// Safe wrapper — used by background jobs. Never throws; returns placeholder on failure.
async function generatePostImage(clientData, postType, titleOrPrompt) {
  try {
    return await generatePostImageStrict(clientData, postType, titleOrPrompt);
  } catch (err) {
    console.error('[openai] Image generation error:', err.message);
    const name = clientData.businessName || clientData.name || 'Business';
    return generatePlaceholder(name, postType);
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function downloadAndSaveImage(url) {
  return new Promise((resolve, reject) => {
    const fileName = `${uuidv4()}.jpg`;
    const filePath = path.join(__dirname, '..', 'uploads', fileName);
    const protocol = url.startsWith('https') ? https : http;
    const file     = fs.createWriteStream(filePath);
    protocol.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(`/uploads/${fileName}`); });
    }).on('error', (err) => { fs.unlink(filePath, () => {}); reject(err); });
  });
}

function generatePlaceholder(name, postType) {
  const colors = { SERVICE: '2563EB', TIP: '16A34A', OFFER: 'D97706', LOCAL: '7C3AED' };
  const color  = colors[postType] || '2563EB';
  return `https://placehold.co/1024x1024/${color}/FFFFFF?text=${encodeURIComponent(name)}`;
}

// Alias for backward compat
const generateImage = generatePostImage;

module.exports = { generatePostImage, generatePostImageStrict, generateImage };
