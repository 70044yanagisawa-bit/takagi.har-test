/* =========================================================
   バランスホイール
   - 画面に入ると、サンプルの満足度が中心から伸びる
   - 円をタップ／ドラッグ、またはスライダーで各領域の満足度（1〜10）をつけられる
   - つけた結果は、公式LINEへのメッセージとしてそのまま送れる
   ========================================================= */
(() => {
  const root = document.getElementById('wheel');
  if (!root) return;

  const LINE_ID = '@308fmkzm';
  const LINE_URL = 'https://lin.ee/NoOppDc';
  // 項目は晴さんのセッションで使っているバランスホイール（10項目）＋恋愛
  const AREAS = [
    { en: 'WORK', ja: '仕事', full: '仕事' },
    { en: 'FAMILY', ja: '家族', full: '家族' },
    { en: 'LOVE', ja: '恋愛', full: '恋愛・パートナーシップ', love: true },
    { en: 'RELATIONS', ja: '人間関係', full: '人間関係' },
    { en: 'INTELLECT', ja: '知性', full: '知性' },
    { en: 'BODY', ja: '肉体', full: '肉体' },
    { en: 'MIND', ja: '精神', full: '精神' },
    { en: 'HOBBY', ja: '趣味', full: '趣味' },
    { en: 'BEAUTY', ja: '美容', full: '美容' },
    { en: 'SOCIAL', ja: '社会貢献', full: '社会貢献' },
    { en: 'FINANCE', ja: 'ファイナンス', full: 'ファイナンス' },
  ];
  const SAMPLE = [6, 7, 4, 5, 4, 8, 5, 7, 4, 3, 5];
  const N = AREAS.length;
  const R = 150; // 満足度10のときの半径
  const STEP = R / 10;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };
  // 上を0度として時計回りの角度 → 座標
  const pt = (deg, r) => {
    const a = (deg - 90) * Math.PI / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const wedge = (i, r) => {
    if (r <= 0.01) return '';
    const a0 = i * 360 / N, a1 = (i + 1) * 360 / N;
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };

  /* ---------- SVGを組み立てる ---------- */
  const svg = el('svg', { viewBox: '-230 -230 460 460', class: 'wheel__svg' }, root);
  const grid = el('g', { class: 'wheel__grid' }, svg);
  for (let k = 1; k <= 10; k++) el('circle', { r: k * STEP, class: k === 10 ? 'is-outer' : '' }, grid);
  for (let i = 0; i < N; i++) {
    const [x, y] = pt(i * 360 / N, R);
    el('line', { x1: 0, y1: 0, x2: x.toFixed(2), y2: y.toFixed(2) }, grid);
  }
  const fills = AREAS.map((a, i) => el('path', { class: 'wheel__fill' + (a.love ? ' is-love' : ''), 'data-i': i }, svg));
  const labels = AREAS.map((a, i) => {
    const mid = (i + .5) * 360 / N;
    const [x, y] = pt(mid, R + 42);
    const g = el('g', { class: 'wheel__label' + (a.love ? ' is-love' : ''), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, svg);
    el('text', { class: 'wheel__en', y: -8 }, g).textContent = a.en;
    const ja = el('text', { class: 'wheel__ja', y: 12 }, g);
    ja.textContent = a.ja;
    const score = el('tspan', { class: 'wheel__score', dx: 6 }, ja);
    return score;
  });

  /* ---------- スライダー ---------- */
  const sliderBox = document.getElementById('wheelSliders');
  const inputs = AREAS.map((a, i) => {
    const row = document.createElement('label');
    row.className = 'wheel-slider' + (a.love ? ' is-love' : '');
    row.innerHTML = `<span class="wheel-slider__name">${a.full}</span>`;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: 1, max: 10, step: 1, value: SAMPLE[i] });
    input.setAttribute('aria-label', `${a.full}の満足度`);
    const out = document.createElement('output');
    out.className = 'wheel-slider__value';
    row.append(input, out);
    sliderBox.appendChild(row);
    input.addEventListener('input', () => setScore(i, Number(input.value), true));
    return { input, out };
  });

  /* ---------- 状態とアニメーション ---------- */
  const cur = new Array(N).fill(0);   // 描画中の半径（満足度単位）
  const target = new Array(N).fill(0);
  let touched = false;
  let raf = null;

  const render = () => {
    fills.forEach((f, i) => f.setAttribute('d', wedge(i, cur[i] * STEP)));
    labels.forEach((s, i) => { s.textContent = target[i] ? String(target[i]) : ''; });
    inputs.forEach(({ input, out }, i) => {
      if (target[i]) { input.value = target[i]; out.textContent = target[i]; }
    });
  };
  const animate = (speed = .12) => {
    cancelAnimationFrame(raf);
    const tick = () => {
      let moving = false;
      for (let i = 0; i < N; i++) {
        const d = target[i] - cur[i];
        if (Math.abs(d) > .005) { cur[i] += d * speed; moving = true; } else cur[i] = target[i];
      }
      render();
      if (moving) raf = requestAnimationFrame(tick);
    };
    if (reduced) { cur.splice(0, N, ...target); render(); } else tick();
  };
  const markTouched = () => {
    if (touched) return;
    touched = true;
    document.getElementById('wheelActions').classList.add('is-show');
    document.getElementById('wheelHint').classList.add('is-hidden');
  };
  const setScore = (i, v, fromUser) => {
    target[i] = Math.max(1, Math.min(10, v));
    if (fromUser) { markTouched(); updateSend(); }
    animate(.3);
  };

  // 画面に入ったら、サンプルの形に中心から順に伸ばす
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    SAMPLE.forEach((v, i) => setTimeout(() => { if (!touched) { target[i] = v; animate(); } }, reduced ? 0 : 400 + i * 110));
  }, { threshold: .35 }).observe(root);

  /* ---------- 円をタップ／ドラッグして満足度をつける ---------- */
  const pick = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const dist = Math.hypot(p.x, p.y);
    if (dist > R + 20) return;
    const deg = (Math.atan2(p.y, p.x) * 180 / Math.PI + 90 + 360) % 360;
    const i = Math.floor(deg / (360 / N));
    setScore(i, Math.ceil(dist / STEP), true);
  };
  let dragging = false;
  svg.addEventListener('pointerdown', (e) => { dragging = true; svg.setPointerCapture(e.pointerId); pick(e); });
  svg.addEventListener('pointermove', (e) => { if (dragging) pick(e); });
  ['pointerup', 'pointercancel'].forEach((t) => svg.addEventListener(t, () => { dragging = false; }));

  /* ---------- 結果をLINEで送る ---------- */
  // スマホでは、公式LINEのトーク画面を結果の文面が入った状態で開く
  const send = document.getElementById('wheelSend');
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const updateSend = () => {
    if (!isMobile) { send.href = LINE_URL; return; }
    const lines = AREAS.map((a, i) => `${a.full}：${target[i]}`).join('\n');
    const text = `バランスホイールの結果です。\n${lines}\n\n相談したいこと：`;
    send.href = `https://line.me/R/oaMessage/${encodeURIComponent(LINE_ID)}/?${encodeURIComponent(text)}`;
  };

  document.getElementById('wheelReset').addEventListener('click', () => {
    SAMPLE.forEach((v, i) => { target[i] = v; });
    touched = false;
    document.getElementById('wheelActions').classList.remove('is-show');
    document.getElementById('wheelHint').classList.remove('is-hidden');
    animate();
  });

  render();
})();
