// Rate Limiting: max 10 Anfragen pro IP in 60 Sekunden
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000; // 60 Sekunden

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

// Alte Einträge aufräumen (alle 5 Min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

exports.handler = async function(event) {
  // Nur POST erlauben
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate Limiting prüfen
  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte einen Moment.' })
    };
  }

  // Origin prüfen — nur von eigener Domain erlauben
  const origin = event.headers.origin || event.headers.referer || '';
  if (!origin.includes('easytogrowki.de') && !origin.includes('localhost') && !origin.includes('netlify')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Nicht erlaubt' })
    };
  }

  try {
    const response = await fetch('https://velvet-creator-app-production.up.railway.app/chat/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://easytogrowki.de'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Chat-Service nicht erreichbar' })
    };
  }
};
