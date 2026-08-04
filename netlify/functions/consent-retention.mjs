// DSGVO Modul G (Stufe 5): tägliche Löschung von Widerrufs-Consent-Blobs,
// die älter als 3 Jahre sind (§ 195 BGB, Frist aus ENTSCHEIDE_Andreas_2026-08-04).
// Scheduled Function — Netlify ruft sie täglich auf (config.schedule unten).
// Jeder Lauf loggt ein RETENTION_RUN-Protokoll (Rechenschaft Art. 5 Abs. 2).

const RETENTION_DAYS = 3 * 365;

export default async () => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let checked = 0, deleted = 0, errors = 0;
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('widerruf-consents');
    const { blobs } = await store.list();
    for (const b of blobs || []) {
      checked++;
      try {
        const rec = await store.get(b.key, { type: 'json' });
        const ts = rec && rec.serverTs ? Date.parse(rec.serverTs) : NaN;
        // Ohne lesbaren Zeitstempel wird NICHT gelöscht (Beweismittel-Schutz).
        if (Number.isFinite(ts) && ts < cutoff) {
          await store.delete(b.key);
          deleted++;
        }
      } catch (e) {
        errors++;
        console.error('consent-retention blob error:', b.key, e && e.message);
      }
    }
  } catch (e) {
    console.error('consent-retention failed:', e && e.message);
    return new Response('retention failed', { status: 500 });
  }
  console.log('RETENTION_RUN', JSON.stringify({
    store: 'widerruf-consents', retentionDays: RETENTION_DAYS,
    cutoff: new Date(cutoff).toISOString(), checked, deleted, errors,
    runAt: new Date().toISOString(),
  }));
  return new Response('ok');
};

export const config = { schedule: '@daily' };
