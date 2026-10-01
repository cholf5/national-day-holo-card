/* 国庆典藏卡 —— 交互与粒子特效 */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const stage = $('#stage');
  const card3d = $('#card3d');
  const tilt = $('#tilt');
  const shadow = $('#cardShadow');
  const goldGrad = document.getElementById('goldMetal');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (v, m) => ((v % m) + m) % m;

  /* ------------------------------------------------ 年份动态计算 */
  // 周年数以 10 月 1 日为界：今年国庆未到则显示上一届
  const now = new Date();
  const pastNationalDay =
    now.getMonth() > 9 || (now.getMonth() === 9 && now.getDate() >= 1);
  const anniversary = now.getFullYear() - 1949 - (pastNationalDay ? 0 : 1);
  const endYear = 1949 + anniversary;

  const CN_DIGITS = '〇一二三四五六七八九';
  const cnYear = y => String(y).split('').map(d => CN_DIGITS[+d]).join('');
  function cnNumber(n) {
    if (n <= 10) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
    if (n < 20) return '十' + (n % 10 ? CN_DIGITS[n % 10] : '');
    if (n < 100) return CN_DIGITS[Math.floor(n / 10)] + '十' + (n % 10 ? CN_DIGITS[n % 10] : '');
    const h = Math.floor(n / 100), r = n % 100;
    if (r === 0) return CN_DIGITS[h] + '百';
    if (r < 10) return CN_DIGITS[h] + '百零' + CN_DIGITS[r];
    return CN_DIGITS[h] + '百' + (r === 10 ? '一十' : cnNumber(r));
  }

  $('#yearsLine').textContent = `一九四九 · ${cnYear(endYear)}`;
  $('#titleLine').textContent = `庆祝中华人民共和国成立${cnNumber(anniversary)}周年`;
  $('#frontYears').textContent = `1949 — ${endYear}`;
  document.title = `国庆典藏卡 · 1949 — ${endYear}`;

  /* ------------------------------------------------ 闪光噪点贴图 */
  function makeGlitter() {
    const S = 320;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      const a = Math.random();
      g.fillStyle = `rgba(255,255,255,${(a * a).toFixed(3)})`;
      g.fillRect((Math.random() * S) | 0, (Math.random() * S) | 0, Math.random() < 0.94 ? 1 : 2, 1);
    }
    return `url(${c.toDataURL()})`;
  }
  const glitterURL = makeGlitter();
  document.querySelectorAll('.glitter').forEach(el => { el.style.backgroundImage = glitterURL; });

  /* ------------------------------------------------ 指针与弹簧状态 */
  const MAX_TILT = 12;          // 最大倾角（度）
  let pxT = 0, pyT = 0;         // 指针目标位置 (-1..1)
  let px = 0, py = 0;           // 平滑后的指针
  let hovering = false, pressed = false, flipped = false;
  const rx = { x: 6, v: 0 };    // rotateX 弹簧
  const ry = { y: -38, v: 0 };  // rotateY 弹簧（初始偏转，入场回弹）
  let scale = 0.94, tz = -46;   // 入场时略小略远

  stage.addEventListener('pointermove', e => {
    const r = tilt.getBoundingClientRect();
    pxT = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pyT = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    hovering = true;
  });
  stage.addEventListener('pointerleave', () => { hovering = false; pressed = false; pxT = 0; pyT = 0; });
  card3d.addEventListener('pointerdown', () => { pressed = true; });
  addEventListener('pointerup', () => { pressed = false; });
  if (!reduced) {
    card3d.addEventListener('click', doFlip);
    card3d.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doFlip(); }
    });
  }

  function doFlip() {
    flipped = !flipped;
    ry.v += flipped ? 9 : -9;   // 翻面附加冲量，弹簧会带出甩动感
    burstAtCard();
    card3d.setAttribute('aria-pressed', String(flipped));
  }

  /* ------------------------------------------------ 粒子（余烬 + 翻面礼花） */
  const cv = $('#fx');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const embers = [], sparks = [];

  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = cv.width = Math.round(innerWidth * DPR);
    H = cv.height = Math.round(innerHeight * DPR);
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize);
  resize();

  const newEmber = () => ({
    x: Math.random() * W,
    y: H * (1 + Math.random() * 0.2),
    r: (0.6 + Math.random() * 1.7) * DPR,
    vy: (0.16 + Math.random() * 0.42) * DPR,
    ph: Math.random() * Math.PI * 2,
    sw: (6 + Math.random() * 16) * DPR,
    a: 0.2 + Math.random() * 0.45,
  });
  const EMBERS = Math.min(85, ((innerWidth * innerHeight) / 16000) | 0);
  for (let i = 0; i < EMBERS; i++) { const e = newEmber(); e.y = Math.random() * H; embers.push(e); }

  function burstAtCard() {
    const r = card3d.getBoundingClientRect();
    const cx = (r.left + r.width / 2) * DPR;
    const cy = (r.top + r.height / 2) * DPR;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.6 + Math.random() * 6.5) * DPR;
      sparks.push({
        x: cx + Math.cos(a) * r.width * 0.32 * DPR,
        y: cy + Math.sin(a) * r.height * 0.32 * DPR,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.2 * DPR,
        r: (0.9 + Math.random() * 2.4) * DPR,
        life: 1,
        decay: 0.01 + Math.random() * 0.017,
      });
    }
  }

  function drawFX() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.vy;
      e.ph += 0.011;
      if (e.y < -12) Object.assign(e, newEmber());
      ctx.globalAlpha = e.a * (0.62 + 0.38 * Math.sin(e.ph * 3.1));
      ctx.fillStyle = '#ffd977';
      ctx.beginPath();
      ctx.arc(e.x + Math.sin(e.ph * 2.2) * e.sw, e.y, e.r, 0, 7);
      ctx.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy;
      s.vy += 0.055 * DPR; s.vx *= 0.985;
      s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.life > 0.55 ? '#fff3c8' : '#ffca5f';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.45 + s.life * 0.55), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------ 主循环 */
  function frame(t) {
    // 指针平滑
    px += (pxT - px) * 0.14;
    py += (pyT - py) * 0.14;

    // 翻面后倾角方向取反，保证视觉上仍朝指针下压
    const sign = flipped ? -1 : 1;
    const flip = flipped ? 180 : 0;
    const txT = -pyT * MAX_TILT * sign;
    const tyT = pxT * MAX_TILT * sign + flip;

    // 弹簧（欠阻尼，带一点小丑牌式的回弹晃动）
    rx.v = (rx.v + (txT - rx.x) * 0.155) * 0.74;
    rx.x += rx.v;
    ry.v = (ry.v + (tyT - ry.y) * 0.155) * 0.74;
    ry.y += ry.v;

    // 悬浮抬起 / 按压
    const scaleT = pressed ? 0.962 : hovering ? 1.055 : 1;
    const tzT = (hovering || pressed) ? 30 : 0;
    scale += (scaleT - scale) * 0.12;
    tz += (tzT - tz) * 0.1;

    tilt.style.transform = `rotateX(${rx.x.toFixed(3)}deg) rotateY(${ry.y.toFixed(3)}deg)`;
    card3d.style.transform = `translateZ(${tz.toFixed(2)}px) scale(${scale.toFixed(4)})`;

    // 光效变量
    const mag = Math.min(1, Math.hypot(px, py));
    const boost = hovering ? 1 : 0.3;
    tilt.style.setProperty('--gx', (50 - px * 36).toFixed(2) + '%');
    tilt.style.setProperty('--gy', (50 - py * 36).toFixed(2) + '%');
    tilt.style.setProperty('--holo-x', (50 + px * 44 + Math.sin(t * 0.00021) * 7).toFixed(2) + '%');
    tilt.style.setProperty('--holo-y', (50 + py * 32 + mod(t * 0.0018, 120) - 60).toFixed(2) + '%');
    tilt.style.setProperty('--glit-x', mod(px * 90 + t * 0.009, 320).toFixed(1) + 'px');
    tilt.style.setProperty('--glit-y', mod(py * 70 - t * 0.006, 320).toFixed(1) + 'px');
    tilt.style.setProperty('--holo-o', clamp(0.07 + mag * 0.55 * boost + Math.sin(t * 0.0011) * 0.04, 0, 0.9).toFixed(3));
    tilt.style.setProperty('--glare-o', (0.06 + mag * 0.68 * boost).toFixed(3));
    // 移动时星芒更亮（buling buling）
    tilt.style.setProperty('--spark-o', (0.55 + mag * 0.45 * boost).toFixed(3));

    // 卡影：随倾斜平移、悬浮放大变淡
    shadow.style.transform =
      `translateX(${(-px * 16).toFixed(2)}px) scale(${(hovering ? 1.14 : 1) - Math.abs(px) * 0.05})`;
    shadow.style.opacity = (0.8 - tz * 0.006).toFixed(3);

    // 国徽金属渐变随指针流转
    if (goldGrad) {
      const ang = 14 + px * 34 + py * 18;
      goldGrad.setAttribute('gradientTransform', `rotate(${ang.toFixed(2)} 358.82 389.6)`);
    }

    drawFX();
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // 弱化动效：静态呈现，仅保留翻面
    tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
    card3d.style.transform = 'none';
    card3d.addEventListener('click', () => {
      flipped = !flipped;
      tilt.style.transform = `rotateY(${flipped ? 180 : 0}deg)`;
      card3d.setAttribute('aria-pressed', String(flipped));
    });
  } else {
    requestAnimationFrame(frame);
  }
})();
