/* 国庆典藏卡 —— Service Worker（离线缓存）
   发新版时把 CACHE 的版本号 +1，旧缓存会在 activate 阶段整体清除。 */
const CACHE = 'guoqing-card-v1';
// GitHub Pages 项目页部署在 /仓库名/ 子路径下，这里与页面一样全部用相对路径
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'main.js',
  'manifest.webmanifest',
  'assets/flag.svg',
  'assets/emblem-gold.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-192.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
];

/* 安装：预缓存全部静态资源（任一失败则本次安装作废，不影响旧版本服务） */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* 激活：清除历史版本缓存，并立即接管所有已打开的页面 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先（保证发版后第一时间拿到新页面），离线回退缓存的入口页
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }

  // 静态资源：缓存优先，未命中走网络并回填缓存
  //（ignoreSearch 兼容 build.py 给 style.css / main.js 追加的 ?v= 时间戳）
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
    )
  );
});
