const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const auth    = require('../middleware/auth');
const ds      = require('../services/dataStore');
const claude  = require('../services/claude');
const openai  = require('../services/openai');
const { friendlyError } = require('../utils/apiError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveMonth(query) {
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) return query.month;
  return ds.currentMonthYear();
}

// Find which month file a post lives in (searches month files then legacy)
function findPostMonth(clientId, postId) {
  const months = ds.listContentMonths(clientId);
  for (const m of months) {
    if (ds.getMonthPost(clientId, m, postId)) return m;
  }
  return null; // lives in legacy posts.json
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/clients/:id/content?month=2026-05
// Returns posts for the specified month (default: current month)
router.get('/:clientId/content', auth, (req, res) => {
  const month = resolveMonth(req.query);
  const { status, type } = req.query;

  let posts = ds.getMonthContent(req.params.clientId, month);

  // Fallback: if no month file yet, serve from flat posts.json filtered by month
  if (posts.length === 0) {
    const [year, mon] = month.split('-').map(Number);
    posts = ds.getPosts(req.params.clientId).filter(p => {
      const d = new Date(p.scheduledAt || p.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === mon;
    });
  }

  if (status) posts = posts.filter(p => p.status === status);
  if (type)   posts = posts.filter(p => p.type   === type);
  posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  res.json(posts);
});

// GET /api/clients/:id/content/months — list available month keys
router.get('/:clientId/content/months', auth, (req, res) => {
  res.json(ds.listContentMonths(req.params.clientId));
});

// POST /api/clients/:id/content/generate?month=2026-05
// Manually trigger generation for a client + month
router.post('/:clientId/content/generate', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const month = resolveMonth(req.query);

  // Check if already generated
  const existing = ds.getMonthContent(req.params.clientId, month);
  if (existing.length > 0 && !req.query.force) {
    return res.status(409).json({
      error: `Content for ${month} already exists. Use ?force=1 to regenerate.`,
      posts: existing
    });
  }

  try {
    // Generate all 8 posts via Claude in one call
    const generatedPosts = await claude.generateContent(client, month);
    const saved = [];

    for (const gen of generatedPosts) {
      const imageUrl = await openai.generatePostImage(client, gen.type, gen.imagePrompt || gen.title);
      const post = {
        id:          uuidv4(),
        clientId:    client.id,
        monthYear:   month,
        type:        gen.type,
        title:       gen.title,
        body:        gen.body,
        cta:         gen.cta,
        imagePrompt: gen.imagePrompt,
        imageUrl,
        status:      'PENDING',
        scheduledAt: gen.scheduledAt || new Date().toISOString(),
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString()
      };
      ds.saveMonthPost(client.id, month, post);
      saved.push(post);
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('[content/generate]', err.message);
    const { status, error } = friendlyError(err);
    res.status(status).json({ error });
  }
});

// PUT /api/clients/:id/content/:postId/approve
router.put('/:clientId/content/:postId/approve', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const updated = { ...post, status: 'APPROVED', approvedAt: new Date().toISOString() };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

// PUT /api/clients/:id/content/:postId/reject
router.put('/:clientId/content/:postId/reject', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const updated = {
    ...post,
    status:        'DRAFT',
    rejectedAt:    new Date().toISOString(),
    rejectionNote: req.body.note || ''
  };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

// PUT /api/clients/:id/content/:postId — edit post content
router.put('/:clientId/content/:postId', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = { ...post, ...req.body, updatedAt: new Date().toISOString() };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

// POST /api/clients/:id/content/:postId/regenerate-image
router.post('/:clientId/content/:postId/regenerate-image', auth, async (req, res) => {
  const post   = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const client = ds.getClient(req.params.clientId);
  try {
    // Use strict version — surfaces real errors to the UI instead of returning placeholder
    const imageUrl = await openai.generatePostImageStrict(
      client, post.type, req.body.prompt || post.imagePrompt || post.title
    );
    const updated = { ...post, imageUrl, updatedAt: new Date().toISOString() };
    ds.savePost(req.params.clientId, updated);
    res.json(updated);
  } catch (err) {
    console.error('[regenerate-image]', err.message);
    const msg = err.message || '';
    if (msg.includes('billing') || msg.includes('credit') || msg.includes('quota')) {
      return res.status(402).json({ error: 'OpenAI credits exhausted. Top up at platform.openai.com → Billing.' });
    }
    if (msg.includes('content_policy') || msg.includes('safety')) {
      return res.status(400).json({ error: 'Image prompt was blocked by content policy. Try editing the prompt.' });
    }
    const { status, error } = friendlyError(err);
    res.status(status).json({ error });
  }
});

// ─── Legacy endpoints (kept for PostCard + PendingApprovals backward compat) ──

router.get('/:clientId/posts', auth, (req, res) => {
  const { status, type } = req.query;
  let posts = ds.getPosts(req.params.clientId);
  if (status) posts = posts.filter(p => p.status === status);
  if (type)   posts = posts.filter(p => p.type   === type);
  posts.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  res.json(posts);
});

router.post('/:clientId/posts/:postId/approve', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = { ...post, status: 'APPROVED', approvedAt: new Date().toISOString() };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

router.post('/:clientId/posts/:postId/reject', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = { ...post, status: 'DRAFT', rejectedAt: new Date().toISOString() };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

router.put('/:clientId/posts/:postId', auth, (req, res) => {
  const post = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = { ...post, ...req.body, updatedAt: new Date().toISOString() };
  ds.savePost(req.params.clientId, updated);
  res.json(updated);
});

router.post('/:clientId/posts/:postId/regenerate-image', auth, async (req, res) => {
  const post   = ds.getPost(req.params.clientId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const client = ds.getClient(req.params.clientId);
  try {
    const imageUrl = await openai.generatePostImage(client, post.type, req.body.prompt || post.title);
    const updated  = { ...post, imageUrl, updatedAt: new Date().toISOString() };
    ds.savePost(req.params.clientId, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Global approve-all (used by PendingApprovals page)
router.post('/global/approve-all', auth, (req, res) => {
  const clients = ds.getAllClients();
  const now = new Date().toISOString();
  let total = 0;
  for (const client of clients) {
    const posts   = ds.getPosts(client.id);
    const pending = posts.filter(p => p.status === 'PENDING');
    for (const p of pending) {
      ds.savePost(client.id, { ...p, status: 'APPROVED', approvedAt: now });
      total++;
    }
  }
  res.json({ count: total });
});

// Legacy generate (4 posts, no month file)
router.post('/:clientId/generate', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  try {
    const month  = ds.currentMonthYear();
    const types  = ['SERVICE', 'TIP', 'OFFER', 'LOCAL'];
    const results = [];
    for (let i = 0; i < types.length; i++) {
      const content  = await claude.generatePostContent(client, types[i]);
      const imageUrl = await openai.generatePostImage(client, types[i], content.imagePrompt || content.title);
      const d = new Date();
      d.setDate(d.getDate() + i * 7);
      const post = {
        id: uuidv4(), clientId: client.id, monthYear: month, type: types[i],
        title: content.title, body: content.body, cta: content.cta,
        imagePrompt: content.imagePrompt || '', imageUrl,
        status: 'PENDING',
        scheduledAt: d.toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      ds.saveMonthPost(client.id, month, post);
      results.push(post);
    }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
