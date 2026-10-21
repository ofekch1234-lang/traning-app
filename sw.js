/* יומן הברזל — service worker: עבודה אופליין */
const CACHE = 'nextrep-v131';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-180.png', '/icon-192.png', '/icon-512.png', '/manifest-f.json', '/icon-f-180.png', '/icon-f-192.png', '/icon-f-512.png', '/badge-96.png', '/menu-foods.js?v=6'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // דף הבית: רשת קודם (כדי לקבל עדכונים), נפילה לקאש באופליין
  if (url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // נכסים סטטיים (כולל פונטים וספריות CDN): קאש קודם, רשת כגיבוי
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});

/* web push — תזכורות אימון */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'NextRep', {
    body: d.body || '',
    icon: 'icon-192.png?v=2',
    badge: 'badge-96.png',
    vibrate: [200, 100, 200],
    // תג ייחודי לכל התראה: באייפון התראה שמחליפה תג קיים נכנסת בשקט (בלי באנר/צליל)
    tag: (d.kind || 'nr') + '-' + Date.now(),
    data: { url: '/', kind: d.kind || '' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('/');
  }));
});
