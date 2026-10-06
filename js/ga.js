/* =========================================================
   Googleアナリティクス（GA4）
   - ページビュー・スクロール・外部リンクのクリックは、GA4の「拡張計測機能」が自動で記録する
   - それに加えて、公式LINEのボタンが押されたら「line_click」として、押された場所ごとに記録する
     （GA4の管理画面で line_click を「キーイベント」にすると、友だち追加の入口として成果を数えられる）
   ※ セキュリティ設定（_headers）でページ内に直接スクリプトを書けないため、このファイルにまとめている
   ========================================================= */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-GX3JL3MY73');

(() => {
  // ボタンの場所の名前（GA4の画面ではこの名前で並ぶ）
  const PLACES = [
    ['.header__line', 'header'],
    ['.nav__sp-line', 'menu'],
    ['#wheelSend', 'balance_wheel'],
    ['.line-float', 'float_button'],
    ['.contact', 'contact'],
    ['.footer', 'footer'],
  ];
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="line-harness"]');
    if (!a) return;
    const hit = PLACES.find(([sel]) => a.matches(sel) || a.closest(sel));
    gtag('event', 'line_click', {
      link_location: hit ? hit[1] : 'other',
      link_url: a.href,
    });
  });
})();
