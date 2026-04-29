const cron   = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const ds     = require('../services/dataStore');
const claude = require('../services/claude');
const openai = require('../services/openai');

const ts = () => new Date().toISOString();

// Run at 9:00 AM on the 1st of every month
cron.schedule('0 9 1 * *', async () => {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`[${ts()}][monthly-content] Starting content generation for ${monthYear}`);

  const clients = ds.getAllClients().filter(c => c.status === 'ACTIVE');
  console.log(`[${ts()}][monthly-content] ${clients.length} active client(s) to process`);

  for (const client of clients) {
    const clientName = client.businessName || client.name || client.id;
    try {
      // Skip if already generated this month
      const existing = ds.getMonthContent(client.id, monthYear);
      if (existing.length > 0) {
        console.log(`[${ts()}][monthly-content] Skipping ${clientName} — ${existing.length} posts already exist for ${monthYear}`);
        continue;
      }

      console.log(`[${ts()}][monthly-content] Generating for ${clientName}...`);

      const generatedPosts = await claude.generateContent(client, monthYear);

      let saved = 0;
      for (const gen of generatedPosts) {
        try {
          const imageUrl = await openai.generatePostImage(client, gen.type, gen.imagePrompt || gen.title);
          ds.saveMonthPost(client.id, monthYear, {
            id:          uuidv4(),
            clientId:    client.id,
            monthYear,
            type:        gen.type,
            title:       gen.title,
            body:        gen.body,
            cta:         gen.cta,
            imagePrompt: gen.imagePrompt || '',
            imageUrl,
            status:      'PENDING',
            scheduledAt: gen.scheduledAt,
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString()
          });
          saved++;
        } catch (imgErr) {
          console.error(`[${ts()}][monthly-content] Image error for ${clientName}:`, imgErr.message);
        }
      }

      console.log(`[${ts()}][monthly-content] ✓ ${clientName} — ${saved}/${generatedPosts.length} posts saved to ${monthYear}`);
    } catch (err) {
      console.error(`[${ts()}][monthly-content] ✗ ${clientName}:`, err.message);
    }
  }

  console.log(`[${ts()}][monthly-content] Done.`);
});
