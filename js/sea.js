/* =========================================================
   ファーストビュー：写真の海だけをゆらゆら動かす（試作）
   - WebGLで写真を描き直し、海の範囲だけに小さな波のゆらぎをかける
   - 人物・空・足元の岩は動かさない（マスクで除外）
   - ファーストビューが画面に見えている間だけ動かす
   - WebGLが使えない／動きを減らす設定の人は、今まで通り静止画
   ========================================================= */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.querySelector('.hero .hero__bg');
  const img = box && box.querySelector('img');
  if (!img) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
  if (!gl) return;

  /* ---------- シェーダー ---------- */
  const VERT = `
    attribute vec2 p;
    varying vec2 v;
    void main() { v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

  // 座標はすべて「写真全体を0〜1」とした位置。人物や水平線の位置は hero.jpg に合わせてある
  const FRAG = `
    // スマホのGPUは mediump だと精度が足りず、小さなゆらぎが0に丸められて止まって見えるため highp を使う
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 v;
    uniform sampler2D tex;
    uniform float t;
    uniform vec2 scale;   // object-fit: cover の切り抜き（見えている割合）
    uniform vec2 offset;  // 同・切り抜きの開始位置

    float box(vec2 uv, vec2 a, vec2 b, float f) {
      vec2 lo = smoothstep(a - f, a + f, uv);
      vec2 hi = 1. - smoothstep(b - f, b + f, uv);
      return lo.x * lo.y * hi.x * hi.y;
    }

    void main() {
      vec2 uv = offset + v * scale;

      // 海の範囲：水平線（y≈0.505）の少し下〜足元の岩の手前
      float sea = smoothstep(.505, .53, uv.y) * (1. - smoothstep(.80, .87, uv.y));

      // 人物は動かさない（頭・首・上半身をやわらかく切り抜く）
      vec2 hd = (uv - vec2(.499, .49)) / vec2(.075, .062);
      float person = 1. - smoothstep(.85, 1.15, length(hd));
      person = max(person, box(uv, vec2(.455, .52), vec2(.545, .58), .012));
      // 肩〜腕：肩幅は上で狭く、腕の位置で広い
      person = max(person, box(uv, vec2(.395, .545), vec2(.605, .6), .01));
      person = max(person, box(uv, vec2(.338, .575), vec2(.628, 1.), .01));
      float m = sea * (1. - person);

      // 奥（水平線側）ほど細かく小さく、手前ほど大きくゆっくり。
      // 揺れ幅は数ピクセル以内に抑える（強いと水面がブロック状に崩れて作り物っぽく見える）
      float depth = smoothstep(.505, .85, uv.y);
      float freq = mix(260., 70., depth);
      float amp = mix(.00025, .0011, depth);
      float w1 = sin(uv.y * freq + t * 1.1 + sin(uv.x * 7. + t * .35) * 2.2);
      float w2 = sin(uv.y * freq * .61 - t * .8 + uv.x * 13.);
      float w3 = sin(uv.x * 23. - t * .5 + uv.y * 40.);
      vec2 d = vec2(w3 * .25, w1 * .6 + w2 * .4) * amp * m;

      vec4 c = texture2D(tex, uv + d);
      // 波頭のごくわずかな光の揺らぎ
      c.rgb *= 1. + m * (w1 * w2) * .018 * depth;
      gl_FragColor = vec4(c.rgb, 1.);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(prog, 't');
  const uScale = gl.getUniformLocation(prog, 'scale');
  const uOffset = gl.getUniformLocation(prog, 'offset');

  /* ---------- 写真をテクスチャにする ---------- */
  const start = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    } catch (err) {
      return; // 写真を読み込めない環境では、今まで通り静止画のまま
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    img.after(canvas);

    // 画像と同じ object-fit: cover の切り抜きを、シェーダーに渡す
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((s) => parseFloat(s) / 100);
      const ia = img.naturalWidth / img.naturalHeight, ca = w / h;
      let sx = 1, sy = 1;
      if (ca > ia) sy = ia / ca; else sx = ca / ia;
      gl.uniform2f(uScale, sx, sy);
      gl.uniform2f(uOffset, (1 - sx) * (isNaN(px) ? .5 : px), (1 - sy) * (isNaN(py) ? .5 : py));
    };
    resize();
    window.addEventListener('resize', resize);

    // ファーストビューが見えている間だけ動かす
    let visible = true, raf = 0;
    const t0 = performance.now();
    const frame = (now) => {
      // 時間の値が大きくなると精度が落ちるので、10分ごとに0へ戻す（切り替わりは目立たない）
      gl.uniform1f(uT, ((now - t0) / 1000) % 600);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!box.classList.contains('is-sea-ready')) box.classList.add('is-sea-ready');
      if (visible) raf = requestAnimationFrame(frame);
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    }).observe(box);
  };

  if (img.complete && img.naturalWidth) start();
  else img.addEventListener('load', start, { once: true });
})();
