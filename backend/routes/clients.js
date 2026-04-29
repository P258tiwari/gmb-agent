const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const ds = require('../services/dataStore');
const claudeService = require('../services/claude');
const openaiService = require('../services/openai');
const serpService = require('../services/serp');

// Normalize incoming body to canonical client structure
function normalizeClientData(body) {
  const toArray = (v) =>
    Array.isArray(v) ? v : (v || '').split(',').map(s => s.trim()).filter(Boolean);

  // Strip "accounts/" prefix from accountId, extract locationId from full path
  const rawAccount  = body.gbpAccountId || body.accountId || '';
  const rawLocation = body.gbpLocationId || body.locationId || '';
  const gbpAccountId  = rawAccount.replace(/^accounts\//, '');
  const gbpLocationId = rawLocation.includes('/locations/')
    ? rawLocation.split('/locations/').pop()
    : rawLocation;

  return {
    businessName:  body.businessName  || body.name        || '',
    clientName:    body.clientName    || '',
    aboutBusiness: body.aboutBusiness || '',
    status:        (body.status       || 'ACTIVE').toUpperCase(),
    gbpPlaceId:    body.gbpPlaceId    || body.placeId      || '',
    gbpAccountId,
    gbpLocationId,
    category:      body.category      || '',
    brandTone:     body.brandTone     || body.tone         || '',
    tone:          body.tone          || body.brandTone    || '', // backward-compat alias
    city:          body.city          || '',
    country:       body.country       || 'India',
    address:       body.address       || '',
    colony:        body.colony        || '',
    email:         body.email         || '',
    phone:         body.phone         || '',
    website:       body.website       || '',
    services:      toArray(body.services),
    keywords:      toArray(body.keywords),
    contactEmail:  body.contactEmail  || '',
    // Business profile (AI context)
    ownerName:       body.ownerName       || '',
    yearEstablished: body.yearEstablished || '',
    openingHours:    body.openingHours    || '',
    priceRange:      body.priceRange      || '',
    targetCustomers: body.targetCustomers || '',
    usps:            toArray(body.usps),
    certifications:  toArray(body.certifications),
    nearbyLandmarks: toArray(body.nearbyLandmarks),
    instagram:       body.instagram       || '',
    facebook:        body.facebook        || '',

    googleConnected: body.googleConnected || false,
  };
}

// Backward compat: expose `name` so existing code that reads client.name still works
function withAlias(client) {
  return { ...client, name: client.businessName || client.name || '' };
}

// GET /api/clients — list all
router.get('/', auth, (req, res) => {
  const clients = ds.getAllClients().map(withAlias);
  res.json(clients);
});

// POST /api/clients/temp/keywords — quick keyword suggestions without creating a client
// NOTE: must be before /:id
router.post('/temp/keywords', auth, async (req, res) => {
  const { businessName, category, city, services } = req.body;
  try {
    const keywords = await claudeService.generateKeywordSuggestions(
      businessName || 'Business',
      category     || 'Business',
      city         || 'India',
      services     || []
    );
    res.json(keywords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NOTE: /pending/all must be defined BEFORE /:id to avoid being caught by the param route
// GET /api/clients/pending/all — all pending posts across all clients
router.get('/pending/all', auth, (req, res) => {
  const clients = ds.getAllClients();
  const pending = [];
  for (const client of clients) {
    const clientName = client.businessName || client.name || 'Unknown';
    const posts = ds.getPosts(client.id);
    posts
      .filter(p => p.status === 'PENDING')
      .forEach(p => pending.push({ ...p, clientName, clientId: client.id }));
  }
  pending.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  res.json(pending);
});

// GET /api/clients/:id — single client with stats summary
router.get('/:id', auth, (req, res) => {
  const client = ds.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Compute live stats from files
  const posts    = ds.getPosts(req.params.id);
  const reviews  = ds.getReviews(req.params.id);
  const citations = ds.getCitations(req.params.id);
  const avgRating = reviews.length
    ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
    : 0;

  const enriched = {
    ...withAlias(client),
    stats: {
      posts:      posts.filter(p => p.status === 'POSTED').length,
      reviews:    reviews.length,
      citations:  citations.length,
      avgRating,
    }
  };
  res.json(enriched);
});

// POST /api/clients — create new client
router.post('/', auth, async (req, res) => {
  // Validate required fields
  const { businessName, name, category } = req.body;
  if (!businessName && !name) {
    return res.status(400).json({ error: 'businessName is required' });
  }
  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }

  try {
    const id  = uuidv4();
    const now = new Date().toISOString();
    const normalized = normalizeClientData(req.body);

    const client = {
      id,
      ...normalized,
      name: normalized.businessName, // alias for backward compat
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      googleConnected: false,
      stats: { posts: 0, reviews: 0, citations: 0, avgRating: 0 },
      performance: {
        profileViews: 0, profileViewsTrend: 0,
        phoneCalls: 0, phoneCallsTrend: 0,
        directionRequests: 0, directionRequestsTrend: 0,
        newReviews: 0, newReviewsTrend: 0,
        websiteClicks: 0, websiteClicksTrend: 0,
      }
    };

    ds.saveClient(client);
    ds.ensureClientDir(id);

    // Background tasks — fire and forget
    setImmediate(async () => {
      try {
        console.log(`[setup] Starting background setup for ${client.businessName}`);

        // 0. Auto-sync GBP Profile, Reviews, and Insights if connected
        if (client.gbpAccountId && client.gbpLocationId) {
          try {
            console.log(`[setup] Auto-syncing GBP data for ${client.businessName}`);
            const gbpService = require('../services/gbp');
            const agencyData = ds.getAgencyData() || {};
            const tokens = client.gbpTokens || agencyData.tokens || agencyData.access_token;

            if (tokens) {
              const profile = await gbpService.fetchCurrentProfile(tokens, client.gbpAccountId, client.gbpLocationId);
              if (profile) {
                const info = ds.getClientInfo(id) || {};
                ds.saveClientInfo(id, { ...info, gbpProfile: { ...profile, lastFetched: new Date().toISOString() } });
              }

              const reviews = await gbpService.getReviews(tokens, client.gbpAccountId, client.gbpLocationId);
              if (reviews && reviews.length > 0) {
                ds.saveReviews(id, reviews);
              }

              const insights = await gbpService.getInsights(tokens, client.gbpAccountId, client.gbpLocationId);
              if (insights) {
                const currentClient = ds.getClient(id);
                ds.saveClient({
                  ...currentClient,
                  performance: {
                    ...(currentClient.performance || {}),
                    ...insights,
                    lastSynced: new Date().toISOString()
                  }
                });
              }
              console.log(`[setup] GBP sync completed for ${client.businessName}`);
            }
          } catch (err) {
            console.error(`[setup] GBP auto-sync error for ${client.businessName}:`, err.message);
          }
        }

        // 1. Generate keywords
        const keywords = await serpService.generateKeywords(client);
        ds.saveKeywords(id, keywords);
        console.log(`[setup] Keywords done for ${client.businessName}`);

        // 2. Find citations
        const citations = await serpService.findCitations(client);
        ds.saveCitations(id, citations);
        console.log(`[setup] Citations done for ${client.businessName}`);

        // 3. Bulk auto-reply to any existing reviews (new clients have none, but handle future imports)
        await bulkReplyReviews(client);

        // 4. Generate initial posts (always on new client creation)
        await generateInitialPosts(client);
        console.log(`[setup] Initial posts done for ${client.businessName}`);

        // 5. If today is on or before the 5th, also generate a full monthly content batch
        const dayOfMonth = new Date().getDate();
        if (dayOfMonth <= 5) {
          console.log(`[setup] Day ${dayOfMonth} ≤ 5 — generating monthly content batch`);
          await generateMonthlyContent(client);
        }
      } catch (err) {
        console.error(`[setup] Error for ${client.businessName}:`, err.message);
      }
    });

    res.status(201).json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id — update client
router.put('/:id', auth, (req, res) => {
  const client = ds.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const normalized = normalizeClientData({ ...client, ...req.body });
  const updated = ds.saveClient({
    ...client,
    ...normalized,
    name: normalized.businessName || client.name,
    id: req.params.id,
    updatedAt: new Date().toISOString()
  });
  res.json(withAlias(updated));
});

// DELETE /api/clients/:id
router.delete('/:id', auth, (req, res) => {
  ds.deleteClient(req.params.id);
  res.json({ success: true });
});

// ─── Background helpers ───────────────────────────────────────────────────────

async function generateInitialPosts(client) {
  const postTypes = ['SERVICE', 'TIP', 'OFFER', 'LOCAL'];
  for (let i = 0; i < postTypes.length; i++) {
    const type = postTypes[i];
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + i * 7);
    try {
      const content  = await claudeService.generatePostContent(client, type);
      const imageUrl = await openaiService.generatePostImage(client, type, content.title);
      ds.savePost(client.id, {
        id: uuidv4(), clientId: client.id, type,
        title: content.title, body: content.body, cta: content.cta,
        imageUrl, status: 'PENDING',
        scheduledAt: scheduledDate.toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[generateInitialPosts] ${type} error:`, err.message);
    }
  }
}

async function generateMonthlyContent(client) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Skip if already generated this month
  const existing = ds.getMonthContent(client.id, monthYear);
  if (existing.length > 0) {
    console.log(`[generateMonthlyContent] Skipping ${client.businessName} — already generated for ${monthYear}`);
    return;
  }

  const generatedPosts = await claudeService.generateContent(client, monthYear);
  for (const gen of generatedPosts) {
    try {
      const imageUrl = await openaiService.generatePostImage(client, gen.type, gen.imagePrompt || gen.title);
      ds.saveMonthPost(client.id, monthYear, {
        id: uuidv4(), clientId: client.id, monthYear,
        type: gen.type, title: gen.title, body: gen.body, cta: gen.cta,
        imagePrompt: gen.imagePrompt || '', imageUrl,
        status: 'PENDING',
        scheduledAt: gen.scheduledAt || new Date().toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[generateMonthlyContent] image error:`, err.message);
    }
  }
  console.log(`[generateMonthlyContent] ✓ ${client.businessName} — ${generatedPosts.length} posts for ${monthYear}`);
}

async function bulkReplyReviews(client) {
  const reviews = ds.getReviews(client.id);
  const unreplied = reviews.filter(r => !r.reply);
  if (unreplied.length === 0) return;
  console.log(`[bulkReplyReviews] Auto-replying to ${unreplied.length} reviews for ${client.businessName}`);
  for (const review of unreplied) {
    try {
      const reply = await claudeService.generateReviewReply(client, review);
      const idx = reviews.findIndex(r => r.id === review.id);
      reviews[idx] = { ...review, reply, repliedAt: new Date().toISOString(), autoReplied: true };
    } catch (err) {
      console.error(`[bulkReplyReviews] error:`, err.message);
    }
  }
  ds.saveReviews(client.id, reviews);
}

module.exports = router;
