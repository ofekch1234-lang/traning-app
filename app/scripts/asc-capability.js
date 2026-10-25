// Makes sure the App ID has the capabilities the app's entitlements need (Sign in with Apple),
// through the App Store Connect API with the same key the TestFlight upload uses. Idempotent.
// env: ASC_KEY_ID, ASC_ISSUER_ID, KEY (path to the .p8), BUNDLE (bundle identifier)
const fs = require('fs'), crypto = require('crypto');
const { ASC_KEY_ID, ASC_ISSUER_ID, KEY, BUNDLE = 'il.co.nextrep.app' } = process.env;
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: fs.readFileSync(KEY), dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
async function api(path, opts = {}) {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1/' + path, {
    ...opts, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Error(path + ' → ' + r.status + ' ' + JSON.stringify(j.errors || j).slice(0, 400));
  return { status: r.status, j };
}
(async () => {
  const { j } = await api('bundleIds?filter[identifier]=' + encodeURIComponent(BUNDLE) + '&include=bundleIdCapabilities');
  const bid = (j.data || []).find(d => d.attributes.identifier === BUNDLE);
  if (!bid) { console.log('::warning::Bundle ID ' + BUNDLE + ' not found; automatic signing will register it'); return; }
  const have = (j.included || []).map(c => c.attributes.capabilityType);
  console.log('App ID', BUNDLE, 'capabilities:', have.join(', ') || '(none)');
  if (have.includes('APPLE_ID_AUTH')) { console.log('Sign in with Apple: already on'); return; }
  const { status } = await api('bundleIdCapabilities', { method: 'POST', body: JSON.stringify({ data: {
    type: 'bundleIdCapabilities',
    attributes: { capabilityType: 'APPLE_ID_AUTH', settings: [{ key: 'APPLE_ID_AUTH_APP_CONSENT', options: [{ key: 'PRIMARY_APP_CONSENT' }] }] },
    relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } } } } }) });
  console.log('Sign in with Apple: turned on (' + status + ')');
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
