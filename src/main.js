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
  let act = 0;                  // 点亮程度 0..1：悬停恒亮，体感随倾角起伏、静止回落
  let lastT = 0;                // 上一帧时间戳（体感回中用真实时间，避免受刷新率影响）
  const rx = { x: 6, v: 0 };    // rotateX 弹簧
  const ry = { y: -38, v: 0 };  // rotateY 弹簧（初始偏转，入场回弹）
  let scale = 0.94, tz = -46;   // 入场时略小略远

  stage.addEventListener('pointermove', e => {
    if (sensorOn && e.pointerType === 'touch') return;   // 体感已接管触屏拖动
    const r = tilt.getBoundingClientRect();
    pxT = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pyT = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    hovering = true;
  });
  stage.addEventListener('pointerleave', e => {
    if (sensorOn && e.pointerType === 'touch') return;
    hovering = false; pressed = false; pxT = 0; pyT = 0;
  });
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

  /* ------------------------------------------------ 陀螺仪体感（移动端） */
  // 手机倾斜 → 换算成与指针同一套弹簧目标（pxT/pyT），弹簧/光效/国徽流光全部复用。
  // 桌面端直接不启用；触屏设备自动开启。iOS 因系统硬性要求，授权挂在首次轻点上
  // 静默申请（拒绝则不再打扰），除此之外无任何界面开关。
  const footHint = $('#footHint');
  const SENSOR_RANGE = 24;   // 倾斜多少度达到满偏（越小越灵敏）
  const SENSOR_DEAD = 1.2;   // 死区：滤掉手持微抖
  const axis = d =>
    clamp((Math.abs(d) < SENSOR_DEAD ? 0 : d - Math.sign(d) * SENSOR_DEAD) / SENSOR_RANGE, -1, 1);
  let sensorOn = false;         // 收到首个有效读数后置位
  let rawB = null, rawG = null; // 最近一次原始读数（beta/gamma）
  let baseB = 0, baseG = 0;     // 基准姿势，激活时校准、随屏幕旋转重新校准

  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;   // 桌面浏览器可能发全空事件
    rawB = e.beta; rawG = e.gamma;
    if (!sensorOn) {
      sensorOn = true;
      baseB = rawB; baseG = rawG;   // 以当前持机姿势为零点
      if (footHint) footHint.innerHTML = '<b>倾斜手机</b> 光影随动 &nbsp;·&nbsp; <b>轻点</b> 翻面';
    }
    // 按屏幕旋转角换算倾斜轴（角度 = 内容补偿角）
    const ang = (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle : (window.orientation || 0);
    const dB = rawB - baseB, dG = rawG - baseG;
    let dx = dG, dy = dB;                                 // 竖屏：gamma 左右 / beta 前后
    if (ang === 90)                      { dx = -dB; dy = dG; }
    else if (ang === 270 || ang === -90) { dx = dB;  dy = -dG; }
    else if (ang === 180)                { dx = -dG; dy = -dB; }
    pxT = axis(dx);
    pyT = axis(dy);
  }

  const motionDevice =
    matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (motionDevice && window.DeviceOrientationEvent && !reduced) {
    const DOP = window.DeviceOrientationEvent;
    const start = () => addEventListener('deviceorientation', onOrient);
    if (typeof DOP.requestPermission === 'function') {
      // iOS 13+：授权必须由用户手势触发——首次轻点页面时静默申请
      let asked = false;
      addEventListener('pointerdown', () => {
        if (asked) return;
        asked = true;
        DOP.requestPermission().then(s => { if (s === 'granted') start(); }).catch(() => {});
      });
    } else {
      start();
    }
    addEventListener('orientationchange', () => {
      if (sensorOn && rawB != null) { baseB = rawB; baseG = rawG; }
    });
  }

  /* ------------------------------------------------ PWA：离线缓存 */
  // 仅在 http(s) 环境注册（双击 file:// 打开时静默跳过），且等到 load 之后，
  // 避免与首屏渲染、动效初始化抢资源。
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' ||
       location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
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

    // 体感基准回中：贴近零位时快速归零；明显倾斜时基本保持姿
    // 势（仅每 15 秒缓慢校正，消除持机姿势漂移），按真实时间衰减与刷新率无关
    const dt = Math.min(64, t - (lastT || t));
    lastT = t;
    if (sensorOn && rawB != null) {
      const near = Math.abs(rawB - baseB) < 2.5 && Math.abs(rawG - baseG) < 2.5;
      const k = 1 - Math.exp(-dt / (near ? 600 : 15000));
      baseB += (rawB - baseB) * k;
      baseG += (rawG - baseG) * k;
    }

    // 点亮程度：悬停恒亮；体感看倾角幅度，静止回落
    const actT = hovering ? 1 : Math.min(1, Math.hypot(pxT, pyT) * 1.6);
    act += (actT - act) * 0.12;

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

    // 悬浮抬起 / 按压（体感模式下随点亮程度起落）
    const scaleT = pressed ? 0.962 : 1 + act * 0.055;
    const tzT = pressed ? 30 : act * 30;
    scale += (scaleT - scale) * 0.12;
    tz += (tzT - tz) * 0.1;

    tilt.style.transform = `rotateX(${rx.x.toFixed(3)}deg) rotateY(${ry.y.toFixed(3)}deg)`;
    card3d.style.transform = `translateZ(${tz.toFixed(2)}px) scale(${scale.toFixed(4)})`;

    // 光效变量
    const mag = Math.min(1, Math.hypot(px, py));
    const boost = 0.3 + act * 0.7;
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
      `translateX(${(-px * 16).toFixed(2)}px) scale(${(1 + act * 0.14) - Math.abs(px) * 0.05})`;
    shadow.style.opacity = (0.8 - tz * 0.006).toFixed(3);

    // 国徽金属渐变随指针流转
    if (goldGrad) {
      const ang = 14 + px * 34 + py * 18;
      goldGrad.setAttribute('gradientTransform', `rotate(${ang.toFixed(2)} 358.82 389.6)`);
    }
    // 帘子褶皱带随指针轻摆（与其他金属一致的"受光"反应）
    const ribbonGrad = document.getElementById('ribbonGold');
    if (ribbonGrad) {
      ribbonGrad.setAttribute('gradientTransform', `rotate(${(px * 9).toFixed(2)} 358 660)`);
    }
    // 国徽镜面反射带：反光点与倾斜反向移动，像真实镀层
    tilt.style.setProperty('--sheen-x', (50 - px * 52).toFixed(2) + '%');
    tilt.style.setProperty('--sheen-y', (50 - py * 42).toFixed(2) + '%');
    tilt.style.setProperty('--sheen-o', (0.22 + mag * 0.6 * boost).toFixed(3));

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
