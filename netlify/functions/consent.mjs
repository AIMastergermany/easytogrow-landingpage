// Protokolliert die Widerrufs-Zustimmung als Nachweis (§ 356 Abs. 5 BGB).
// Wird per navigator.sendBeacon vom Kauf-Button aufgerufen, bevor zu Stripe
// weitergeleitet wird. Die zurückgegebene/übergebene id geht als
// client_reference_id an Stripe -> Zustimmung ist mit dem Kauf verknüpft.
import { createHmac } from 'node:crypto';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

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

  // Zusätzliche, durchsuchbare Spur in den Function-Logs.
  console.log('WIDERRUF_CONSENT', JSON.stringify({ ...record, stored }));

  return Response.json({ ok: true, id, stored, signed: !!record.sig });
};
