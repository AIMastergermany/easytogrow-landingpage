// Passwortgeschützte Übersicht der gespeicherten Widerrufs-Zustimmungen.
// Aufruf: https://easytogrowki.de/nachweise  (Rewrite -> diese Function)
// Schutz: HTTP Basic Auth, Passwort aus Netlify-Umgebungsvariable
// CONSENT_VIEW_PASSWORD. Ohne gesetztes Passwort: KEIN Zugriff (fail-closed,
// da die Datensätze IP-Adressen enthalten).
import { createHmac } from 'node:crypto';

export default async (req) => {
  const PASSWORD = process.env.CONSENT_VIEW_PASSWORD;

  if (!PASSWORD) {
    return new Response(
      'Zugriff ist noch nicht eingerichtet. Bitte in den Netlify-Einstellungen die Umgebungsvariable CONSENT_VIEW_PASSWORD setzen.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  // --- Basic Auth (nur das Passwort wird geprüft, Benutzername beliebig) ---
  const auth = req.headers.get('authorization') || '';
  let authed = false;
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      authed = pass === PASSWORD;
    } catch (_) {}
  }
  if (!authed) {
    return new Response('Authentifizierung erforderlich', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="EasyToGrow Consent-Nachweise"', 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  // --- Datensätze laden ---
  let rows = [];
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('widerruf-consents');
    const { blobs } = await store.list();
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: 'json' });
      if (rec) rows.push(rec);
    }
  } catch (e) {
    return new Response('Fehler beim Laden der Datensätze: ' + (e && e.message), { status: 500 });
  }
  rows.sort((a, b) => String(b.serverTs || '').localeCompare(String(a.serverTs || '')));

  const SIGNING_SECRET = process.env.CONSENT_SIGNING_SECRET;
  const verify = (r) => {
    if (!r.sig) return { label: '– nicht signiert', cls: 'v-none' };
    if (!SIGNING_SECRET) return { label: '? Schlüssel fehlt', cls: 'v-none' };
    const canonical = JSON.stringify([r.id, r.serverTs, r.ip, r.userAgent, r.textVersion, r.consentText, r.clientTs, r.product, r.planKey]);
    const expected = createHmac('sha256', SIGNING_SECRET).update(canonical).digest('hex');
    return expected === r.sig ? { label: '✓ unverändert', cls: 'v-ok' } : { label: '⚠ VERÄNDERT', cls: 'v-bad' };
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const trs = rows.map(r => { const v = verify(r); return `<tr>
      <td class="mono">${esc(r.serverTs)}</td>
      <td class="mono ref">${esc(r.id)}</td>
      <td>${esc(r.planKey)}</td>
      <td class="mono">${esc(r.ip)}</td>
      <td>${esc(r.textVersion)}</td>
      <td class="${v.cls}">${v.label}</td>
      <td class="ua" title="${esc(r.userAgent)}">${esc(r.userAgent)}</td>
    </tr>`; }).join('');

  const printedAt = new Date().toISOString();
  const html = `<!DOCTYPE html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Consent-Nachweise · EasyToGrow</title>
<style>
  :root { --bg:#080c16; --fg:#f0f6fc; --muted:#8b9ab0; --green:#22c55e; --card:#0d1424; --border:#1e2a3a; }
  * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--fg);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; padding:32px 20px; }
  .wrap { max-width:1200px; margin:0 auto; }
  h1 { font-size:1.5rem; margin:0 0 4px; } h1 span { color:var(--green); }
  p.sub { color:var(--muted); margin:0 0 24px; font-size:.92rem; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; font-size:.86rem; }
  th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:top; }
  th { background:#141e35; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; font-size:.72rem; }
  tr:last-child td { border-bottom:none; }
  .mono { font-family:'JetBrains Mono',ui-monospace,Menlo,monospace; font-size:.8rem; }
  .ref { color:var(--green); } .ua { color:var(--muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .v-ok { color:#3fcf8e; font-weight:600; } .v-bad { color:#ff6b6b; font-weight:700; } .v-none { color:var(--muted); }
  .empty { padding:40px; text-align:center; color:var(--muted); }
  .printbtn { background:var(--green); color:#06121f; border:0; padding:9px 16px; border-radius:8px; font-weight:600; cursor:pointer; font-size:.9rem; margin:0 0 22px; }
  @media print {
    body { background:#fff; color:#000; padding:12px; } .wrap { max-width:none; }
    h1, h1 span { color:#000; } p.sub { color:#222; }
    table { border:1px solid #000; background:#fff; } th { background:#eee; color:#000; }
    th, td { border-bottom:1px solid #888; } .ref { color:#000; } .ua { color:#222; max-width:none; white-space:normal; }
    .no-print { display:none !important; }
  }
</style></head><body><div class="wrap">
  <h1>Widerrufs-Zustimmungen <span>(${rows.length})</span></h1>
  <p class="sub">Die <strong>Referenz-ID</strong> entspricht der <code>client_reference_id</code> beim jeweiligen Stripe-Kauf — darüber ordnest du Zustimmung und Zahlung einander zu.<br>Abgerufen am ${esc(printedAt)} (Server-Zeit, UTC).</p>
  <button class="printbtn no-print" onclick="window.print()">Drucken / als PDF speichern</button>
  ${rows.length ? `<table>
    <thead><tr><th>Zeitpunkt (Server, UTC)</th><th>Referenz-ID</th><th>Plan / Top-Up</th><th>IP-Adresse</th><th>Textfassung</th><th>Integrität</th><th>Browser / Gerät</th></tr></thead>
    <tbody>${trs}</tbody></table>` : `<div class="empty">Noch keine Zustimmungen gespeichert.</div>`}
</div></body></html>`;

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};
