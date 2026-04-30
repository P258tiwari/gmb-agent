const router = require('express').Router();
const auth   = require('../middleware/auth');
const ds     = require('../services/dataStore');
const claude = require('../services/claude');
const gbp    = require('../services/gbp');
const { friendlyError } = require('../utils/apiError');

// Merge GBP reviews into local reviews.json.
// GBP is source of truth for content; local reply wins if GBP has none yet.
function mergeReviews(clientId, gbpReviews) {
  const local      = ds.getReviews(clientId);
  const localById  = new Map(local.map(r => [r.id, r]));

  for (const r of gbpReviews) {
    const existing = localById.get(r.id);
    if (existing) {
      // Keep local reply if GBP doesn't have one yet (it may still be propagating)
      localById.set(r.id, {
        ...existing,
        ...r,
        reply:     r.reply     || existing.reply,
        repliedAt: r.repliedAt || existing.repliedAt
      });
    } else {
      localById.set(r.id, r);
    }
  }

  const merged = [...localById.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  ds.saveReviews(clientId, merged);
  return merged;
}

// GET /api/reviews/:clientId?star=5&status=unreplied
router.get('/:clientId', auth, (req, res) => {
  const { star, status } = req.query;
  let reviews = ds.getReviews(req.params.clientId);

  if (star && star !== 'all') {
    if (star === '1-2') reviews = reviews.filter(r => r.rating <= 2);
    else                reviews = reviews.filter(r => r.rating === parseInt(star));
  }
  if (status === 'replied')   reviews = reviews.filter(r =>  r.reply);
  if (status === 'unreplied') reviews = reviews.filter(r => !r.reply);

  reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(reviews);
});

function getAgencyTokens() {
  const data = ds.getAgencyData();
  if (!data) return null;
  return data.tokens || (data.access_token ? data : null);
}

// POST /api/reviews/:clientId/sync
// Pull latest reviews from GBP and update local JSON
router.post('/:clientId/sync', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  try {
    const tokens     = client.gbpTokens || ds.getClientTokens(req.params.clientId) || getAgencyTokens();
    let   accountId  = client.gbpAccountId || client.accountId || null;
    let   locationId = client.gbpLocationId || client.locationId || null;

    if (!tokens) {
      return res.json({ synced: 0, message: 'Google not connected — connect Google in Agency Settings first' });
    }

    // Auto-discover IDs from placeId if missing
    if ((!accountId || !locationId) && client.gbpPlaceId) {
      const found = await gbp.findLocationByPlaceId(tokens, client.gbpPlaceId);
      if (found) {
        accountId  = found.accountId;
        locationId = found.locationId;
        ds.saveClient({ ...client, gbpAccountId: accountId, gbpLocationId: locationId });
      }
    }

    if (!accountId || !locationId) {
      return res.json({ synced: 0, message: 'GBP location not linked — select the location in Edit Details first' });
    }

    console.log('[reviews/sync] accountId:', accountId, '| locationId:', locationId);
    const gbpReviews = await gbp.getReviews(tokens, accountId, locationId);
    console.log('[reviews/sync] fetched', gbpReviews.length, 'reviews from GBP');
    const merged     = mergeReviews(req.params.clientId, gbpReviews);
    res.json({ synced: gbpReviews.length, total: merged.length });
  } catch (err) {
    console.error('[reviews/sync]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews/:clientId/bulk-reply
// Generate + post AI replies for every unreplied review
router.post('/:clientId/bulk-reply', auth, async (req, res) => {
  const client = ds.getClient(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const reviews   = ds.getReviews(req.params.clientId);
  const unreplied = reviews.filter(r => !r.reply);

  if (unreplied.length === 0) {
    return res.json({ replied: 0, message: 'All reviews already have replies' });
  }

  const tokens     = client.gbpTokens || null;
  const accountId  = client.gbpAccountId || client.accountId || null;
  const locationId = client.gbpLocationId || client.locationId || null;

  let replied = 0;
  const errors = [];

  for (const review of unreplied) {
    try {
      const replyText = await claude.generateReply(review, client);

      // Post to GBP if connected
      if (tokens && accountId && locationId && review.gbpReviewId) {
        await gbp.replyToReview(tokens, accountId, locationId, review.gbpReviewId, replyText);
      }

      ds.saveReview(req.params.clientId, {
        ...review,
        reply:        replyText,
        repliedAt:    new Date().toISOString(),
        autoReplied:  true
      });
      replied++;
    } catch (err) {
      errors.push({ reviewId: review.id, error: err.message });
      console.error(`[reviews/bulk-reply] ${review.id}:`, err.message);
    }
  }

  res.json({ replied, errors: errors.length > 0 ? errors : undefined });
});

// POST /api/reviews/:clientId/:reviewId/reply
// Post a specific reply (manual or AI-generated text)
router.post('/:clientId/:reviewId/reply', auth, async (req, res) => {
  const reviews = ds.getReviews(req.params.clientId);
  const idx     = reviews.findIndex(r => r.id === req.params.reviewId);
  if (idx < 0) return res.status(404).json({ error: 'Review not found' });

  const client = ds.getClient(req.params.clientId);
  let replyText = req.body.reply;

  // Auto-generate if no text provided
  if (!replyText) {
    replyText = await claude.generateReply(reviews[idx], client);
  }

  // Post to GBP if connected
  const tokens     = client.gbpTokens || null;
  const accountId  = client.gbpAccountId || client.accountId || null;
  const locationId = client.gbpLocationId || client.locationId || null;

  if (tokens && accountId && locationId && reviews[idx].gbpReviewId) {
    try {
      await gbp.replyToReview(tokens, accountId, locationId, reviews[idx].gbpReviewId, replyText);
    } catch (err) {
      console.error('[reviews/reply] GBP post failed:', err.message);
    }
  }

  reviews[idx] = { ...reviews[idx], reply: replyText, repliedAt: new Date().toISOString() };
  ds.saveReviews(req.params.clientId, reviews);
  res.json(reviews[idx]);
});

// POST /api/reviews/:clientId/:reviewId/generate-reply
// Generate reply text without posting it
router.post('/:clientId/:reviewId/generate-reply', auth, async (req, res) => {
  const reviews = ds.getReviews(req.params.clientId);
  const review  = reviews.find(r => r.id === req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const client = ds.getClient(req.params.clientId);
  try {
    const reply = await claude.generateReply(review, client);
    res.json({ reply });
  } catch (err) {
    const { status, error } = friendlyError(err);
    res.status(status).json({ error });
  }
});

module.exports = router;
