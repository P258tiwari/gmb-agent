const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host:   'smtp.zoho.in',
    port:   465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Generic send — every other email function routes through here
async function sendEmail(to, subject, htmlBody, { cc, replyTo } = {}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP credentials not set — skipping send');
    return;
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html:    htmlBody,
    ...(cc      ? { cc }      : {}),
    ...(replyTo ? { replyTo } : {})
  });
  console.log(`[email] Sent "${subject}" → ${to} (${info.messageId})`);
  return info;
}

// Send a monthly report to the client contact email (+ CC agency)
async function sendReport(clientData, htmlBody, subject) {
  const to   = clientData.contactEmail;
  const name = clientData.businessName || clientData.name;
  if (!to) {
    console.log(`[email] No contactEmail for ${name} — skipping report`);
    return;
  }

  const resolvedSubject = subject || `Monthly GBP Report — ${name}`;
  return sendEmail(to, resolvedSubject, htmlBody, {
    cc: process.env.SMTP_USER
  });
}

// Send test email to verify SMTP config
async function sendTestEmail(to) {
  const target = to || process.env.ADMIN_EMAIL || 'info@ampwake.com';
  const html = `
    <div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #E5E7EB;border-radius:12px;">
      <h2 style="color:#2563EB;margin:0 0 16px;">Test Email ✓</h2>
      <p style="color:#374151;font-size:14px;">This is a test from GMB Agent (AmpWake). Your email service is configured correctly.</p>
      <p style="color:#6B7280;font-size:12px;margin-top:24px;">Sent from: ${process.env.SMTP_FROM || process.env.SMTP_USER}<br>Time: ${new Date().toISOString()}</p>
    </div>`;
  return sendEmail(target, 'GMB Agent — Email Test', html);
}

// Confirmation email after GBP profile update
async function sendGbpUpdateConfirmation(contactEmail, businessName, changes, previousProfile = {}) {
  if (!contactEmail) return;

  const LABELS = {
    name: 'Business Name', primaryCategory: 'Primary Category',
    secondaryCategories: 'Secondary Categories',
    description: 'Description', services: 'Services'
  };

  const rows = Object.entries(changes)
    .filter(([k]) => k !== 'reasoning' && changes[k])
    .map(([k, v]) => {
      const label = LABELS[k] || k;
      const oldVal = Array.isArray(previousProfile[k])
        ? (previousProfile[k] || []).join(', ') || '—'
        : (previousProfile[k] || '—');
      const newVal = Array.isArray(v) ? v.join(', ') : String(v);
      return `<tr>
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#374151;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">${label}</td>
        <td style="padding:10px 12px;font-size:12px;color:#DC2626;text-decoration:line-through;border-bottom:1px solid #E5E7EB;">${oldVal.length > 80 ? oldVal.slice(0, 80) + '…' : oldVal}</td>
        <td style="padding:10px 12px;font-size:12px;color:#16A34A;border-bottom:1px solid #E5E7EB;">${newVal.length > 80 ? newVal.slice(0, 80) + '…' : newVal}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">
  <div style="background:#2563EB;padding:28px 32px;">
    <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">AmpWake</div>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:white;">Google Business Profile Updated</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">${businessName}</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Your Google Business Profile has been successfully updated by AmpWake. Here's a summary of the changes made:
    </p>
    ${rows ? `<table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <thead>
        <tr style="background:#F3F4F6;">
          <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Field</th>
          <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Previous</th>
          <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Updated To</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>` : ''}
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1D4ED8;">
        Changes will be <strong>live on Google Maps within 24–48 hours</strong>.
      </p>
    </div>
    <p style="font-size:13px;color:#6B7280;margin:0;">
      Questions? Reply to this email or contact us at <a href="mailto:cto@ampwake.com" style="color:#2563EB;">cto@ampwake.com</a>
    </p>
  </div>
  <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      Powered by <strong style="color:#374151;">AmpWake Agency</strong> · To unsubscribe reply STOP
    </p>
  </div>
</div>
</body>
</html>`;

  return sendEmail(contactEmail, `Google Business Profile Updated — ${businessName}`, html);
}

module.exports = { sendEmail, sendReport, sendTestEmail, sendGbpUpdateConfirmation };
