const cron   = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const ds     = require('../services/dataStore');
const gbp    = require('../services/gbp');
const claude = require('../services/claude');
const email  = require('../services/email');

// Run at 6pm every day; inside, check if today is the last day of the month.
// node-cron doesn't support the 'L' (last-day) specifier, so we gate manually.
cron.schedule('0 18 * * *', async () => {
  const now      = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrow.getDate() !== 1) return; // not the last day of month

  await runReports(now);
});

async function runReports(now = new Date()) {
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  console.log(`[report-sender] Generating ${monthLabel} reports...`);

  const clients = ds.getAllClients().filter(c => c.status === 'ACTIVE');

  for (const client of clients) {
    const clientName = client.businessName || client.name || client.id;
    try {
      await buildAndSendReport(client, monthYear, monthLabel);
      console.log(`[report-sender] ✓ ${clientName}`);
    } catch (err) {
      console.error(`[report-sender] ✗ ${clientName}:`, err.message);
    }
  }

  console.log('[report-sender] Done.');
}

async function buildAndSendReport(client, monthYear, monthLabel) {
  const tokens     = client.gbpTokens    || null;
  const accountId  = client.gbpAccountId || client.accountId  || null;
  const locationId = client.gbpLocationId|| client.locationId || null;

  // Date range = 1st → last day of the month
  const [year, mon] = monthYear.split('-').map(Number);
  const startDate   = new Date(year, mon - 1, 1).toISOString();
  const endDate     = new Date(year, mon, 0, 23, 59, 59).toISOString();

  // 1. GBP insights
  const insights = await gbp.getInsights(tokens, accountId, locationId, startDate, endDate);

  // 2. Post + review stats from local JSON files
  const allPosts  = ds.getPosts(client.id);
  const monthPosts = allPosts.filter(p => {
    const d = new Date(p.scheduledAt || p.createdAt);
    return d.getFullYear() === year && d.getMonth() + 1 === mon;
  });

  const reviews = ds.getReviews(client.id);
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const metrics = {
    month:            monthLabel,
    monthYear,
    profileViews:     insights.profileViews      || 0,
    searchImpressions:insights.searchImpressions || 0,
    phoneCalls:       insights.phoneCalls        || 0,
    directionClicks:  insights.directionClicks   || 0,
    websiteClicks:    insights.websiteClicks     || 0,
    postsPublished:   monthPosts.filter(p => p.status === 'POSTED').length,
    postsApproved:    monthPosts.filter(p => p.status === 'APPROVED').length,
    reviewsTotal:     reviews.length,
    reviewsReplied:   reviews.filter(r => r.reply).length,
    avgRating
  };

  // 3. Generate HTML via Claude
  const htmlContent = await claude.generateReportEmail(metrics, client);

  // 4. Save HTML file + report entry
  ds.saveReportHtml(client.id, monthYear, htmlContent);

  const report = {
    id:        uuidv4(),
    monthYear,
    month:     monthLabel,
    metrics,
    sentAt:    new Date().toISOString(),
    sentTo:    client.contactEmail || null
  };
  ds.saveReport(client.id, report);

  // 5. Send email if client has a contact address
  if (client.contactEmail) {
    const subject = `Monthly GBP Report — ${client.businessName || client.name} — ${monthLabel}`;
    await email.sendReport(client, htmlContent, subject);
  }

  return report;
}

module.exports = { runReports, buildAndSendReport };
