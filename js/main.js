(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- ページを開いたら、必ず一番上から表示 ---------- */
  // 再読み込み・開き直し・別ページからの移動では、ブラウザが前の位置を後から復元して
  // 途中から始まることがあるため、位置の自動復元を止めて一番上に固定する。
  // 「戻る」で来たとき（元の位置に戻る方が自然）と、#付きのリンクのときは除く。
  const nav0 = performance.getEntriesByType('navigation')[0];
  const cameByBack = nav0 && nav0.type === 'back_forward';
  if (!cameByBack && !location.hash) {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
      // ページを離れるときは自動復元に戻す（あとで「戻る」で来たときに元の位置へ戻れるように）
      window.addEventListener('pagehide', () => { history.scrollRestoration = 'auto'; });
    }
    let userScrolled = false;
    ['wheel', 'touchstart', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, () => { userScrolled = true; }, { once: true, passive: true }));
    // なめらかスクロールの設定に打ち消されないよう、瞬時に移動させる
    const toTop = () => { if (!userScrolled) window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
    toTop();
    requestAnimationFrame(toTop);
    window.addEventListener('DOMContentLoaded', toTop);
    window.addEventListener('load', () => { toTop(); setTimeout(toTop, 60); setTimeout(toTop, 300); });
    window.addEventListener('pageshow', (e) => { if (!e.persisted) toTop(); });
  }

  /* ---------- 英字見出しを1文字ずつに分割 ---------- */
  $$('.js-letters').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    el.setAttribute('aria-label', text);
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
    });
  });

  /* ---------- オープニング → ヒーロー ---------- */
  const opening = $('#opening');
  const hero = $('.hero');
  const startHero = () => {
    document.body.classList.remove('is-loading');
    hero.classList.add('is-in');
  };
  if (reduced || !opening) {
    startHero();
  } else {
    requestAnimationFrame(() => opening.classList.add('is-in'));
    window.setTimeout(() => {
      opening.classList.add('is-done');
      window.setTimeout(startHero, 350);
      window.setTimeout(() => opening.remove(), 1600);
    }, 1700);
  }

  /* ---------- スクロールで表示 ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal], [data-reveal-parent], .js-letters, .img-reveal, .concept__statement').forEach((el) => io.observe(el));

  /* ---------- 数字カウントアップ ---------- */
  const countIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const to = Number(el.dataset.to);
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / 2000, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      };
      if (!reduced) requestAnimationFrame(tick);
      countIo.unobserve(el);
    });
  }, { threshold: .5 });
  $$('.js-count').forEach((el) => countIo.observe(el));

  /* ---------- ロードマップ ---------- */
  const roadmap = $('#roadmap');
  const path = roadmap && $('.roadmap__path', roadmap);
  let roadLen = 0;
  if (path) {
    const vb = roadmap.querySelector('svg').viewBox.baseVal;
    roadLen = path.getTotalLength();
    path.style.strokeDasharray = roadLen;
    path.style.strokeDashoffset = reduced ? 0 : roadLen;
    $$('.roadmap__node', roadmap).forEach((node) => {
      const pt = path.getPointAtLength(roadLen * Number(node.dataset.at));
      node.style.setProperty('--x', `${(pt.x / vb.width) * 100}%`);
      node.style.setProperty('--y', `${(pt.y / vb.height) * 100}%`);
      if (reduced) node.classList.add('is-on');
    });
    if (reduced) $$('.roadmap__circle', roadmap).forEach((c) => c.classList.add('is-on'));
  }
  const updateRoadmap = () => {
    if (!path || reduced) return;
    const r = roadmap.getBoundingClientRect();
    const vh = window.innerHeight;
    // 画面下85%に入ってから、上から35%に来るまでで線を引き切る
    const p = Math.min(Math.max((vh * .85 - r.top) / (vh * .45 + r.height * .35), 0), 1);
    path.style.strokeDashoffset = roadLen * (1 - p);
    $('.roadmap__circle--start', roadmap).classList.toggle('is-on', p > 0);
    $('.roadmap__circle--goal', roadmap).classList.toggle('is-on', p >= .92);
    $$('.roadmap__node', roadmap).forEach((n) => n.classList.toggle('is-on', p >= Number(n.dataset.at)));
  };

  /* ---------- パララックス ---------- */
  const parallaxEls = $$('[data-parallax]');
  const updateParallax = () => {
    if (reduced) return;
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const center = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${center * -Number(el.dataset.parallax)}px, 0)`;
    });
  };

  /* ---------- ヘッダー ---------- */
  const header = $('#header');
  let lastY = window.scrollY;
  const updateHeader = () => {
    const y = window.scrollY;
    const heroEnd = hero.offsetHeight - 80;
    header.classList.toggle('is-solid', y > heroEnd);
    header.classList.toggle('is-hidden', y > heroEnd && y > lastY + 2 && !document.body.classList.contains('is-menu-open'));
    if (Math.abs(y - lastY) > 2) lastY = y;
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHeader();
      updateParallax();
      updateRoadmap();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- スマホメニュー ---------- */
  const menuBtn = $('#menuBtn');
  const nav = $('#nav');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- スマホ：固定の公式LINEボタン ---------- */
  // ファーストビューを過ぎたら表示、お問い合わせ欄が見えている間は隠す
  // （data-hide-float を付けた欄も、操作の邪魔にならないよう表示中は隠す）
  const lineFloat = $('#lineFloat');
  const hideZones = $$('#contact, [data-hide-float]');
  if (lineFloat && hideZones.length) {
    const visible = new Set();
    const zoneIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      updateFloat();
    });
    hideZones.forEach((z) => zoneIo.observe(z));
    const updateFloat = () => lineFloat.classList.toggle('is-show', window.scrollY > hero.offsetHeight * .8 && visible.size === 0);
    window.addEventListener('scroll', updateFloat, { passive: true });
    updateFloat();
  }

  $('#year').textContent = new Date().getFullYear();
})();
