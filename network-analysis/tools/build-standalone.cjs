#!/usr/bin/env node
/* CSS와 스크립트를 모두 index.html 안에 넣어 파일 하나짜리 페이지를 만듭니다.
 *
 *   node tools/build-standalone.cjs                 → dist/network-analysis.html
 *   node tools/build-standalone.cjs --fragment      → <html>/<head>/<body> 없이 본문만 (다른 페이지에 끼워 넣을 때)
 *
 * 만든 파일은 메일로 보내거나 USB에 담아 어디서든 더블클릭으로 열 수 있습니다.
 * (글꼴은 인터넷이 될 때만 받아지고, 아니면 컴퓨터의 기본 한글 글꼴로 보입니다.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outArg = args.indexOf('--out');
const OUT = path.resolve(ROOT, outArg >= 0 ? args[outArg + 1] : 'dist/network-analysis.html');
const VIDEO_URL = 'https://github.com/vadoro/dh_tutorials/raw/main/network-analysis/video/network-analysis.mp4';

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 사이트 공통 상단 바(../assets/)는 파일 하나로 옮겨 다닐 때 쓸 수 없으므로 뺌
html = html.replace(/<script src="\.\.\/assets\/[^"]+"[^>]*><\/script>\n?/g, '');
html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (_, rel) => `<style>\n${read(rel)}\n</style>`);
html = html.replace(/<script src="(assets\/[^"]+)"><\/script>/g, (_, rel) => `<script>\n${read(rel).replace(/<\/script/gi, '<\\/script')}\n</script>`);
// 파일 하나만 옮겨 다닐 때는 상대 경로의 영상 파일이 없으므로 저장소 주소로 연결
html = html.replace('href="video/network-analysis.mp4" data-video-link', `href="${VIDEO_URL}" target="_blank" rel="noopener" data-video-link`);

if (fragment) {
  const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const keep = head
    .split('\n')
    .filter((l) => !/<meta charset|<meta name="viewport"|<title>/.test(l))
    .join('\n');
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  html = `${title}\n${keep}\n${body}`;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`만듦: ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
