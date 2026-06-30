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

  // Origin prüfen — nur von eigener Domain erlauben (Hostname-genau, nicht via
  // .includes(): sonst würde z.B. easytogrowki.de.angreifer.com durchrutschen).
  const rawOrigin = event.headers.origin || event.headers.referer || '';
  let originAllowed = false;
  try {
    const host = new URL(rawOrigin).hostname;
    originAllowed = host === 'easytogrowki.de'
      || host === 'www.easytogrowki.de'
      || host === 'localhost'
      || host.endsWith('.netlify.app');
  } catch (_) {}
  if (!originAllowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Nicht erlaubt' })
    };
  }

  // M-06: Body parsen (für Turnstile-Token-Prüfung + Weiterleitung ohne Token)
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (_) {}

  // Cloudflare-Turnstile verifizieren. Fail-open: solange TURNSTILE_SECRET_KEY
  // nicht gesetzt ist, läuft der Chat unverändert weiter (Schutz aktiviert sich,
  // sobald der Secret Key in den Netlify-Env-Vars hinterlegt ist).
  const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
  if (TURNSTILE_SECRET) {
    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET,
          response: payload.cf_token || '',
          remoteip: ip
        })
      });
      const verify = await verifyRes.json();
      if (!verify.success) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Bitte bestätige, dass du kein Bot bist, und lade die Seite neu.' })
        };
      }
    } catch (_) {
      // Verifizierungs-Dienst nicht erreichbar → Chat nicht hart blocken
    }
  }
  // Token nicht ans Backend weiterreichen
  delete payload.cf_token;

  try {
    const response = await fetch('https://velvet-creator-app-production.up.railway.app/chat/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
