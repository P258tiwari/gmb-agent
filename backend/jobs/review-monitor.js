const cron   = require('node-cron');
const ds     = require('../services/dataStore');
const claude = require('../services/claude');
const gbp    = require('../services/gbp');

const ts = () => new Date().toISOString();

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log(`[${ts()}][review-monitor] Starting review sync cycle`);
  const clients = ds.getAllClients().filter(c => c.status === 'ACTIVE');

  let totalSynced  = 0;
  let totalReplied = 0;

  for (const client of clients) {
    const clientName = client.businessName || client.name || client.id;
    const tokens     = client.gbpTokens     || null;
    const accountId  = client.gbpAccountId  || client.accountId  || null;
    const locationId = client.gbpLocationId || client.locationId || null;

    try {
      // 1. Sync from GBP
      if (tokens && accountId && locationId) {
        const gbpReviews = await gbp.getReviews(tokens, accountId, locationId);
        if (gbpReviews.length > 0) {
          const local     = ds.getReviews(client.id);
          const localById = new Map(local.map(r => [r.id, r]));

          for (const r of gbpReviews) {
            const existing = localById.get(r.id);
            localById.set(r.id, existing ? {
              ...existing, ...r,
              reply:     r.reply     || existing.reply,
              repliedAt: r.repliedAt || existing.repliedAt
            } : r);
          }

          ds.saveReviews(client.id, [...localById.values()].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          ));
          totalSynced += gbpReviews.length;
          console.log(`[${ts()}][review-monitor] Synced ${gbpReviews.length} reviews for ${clientName}`);
        }
      }

      // 2. Auto-reply to unreplied
      const reviews   = ds.getReviews(client.id);
      const unreplied = reviews.filter(r => !r.reply);
      if (unreplied.length === 0) continue;

      console.log(`[${ts()}][review-monitor] ${unreplied.length} unreplied review(s) for ${clientName}`);

      for (const review of unreplied) {
        try {
          const replyText = await claude.generateReply(review, client);

          if (tokens && accountId && locationId && review.gbpReviewId) {
            await gbp.replyToReview(tokens, accountId, locationId, review.gbpReviewId, replyText);
          }

          ds.saveReview(client.id, {
            ...review,
            reply:       replyText,
            repliedAt:   new Date().toISOString(),
            autoReplied: true
          });
          totalReplied++;
          console.log(`[${ts()}][review-monitor] ✓ Replied to review ${review.id} for ${clientName}`);
        } catch (err) {
          console.error(`[${ts()}][review-monitor] ✗ Reply failed for ${clientName}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[${ts()}][review-monitor] ✗ Error for ${clientName}:`, err.message);
    }
  }

  console.log(`[${ts()}][review-monitor] Done — ${totalSynced} synced, ${totalReplied} replied.`);
});
