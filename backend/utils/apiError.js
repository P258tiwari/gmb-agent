/**
 * Translates raw API error messages into user-friendly strings.
 * Handles Anthropic, OpenAI, and Google API errors.
 */
function friendlyError(err) {
  const msg  = (err.message || '').toLowerCase();
  const code = err.status || err.statusCode || (err.response?.status);

  if (msg.includes('credit balance') || msg.includes('billing') || code === 402)
    return { status: 402, error: 'AI API credits exhausted. Top up at console.anthropic.com → Plans & Billing.' };

  if ((msg.includes('invalid') && msg.includes('api key')) || msg.includes('authentication') || code === 401)
    return { status: 401, error: 'Invalid API key. Check your .env configuration.' };

  if (msg.includes('rate limit') || msg.includes('too many requests') || code === 429)
    return { status: 429, error: 'Rate limit reached. Please wait a moment and try again.' };

  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused'))
    return { status: 503, error: 'Service temporarily unavailable. Please try again.' };

  return { status: 500, error: 'An unexpected error occurred. Please try again.' };
}

module.exports = { friendlyError };
