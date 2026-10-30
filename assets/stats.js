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
 */
(function () {
  'use strict';
  var cat = window.DH_CATALOG, st = cat && cat.site && cat.site.stats;
  if (!st || !st.goatcounter || location.hostname !== st.host) return;
  if (location.hash === '#export' || new URLSearchParams(location.search).has('render')) return;

  window.goatcounter = { path: function (p) { return p.replace(/index\.html(?=\?|$)/, ''); } };
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + st.goatcounter + '.goatcounter.com/count');
  document.head.appendChild(s);

  // 통계를 켠 페이지에만 안내 문구를 보여 줌 (data-dh-stats)
  var show = function () { document.querySelectorAll('[data-dh-stats]').forEach(function (el) { el.hidden = false; }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
