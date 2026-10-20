// Google Identity Services redirect target (mobile). Google POSTs the ID token here;
// we check the double-submit CSRF cookie and hand the token back to the app in the URL fragment
// (fragments never reach a server). The app then exchanges it with Supabase (signInWithIdToken + nonce).
module.exports = (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const b = req.body || {};
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim()).filter(Boolean)
    .map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  res.setHeader('Cache-Control', 'no-store');
  if (!b.credential || !b.g_csrf_token || b.g_csrf_token !== cookies.g_csrf_token) {
    res.statusCode = 303; res.setHeader('Location', '/#gsierr=1'); return res.end();
  }
  res.statusCode = 303;
  res.setHeader('Location', '/#gsi=' + encodeURIComponent(String(b.credential)));
  res.end();
};
