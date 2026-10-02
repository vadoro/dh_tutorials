#!/usr/bin/env node
/* 인터랙티브 영상을 MP4 파일로 내보내기
 *
 *   npm install            # playwright 설치 (처음 한 번)
 *   npx playwright install chromium
 *   npm run render         # → video/network-analysis.mp4 (+ .srt 자막 원고)
 *
 * 옵션: --fps 30  --width 1920  --from 0  --to 417  --out video/network-analysis.mp4  --crf 20
 * 필요: ffmpeg (PATH에 있어야 함)
 *
 * 원리: index.html?render 로 열면 플레이어가 '렌더 모드'가 되어 window.__NA_RENDER.draw(T)로
 * 원하는 시각의 장면을 그대로 그립니다. 같은 T면 항상 같은 그림이 나오므로(시드 고정 난수),
 * 프레임을 하나씩 찍어 ffmpeg에 넘기면 끊김 없는 영상이 됩니다.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const ROOT = path.resolve(__dirname, '..');
const FPS = +opt('fps', 30);
const WIDTH = +opt('width', 1920);
const OUT = path.resolve(ROOT, opt('out', 'video/network-analysis.mp4'));
const CRF = opt('crf', '20');

const pad = (n, w = 2) => String(n).padStart(w, '0');
const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const launch = {};
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));

  // 웹 글꼴(Google Fonts)은 Node 쪽에서 받아 넘겨 줌 — 사내 프록시 등으로 브라우저가 직접 못 받을 때도 동작
  const cache = new Map();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    try {
      if (!cache.has(url)) {
        const res = await fetch(url, { headers: { 'user-agent': route.request().headers()['user-agent'] } });
        cache.set(url, { status: res.status, type: res.headers.get('content-type'), body: Buffer.from(await res.arrayBuffer()) });
      }
      const c = cache.get(url);
      await route.fulfill({ status: c.status, headers: { 'content-type': c.type || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: c.body });
    } catch (e) {
      console.warn('글꼴을 받지 못해 기본 글꼴로 그립니다:', url);
      await route.abort();
    }
  });

  await page.goto('file://' + path.join(ROOT, 'index.html') + `?render&w=${WIDTH}`);
  await page.waitForFunction(() => window.__NA_RENDER);
  await page.evaluate(() => window.__NA_RENDER.ready());
  const info = await page.evaluate(() => ({ total: window.__NA_RENDER.total, chapters: window.__NA_RENDER.chapters, captions: window.__NA_RENDER.captions }));
  const from = +opt('from', 0);
  const to = Math.min(+opt('to', info.total), info.total);
  const frames = Math.round((to - from) * FPS);
  console.log(`길이 ${info.total}초, ${from}~${to}초 구간을 ${FPS}fps · 가로 ${WIDTH}px로 ${frames}프레임 렌더링합니다.`);

  // 장(chapter) 정보를 MP4 메타데이터로
  const meta = path.join(path.dirname(OUT), '.chapters.txt');
  let txt = ';FFMETADATA1\ntitle=점과 선의 과학 — 네트워크 분석 입문\nlanguage=kor\n';
  info.chapters.forEach((c, i) => {
    const end = i + 1 < info.chapters.length ? info.chapters[i + 1].start : info.total;
    const s = Math.max(c.start, from) - from, e = Math.min(end, to) - from;
    if (e <= s) return;
    txt += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s * 1000)}\nEND=${Math.round(e * 1000)}\ntitle=${c.title}\n`;
  });
  fs.writeFileSync(meta, txt);

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', meta, '-map_metadata', '1', '-map_chapters', '1',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-tune', 'animation',
    '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg 종료 코드 ' + code)))));

  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const T = from + f / FPS;
    const b64 = await page.evaluate(([T, fps]) => {
      window.__NA_RENDER.draw(T, fps);
      return document.getElementById('screen').toDataURL('image/jpeg', 0.95).split(',')[1];
    }, [T, FPS]);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % (FPS * 10) === 0) {
      const el = (Date.now() - t0) / 1000;
      const eta = f ? (el / f) * (frames - f) : 0;
      console.log(`  ${pad(Math.floor(T / 60))}:${pad(Math.floor(T % 60))}  ${((f / frames) * 100).toFixed(1)}%  남은 시간 약 ${Math.round(eta)}초`);
    }
  }
  ff.stdin.end();
  await ffDone;
  fs.unlinkSync(meta);

  // 자막 원고(.srt) — 유튜브 등에 올릴 때 자막 파일로 쓸 수 있음
  const srt = info.captions
    .filter((c) => c.end > from && c.start < to)
    .map((c, i) => `${i + 1}\n${srtTime(Math.max(0, c.start - from))} --> ${srtTime(Math.min(to, c.end) - from)}\n${c.text.replace(/\*\*/g, '')}\n`)
    .join('\n');
  fs.writeFileSync(OUT.replace(/\.mp4$/, '.srt'), srt);

  await browser.close();
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log(`완료: ${path.relative(ROOT, OUT)} (${mb} MB, ${Math.round((Date.now() - t0) / 1000)}초 걸림)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
