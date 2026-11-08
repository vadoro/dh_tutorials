"""VoiceStudio로 음성 해설 파일을 만드는 도구(voicestudio-narration.py)가 쓰는 부분.

표준 라이브러리만 써요. VoiceStudio(로컬 앱, 기본 http://localhost:3900)의 POST /generate로 WAV를 받아
앞뒤 무음을 다듬고, ffmpeg(MP3) 또는 macOS afconvert(AAC .m4a)로 줄여 저장해요.
"""
import array
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
import wave


def http(method, url, body=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, dict(r.headers), r.read()


def multipart(fields):
    b = uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        out.write(str(v).encode('utf-8'))
        out.write(b'\r\n')
    out.write(f'--{b}--\r\n'.encode())
    return out.getvalue(), f'multipart/form-data; boundary={b}'


def profiles(server):
    try:
        _, _, raw = http('GET', f'{server}/profiles')
    except urllib.error.URLError as e:
        sys.exit(f'VoiceStudio에 연결하지 못했어요({server}): {e}. VoiceStudio 앱이 켜져 있는지 확인해 주세요.')
    data = json.loads(raw)
    return data if isinstance(data, list) else next((data[k] for k in ('profiles', 'items', 'data') if isinstance(data, dict) and isinstance(data.get(k), list)), [])


def find_profile(server, want, items=None):
    items = items if items is not None else profiles(server)
    hit = [p for p in items if p.get('id') == want] or [p for p in items if p.get('name') == want]
    if not hit:
        names = ', '.join(f"{p.get('name')} ({p.get('id')})" for p in items) or '(없음)'
        sys.exit(f'프로필 "{want}"을 찾지 못했어요. 있는 프로필: {names}')
    if len(hit) > 1:
        print(f'같은 이름의 프로필이 {len(hit)}개예요 → 첫 번째({hit[0].get("id")})를 써요. 다른 것을 쓰려면 프로필 id를 적어 주세요.')
    return hit[0]


def trim_wav(raw, keep=0.12, thresh=0.012):
    """앞뒤의 긴 무음을 잘라요. 16비트 PCM만 다루고, 아니면 그대로 돌려줘요.
    돌려주는 값: (wav 바이트, 길이 초, 소리가 있었는지)"""
    with wave.open(io.BytesIO(raw)) as w:
        ch, sw, sr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        frames = w.readframes(nf)
    if sw != 2:
        return raw, nf / sr, True
    a = array.array('h', frames)
    if sys.byteorder == 'big':
        a.byteswap()
    lim = int(32767 * thresh)
    loud = [i for i in range(0, len(a), ch * 40) if max(abs(a[j]) for j in range(i, min(i + ch * 40, len(a)))) > lim]
    if not loud:
        return raw, nf / sr, False
    pad = int(keep * sr) * ch
    s, e = max(0, loud[0] - pad), min(len(a), loud[-1] + ch * 40 + pad)
    s -= s % ch
    e -= e % ch
    b = a[s:e]
    if sys.byteorder == 'big':
        b.byteswap()
    out = io.BytesIO()
    with wave.open(out, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b.tobytes())
    return out.getvalue(), (e - s) / ch / sr, True


def encoder():
    ff = shutil.which('ffmpeg')
    if ff:
        return 'mp3', lambda src, dst: subprocess.run([ff, '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '48k', dst], check=True)
    af = shutil.which('afconvert')
    if af:
        return 'm4a', lambda src, dst: subprocess.run([af, '-f', 'm4af', '-d', 'aac', '-b', '48000', src, dst], check=True)
    print('ffmpeg · afconvert가 없어 WAV로 저장해요(파일이 커요). ffmpeg를 설치하면 MP3로 줄여 저장해요.')
    return 'wav', lambda src, dst: shutil.copyfile(src, dst)


def _paren(m):
    """괄호 하나를 쉼으로: 값(내적)을 → 값, 내적을 · 세기(연락 횟수, 거래액)를 → 세기를, 연락 횟수, 거래액,
    (괄호 바로 뒤에 붙은 조사는 괄호 속 말에 붙이고, 괄호 속이 여러 개를 늘어놓은 것이면 앞말에 붙여요)"""
    inner, part = m.group(1).strip(' ,'), m.group(2) or ''
    if not inner:
        return part
    if part and ',' in inner:
        return f'{part}, {inner}, '
    return f', {inner}{part}' + ('' if part else ', ')


def speakable(text):
    """엔진에 넘길 글: 자막의 화면용 기호를 쉼으로 (파일 이름 = 조각 id는 원래 글로 정하니 바뀌지 않아요).
    괄호는 쉼표로, 따옴표 · 별표는 지우고, 쉼표가 겹치지 않게 다듬어요. 끝에 문장부호가 없으면 마침표를 붙여요
    (엔진이 끝을 올리거나 뭉개지 않게)."""
    s = str(text)
    s = re.sub(r'[\[\]{}"*_]', '', s)
    s = re.sub(r'\s*\(([^()]*)\)([가-힣]{1,3})?', _paren, s)
    s = re.sub(r'\s*[()]\s*', ', ', s)
    s = re.sub(r'\s*[—–]\s*', ', ', s)
    s = re.sub(r'\s*/\s*', ', ', s)
    s = re.sub(r'(?<=\d),(?=\d{3}(?!\d))', '', s)   # 1,000 → 1000 (아래 쉼표 다듬기가 '1, 000'으로 떼지 않게)
    s = re.sub(r'\s*,(\s*,)+', ',', s)
    s = re.sub(r'\s+([,.?!:;])', r'\1', s)
    s = re.sub(r'([.?!])\s*,', r'\1', s)
    s = re.sub(r',\s*([.?!])', r'\1', s)
    s = re.sub(r'\s{2,}', ' ', s).strip(' ,')
    return s + '.' if s and s[-1] not in '.!?' else s


def units(text):
    """말의 길이(한국어 음절 + 영어 낱말 둘 + 숫자 하나) — 만든 소리가 너무 빠르거나 느린지 볼 때"""
    return max(1, len(re.findall(r'[가-힣]', text)) + len(re.findall(r'[A-Za-z]+', text)) * 2 + len(re.findall(r'\d', text)))


def badness(text, dur, sound):
    """0이면 그럴듯한 소리, 클수록 이상해요(소리 없음 · 말에 비해 너무 짧거나 긴 소리 — 가끔 엔진이 잡음 · 무음을
    돌려주거나, 말을 건너뛰거나, 끝에 같은 소리를 늘어놓아요). 1초에 읽은 음절 수로 봐요(보통 4~8)."""
    if not sound or dur < 0.25:
        return 99.0
    rate = units(text) / dur
    lo, hi = 2.0, 10.5
    return max(0.0, rate / hi - 1, lo / rate - 1)


def generate(server, text, profile_id, seed, tries=3):
    """WAV를 만들어 다듬어 돌려줘요: (wav 바이트, 길이 초, 쓴 seed). 이상한 소리면 seed를 바꿔 다시(최대 tries번,
    한두 음절은 여덟 번). 끝내 이상하면 가장 덜 이상한 것을 돌려주고 seed를 음수로(경고용)."""
    best = None
    n = max(tries, 8) if units(text) <= 2 else tries
    for k in range(n):
        sd = seed + k * 1000
        body, ctype = multipart({'text': speakable(text), 'language': 'Korean', 'profile_id': profile_id,
                                 'engine': 'omnivoice', 'seed': sd})
        _, _, raw = http('POST', f'{server}/generate', body, {'Content-Type': ctype}, timeout=900)
        if raw[:4] != b'RIFF':
            raise RuntimeError(f'WAV가 아니에요: {raw[:200]!r}')
        wav, dur, sound = trim_wav(raw)
        bad = badness(text, dur, sound)
        if bad == 0:
            return (wav, dur, sd)
        if best is None or bad < best[0]:
            best = (bad, wav, dur, sd)
    return (best[1], best[2], -best[3] if best[3] else -1)


def save(wav, path, enc):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf:
        tf.write(wav)
    try:
        enc(tf.name, path)
    finally:
        os.unlink(tf.name)


def read_clips_js(path, var='DH_CLIPS'):
    """clips.js의 window.<var> = {...}; 를 읽어요(없으면 {})"""
    if not os.path.exists(path):
        return {}
    m = re.search(r'window\.' + var + r'\s*=\s*(\{.*\});?\s*$', open(path, encoding='utf-8').read(), re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except ValueError:
        return {}


def write_clips_js(path, out):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// 음성 해설에 쓸 미리 만든 음성 파일 목록 — tools/voicestudio-narration.py가 다시 써요(손으로 고치지 마세요).\n')
        f.write('// 자막 하나 = 파일 하나(조각 id = DH.narration.pieceId(읽기 바꾸기를 거친 자막)). 없는 자막은 브라우저 음성으로 읽어요.\n')
        f.write('window.DH_CLIPS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
