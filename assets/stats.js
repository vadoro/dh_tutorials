/* DH 튜토리얼 방문자 통계 — GoatCounter (쿠키를 쓰지 않는 가벼운 방문 통계)
 *
 * 첫 화면과 각 튜토리얼 index.html이 catalog.js 다음에 불러옵니다.
 *   <script src="../assets/stats.js"></script>
 *
 * - catalog.js의 site.stats.goatcounter에 GoatCounter 코드를 적으면 켜집니다(비워 두면 아무것도 보내지 않음).
 *   예: 'dh-tutorials' → https://dh-tutorials.goatcounter.com 에서 통계를 봅니다.
 * - 사이트 주소(site.stats.host)에서 열었을 때만 셉니다. 내 컴퓨터에서 연 파일, 미리보기,
 *   영상 추출 화면(#export, ?render)은 세지 않습니다.
 * - 주소 끝의 index.html은 떼고 셉니다. …/tf-idf/와 …/tf-idf/index.html이 한 페이지로 모여요.
 * - 방문 수 보여 주기: [data-dh-count="경로"] 요소 안의 [data-n]에 방문 수를 넣고 보이게 합니다.
 *   경로는 이 페이지 기준 상대 경로(예: 'tf-idf/')나 사이트 전체를 뜻하는 'TOTAL'.
 *   GoatCounter 설정의 'Allow adding visitor counts on your website'를 켜야 숫자가 옵니다.
 *   숫자를 못 받거나 0이면 숨긴 채로 둡니다. GoatCounter가 숫자를 최대 4시간 동안 캐시해요.
 *   카드처럼 나중에 그리는 요소는 그린 뒤 window.DH_STATS.fill(감싼 요소)를 부릅니다.
 *   튜토리얼 상단 바(site-bar.js, 섀도 DOM) 안의 방문 수도 여기서 채웁니다.
 */
(function () {
  'use strict';
  var cat = window.DH_CATALOG, st = cat && cat.site && cat.site.stats;
  if (!st || !st.goatcounter || location.hostname !== st.host) return;
  if (location.hash === '#export' || new URLSearchParams(location.search).has('render')) return;

  var base = 'https://' + st.goatcounter + '.goatcounter.com';
  window.goatcounter = { path: function (p) { return p.replace(/index\.html(?=\?|$)/, ''); } };
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', base + '/count');
  document.head.appendChild(s);

  // 방문 수 (GoatCounter 방문자 카운터, 경로마다 한 번만 물어봄)
  var counts = {};
  var countOf = function (key) {
    if (!counts[key]) {
      var path = key === 'TOTAL' ? key : new URL(key, location.href).pathname.replace(/index\.html$/, '');
      counts[key] = fetch(base + '/counter/' + encodeURIComponent(path) + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && d.count && d.count !== '0' ? d.count : null; })
        .catch(function () { return null; });
    }
    return counts[key];
  };
  var fill = function (root) {
    (root || document).querySelectorAll('[data-dh-count]').forEach(function (el) {
      countOf(el.getAttribute('data-dh-count')).then(function (n) {
        if (!n) return;
        (el.querySelector('[data-n]') || el).textContent = n;
        el.hidden = false;
      });
    });
  };
  window.DH_STATS = { fill: fill };

  // 통계를 켠 페이지에만 안내 문구를 보여 줌 (data-dh-stats)
  var show = function () {
    document.querySelectorAll('[data-dh-stats]').forEach(function (el) { el.hidden = false; });
    fill();
    var bar = document.getElementById('dh-site-bar');
    if (bar && bar.shadowRoot) fill(bar.shadowRoot);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
