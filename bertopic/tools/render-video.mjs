// index.html의 애니메이션을 프레임 단위로 렌더링해 MP4로 저장합니다.
//   node tools/render-video.mjs [출력.mp4] [fps]
// 필요: playwright(Chromium), ffmpeg (FFMPEG 환경 변수로 경로 지정 가능)
// 옵션: FRAMES="6.2,30,90" 를 주면 해당 시점만 JPEG로 저장합니다 (미리보기용).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(resolve(process.execPath, '../../lib/node_modules/playwright'))); }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || resolve(root, 'video/bertopic-explainer.mp4'));
const fps = Number(process.argv[3] || 30);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const launch = { args: ['--disable-web-security'] };
if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error:', e.message));
// 프록시 환경에서 브라우저가 폰트 서버 인증서를 신뢰하지 못하면, 폰트 요청만 Node(시스템 CA 사용)가 대신 받아 전달합니다.
if (process.env.HTTPS_PROXY && process.env.ROUTE_FONTS !== '0') {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const req = route.request();
    const res = await fetch(req.url(), { headers: { 'user-agent': req.headers()['user-agent'] || '' } });
    await route.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: Buffer.from(await res.arrayBuffer()) });
  });
}
await page.goto(pathToFileURL(resolve(root, 'index.html')).href + '#export', { waitUntil: 'networkidle' });
await page.evaluate(() => window.BT.ready);
await page.waitForTimeout(500);
const duration = await page.evaluate(() => window.BT.duration);

if (process.env.FRAMES) {
  const dir = resolve(process.env.FRAMES_DIR || resolve(root, 'frames'));
  mkdirSync(dir, { recursive: true });
  for (const t of process.env.FRAMES.split(',').map(Number)) {
    const data = await page.evaluate(t => window.BT.frame(t, 0.88), t);
    writeFileSync(resolve(dir, `f_${String(t.toFixed(1)).padStart(6, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log('frames saved to', dir);
  process.exit(0);
}

mkdirSync(dirname(out), { recursive: true });
const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.ceil(duration * fps);
const t0 = Date.now();
for (let f = 0; f <= total; f++) {
  const data = await page.evaluate(t => window.BT.frame(t, 0.93), Math.min(duration, f / fps));
  const buf = Buffer.from(data.split(',')[1], 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % (fps * 10) === 0) console.log(`${(f / fps).toFixed(0)}s / ${duration}s  (${((Date.now() - t0) / 1000).toFixed(0)}s 경과)`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('saved', out);
