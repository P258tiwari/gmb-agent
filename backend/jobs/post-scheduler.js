const cron = require('node-cron');
const ds   = require('../services/dataStore');
const gbp  = require('../services/gbp');

const ts = () => new Date().toISOString();

// Run at 10:00 AM every day
cron.schedule('0 10 * * *', async () => {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  console.log(`[${ts()}][post-scheduler] Starting daily publish run for ${today}`);

  const clients = ds.getAllClients().filter(c => c.status === 'ACTIVE');
  let totalPublished = 0;
  let totalFailed    = 0;

  for (const client of clients) {
    const clientName = client.businessName || client.name || client.id;
    const allPosts   = ds.getPosts(client.id);

    const toPublish = allPosts.filter(p => {
      if (p.status !== 'APPROVED') return false;
      return new Date(p.scheduledAt).toISOString().slice(0, 10) <= today;
    });

    if (toPublish.length === 0) continue;
    console.log(`[${ts()}][post-scheduler] ${toPublish.length} post(s) to publish for ${clientName}`);

    for (const post of toPublish) {
      try {
        const tokens    = client.gbpTokens || null;
        const accountId = client.gbpAccountId || client.accountId || null;

        await gbp.createPost(tokens, accountId, client, post);

        ds.savePost(client.id, {
          ...post,
          status:   'POSTED',
          postedAt: new Date().toISOString(),
          likes:    0,
          shares:   0
        });
        console.log(`[${ts()}][post-scheduler] ✓ Posted: "${post.title}" for ${clientName}`);
        totalPublished++;
      } catch (err) {
        ds.savePost(client.id, {
          ...post,
          status:    'FAILED',
          failedAt:  new Date().toISOString(),
          failError: err.message
        });
        console.error(`[${ts()}][post-scheduler] ✗ Failed: "${post.title}" — ${err.message}`);
        totalFailed++;
      }
    }
  }

  console.log(`[${ts()}][post-scheduler] Done — ${totalPublished} published, ${totalFailed} failed.`);
});
