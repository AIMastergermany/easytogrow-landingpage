// Protokolliert die Widerrufs-Zustimmung als Nachweis (§ 356 Abs. 5 BGB).
// Wird per navigator.sendBeacon vom Kauf-Button aufgerufen, bevor zu Stripe
// weitergeleitet wird. Die zurückgegebene/übergebene id geht als
// client_reference_id an Stripe -> Zustimmung ist mit dem Kauf verknüpft.
import { createHmac } from 'node:crypto';

// Grober Flut-Schutz pro IP. Netlify-Functions sind ephemer, daher nur
// Best-Effort (jeder Cold-Start beginnt frisch) — reicht gegen einfache Floods.
const consentAttempts = new Map();
const CONSENT_RL_MAX = 20;
const CONSENT_RL_WINDOW = 60 * 1000;

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Body-Größe begrenzen (Müll-/DoS-Schutz)
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > 8192) {
    return new Response('Payload too large', { status: 413 });
  }

  // Fremde Origins blocken. Fehlende Origin wird durchgelassen, weil manche
  // same-origin sendBeacon-Aufrufe keinen Origin-Header setzen — ein Block würde
  // sonst einen rechtlich relevanten Widerrufs-Nachweis verschlucken.
  const reqOrigin = req.headers.get('origin') || '';
  if (reqOrigin) {
    let originOk = false;
    try {
      // app.easytogrowki.de: App-Käufe docken laut Auftrag 30.06. an dieses
      // Nachweis-System an (sendBeacon aus dem Upgrade-Modal). Ohne den Eintrag
      // lief jeder App-Kauf-Nachweis in 403 (Audit 03.09., H6).
      originOk = ['easytogrowki.de', 'www.easytogrowki.de', 'app.easytogrowki.de'].includes(new URL(reqOrigin).hostname);
    } catch (_) {}
    if (!originOk) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Rate-Limit pro IP
  const rlIp = req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || '0.0.0.0';
  const rlNow = Date.now();
  const rlList = (consentAttempts.get(rlIp) || []).filter(t => rlNow - t < CONSENT_RL_WINDOW);
  if (rlList.length >= CONSENT_RL_MAX) {
    return new Response('Zu viele Anfragen', { status: 429 });
  }
  rlList.push(rlNow);
  consentAttempts.set(rlIp, rlList);

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const id = (typeof body.id === 'string' && body.id.length > 0 && body.id.length < 80)
    ? body.id
    : ('c-' + Date.now());

  const ip = (context && context.ip)
    || req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || null;

  const record = {
    id,
    serverTs: new Date().toISOString(),                                   // vertrauenswürdiger Server-Zeitstempel
    clientTs: typeof body.clientTs === 'string' ? body.clientTs.slice(0, 40) : null,
    ip,
    userAgent: req.headers.get('user-agent') || null,
    textVersion: typeof body.textVersion === 'string' ? body.textVersion.slice(0, 40) : null,
    consentText: typeof body.consentText === 'string' ? body.consentText.slice(0, 800) : null,
    planKey: typeof body.planKey === 'string' ? body.planKey.slice(0, 80) : null,
    product: 'EasyToGrow'
  };

  // Fälschungssicherheit: Datensatz mit geheimem Schlüssel signieren (HMAC-SHA256).
  // Nachträgliche Änderung an einem Feld macht die Signatur ungültig (Prüfung in der Übersicht).
  const SIGNING_SECRET = process.env.CONSENT_SIGNING_SECRET;
  if (SIGNING_SECRET) {
    const canonical = JSON.stringify([record.id, record.serverTs, record.ip, record.userAgent, record.textVersion, record.consentText, record.clientTs, record.product, record.planKey]);
    record.sig = createHmac('sha256', SIGNING_SECRET).update(canonical).digest('hex');
    record.sigAlg = 'HMAC-SHA256';
  }

  // Dauerhafte Speicherung in Netlify Blobs (best effort; dynamischer Import,
  // damit die Funktion auch ohne Blobs-Runtime nicht crasht).
  let stored = false;
  try {
    const { getStore } = await import('@netlify/blobs');
    await getStore('widerruf-consents').setJSON(id, record);
    stored = true;
  } catch (e) {
    console.error('consent blob store failed:', e && e.message);
  }

  // Durchsuchbare Spur in den Function-Logs — Modul L (Log-Hygiene):
  // bewusst OHNE IP, User-Agent und Consent-Volltext; die vollständigen,
  // signierten Nachweisdaten liegen ausschließlich im Blob (3 Jahre, Modul G).
  console.log('WIDERRUF_CONSENT', JSON.stringify({
    id: record.id, serverTs: record.serverTs, product: record.product,
    planKey: record.planKey, textVersion: record.textVersion,
    signed: !!record.sig, stored,
  }));

  return Response.json({ ok: true, id, stored, signed: !!record.sig });
};
