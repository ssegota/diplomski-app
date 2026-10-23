import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fmtDate, fmtDateTime, fmtSize } from '../api.js';
import { Msg } from './common.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const INK = '#1b2a5a';

async function publicFetch(path, opts = {}) {
  const res = await fetch(`/api/public/r/${path}`, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Greška ${res.status}`);
  return res;
}

// Obreže prozirne rubove; vraća novi canvas (ili null ako je prazan).
function trimCanvas(src) {
  const ctx = src.getContext('2d');
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Potpis + ispod ime i datum (tekst se crta ovdje jer standardni PDF fontovi nemaju č/ć/đ).
function composeSignature(sig, name) {
  const caption = `${name} · ${fmtDate(new Date().toISOString())}`;
  const fontPx = Math.max(16, Math.round(sig.width * 0.075));
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${fontPx}px system-ui, sans-serif`;
  const textW = Math.ceil(m.measureText(caption).width);
  const out = document.createElement('canvas');
  out.width = Math.max(sig.width, textW + 8);
  out.height = sig.height + Math.round(fontPx * 1.5);
  const ctx = out.getContext('2d');
  ctx.drawImage(sig, (out.width - sig.width) / 2, 0);
  ctx.font = `${fontPx}px system-ui, sans-serif`;
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(caption, out.width / 2, sig.height + Math.round(fontPx * 0.2));
  return out;
}

function SignaturePad({ onChange }) {
  const [mode, setMode] = useState('draw');
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    dirty.current = false; onChange(null);
  }, [onChange]);
  useEffect(() => { if (mode === 'draw') setup(); }, [mode, setup]);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId); drawing.current = true; const ctx = canvasRef.current.getContext('2d'); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); };
  const move = (e) => { if (!drawing.current) return; const ctx = canvasRef.current.getContext('2d'); const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); dirty.current = true; };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(trimCanvas(canvasRef.current)); };

  const fromFile = (file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // Bijelu/svijetlu pozadinu skeniranog potpisa pretvori u prozirnu.
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
        if (lum > 215) d.data[i + 3] = 0;
      }
      ctx.putImageData(d, 0, 0);
      onChange(trimCanvas(c));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="form">
      <div className="seg">
        <button type="button" className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>Nacrtaj</button>
        <button type="button" className={mode === 'upload' ? 'on' : ''} onClick={() => { setMode('upload'); onChange(null); }}>Učitaj sliku</button>
      </div>
      {mode === 'draw' ? (
        <>
          <div className="pad-wrap">
            <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
          </div>
          <div className="row"><span className="muted small">Potpišite se mišem, prstom ili olovkom.</span><button type="button" className="link small" onClick={setup}>Obriši</button></div>
        </>
      ) : (
        <label className="file-picker">Slika potpisa (PNG/JPG, po mogućnosti na bijeloj podlozi)
          <input type="file" accept="image/*" onChange={(e) => fromFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

export default function PublicSign({ token }) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(null); // {w, h} u PDF točkama
  const [version, setVersion] = useState(0);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  const [name, setName] = useState('');
  const [sig, setSig] = useState(null);
  const [place, setPlace] = useState(null); // {x, y} udio, gornji lijevi kut
  const [width, setWidth] = useState(0.26);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({});
  const [dl, setDl] = useState('');
  const onSig = useCallback((c) => setSig(c), []);

  useEffect(() => { document.title = 'Potpis izvještaja — FIPU'; }, []);
  useEffect(() => { publicFetch(token).then((r) => r.json()).then(setMeta).catch((e) => setError(e.message)); }, [token, version]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await publicFetch(`${token}/pdf?v=${version}`)).arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await doc.getPage(1);
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        const cssW = stageRef.current.clientWidth;
        const scale = (cssW / base.width) * (window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        const c = canvasRef.current;
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        setPageSize({ w: base.width, h: base.height });
      } catch (e) { if (!cancelled) setError(e.message); }
    })();
    return () => { cancelled = true; };
  }, [token, version]);

  const composed = useMemo(() => (sig && name.trim() ? composeSignature(sig, name.trim()) : null), [sig, name]);
  const composedUrl = useMemo(() => composed?.toDataURL('image/png'), [composed]);
  const ghostH = composed && pageSize ? width * (composed.height / composed.width) * (pageSize.w / pageSize.h) : 0;

  const onStageClick = (e) => {
    if (!composed) return;
    const r = stageRef.current.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    setPlace({ x: Math.min(Math.max(fx - width / 2, 0), 1 - width), y: Math.min(Math.max(fy - ghostH / 2, 0), 1 - ghostH) });
  };

  const submit = async () => {
    setMsg({});
    if (!name.trim()) return setMsg({ error: 'Upišite ime i prezime.' });
    if (!composed) return setMsg({ error: 'Nacrtajte ili učitajte potpis.' });
    if (!place) return setMsg({ error: 'Kliknite na izvještaj na mjesto gdje ide potpis.' });
    setBusy(true);
    try {
      await publicFetch(`${token}/sign`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), image: composedUrl, x: place.x, y: place.y, w: width }),
      });
      setPlace(null); setSig(null); setVersion((v) => v + 1);
      setMsg({ ok: 'Hvala! Izvještaj je potpisan i spremljen, a mentor je obaviješten.' });
    } catch (e) { setMsg({ error: e.message }); }
    finally { setBusy(false); }
  };

  const downloadThesis = async () => {
    setDl('Preuzimanje…');
    try {
      const m = await (await publicFetch(`${token}/thesis`)).json();
      const parts = [];
      for (let i = 0; i < m.chunks; i++) { parts.push(await (await publicFetch(`${token}/thesis/chunks/${i}`)).arrayBuffer()); setDl(`Preuzimanje… ${Math.round(((i + 1) / m.chunks) * 100)} %`); }
      const url = URL.createObjectURL(new Blob(parts, { type: m.type }));
      Object.assign(document.createElement('a'), { href: url, download: m.name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDl('');
    } catch (e) { setDl(e.message); }
  };

  if (error && !meta) return <div className="wrap pad"><div className="alert error">{error}</div></div>;

  const st = meta?.student;
  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand"><span className="logo">FIPU</span> Potpis izvještaja</div>
          {meta?.mentorName && <div className="small">Mentor: <b>{meta.mentorName}</b></div>}
        </div>
      </header>
      <main className="wrap main">
        {!meta ? <p className="muted">Učitavanje…</p> : (
          <div className="sign-layout">
            <section className="card">
              <h2>{meta.title}</h2>
              <p className="muted small" style={{ marginTop: -6 }}>
                {composed ? (place ? 'Kliknite drugdje za premještanje potpisa.' : 'Kliknite na izvještaj na mjesto gdje ide potpis.') : 'Pregled izvještaja.'}
              </p>
              <div ref={stageRef} className={`pdf-stage ${composed ? 'placing' : ''}`} onClick={onStageClick}>
                <canvas ref={canvasRef} />
                {composed && place && (
                  <div className="sig-ghost" style={{ left: `${place.x * 100}%`, top: `${place.y * 100}%`, width: `${width * 100}%` }}>
                    <img src={composedUrl} alt="" />
                  </div>
                )}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <a className="btn small" href={`/api/public/r/${token}/pdf?v=${version}`} target="_blank" rel="noreferrer">
                  Preuzmi PDF{meta.signatures.length ? ' (potpisani)' : ''}
                </a>
              </div>
            </section>

            <div className="stack">
              <section className="card sign-meta">
                <h2>Rad</h2>
                {st && <>
                  <div className="kv"><span>Student</span><b>{st.name}</b></div>
                  <div className="kv"><span>Vrsta rada</span><b>{st.type}</b></div>
                  {st.topic && <div className="kv"><span>Tema</span><b>{st.topic.titleHr}{st.topic.titleEn && <><br /><i className="muted">{st.topic.titleEn}</i></>}</b></div>}
                </>}
                <div className="row" style={{ marginTop: 12 }}>
                  {st?.githubUrl
                    ? <a className="btn small" href={st.githubUrl} target="_blank" rel="noreferrer">GitHub repozitorij ↗</a>
                    : <span className="muted small">GitHub repozitorij nije naveden.</span>}
                  {meta.thesis
                    ? <button className="btn small" onClick={downloadThesis} disabled={dl.startsWith('Preuzimanje')}>Predani rad (PDF) · {fmtSize(meta.thesis.size)}</button>
                    : <span className="muted small">Rad još nije predan.</span>}
                </div>
                {dl && <div className="small muted">{dl}</div>}
                {meta.thesis && <div className="muted small">{meta.thesis.name} · {meta.thesis.kind === 'final' ? 'konačna verzija' : 'verzija za pregled'} · {fmtDateTime(meta.thesis.at)}</div>}
              </section>

              {meta.signatures.length > 0 && (
                <section className="card">
                  <h2>Potpisi</h2>
                  <ul className="sig-list">{meta.signatures.map((s, i) => <li key={i}>✍ {s.name} <span className="muted small">· {fmtDateTime(s.at)}</span></li>)}</ul>
                </section>
              )}

              <section className="card form">
                <h2>Potpiši izvještaj</h2>
                <label><span><span className="step-tag">1</span>Ime i prezime</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Ivana Horvat" /></label>
                <div><div className="small" style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}><span className="step-tag">2</span>Potpis</div>
                  <SignaturePad key={version} onChange={onSig} /></div>
                <div className="small" style={{ fontWeight: 600, color: 'var(--muted)' }}><span className="step-tag">3</span>Kliknite na izvještaj gdje ide potpis</div>
                {composed && (
                  <label>Veličina potpisa
                    <input type="range" min="0.1" max="0.5" step="0.01" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                  </label>
                )}
                <Msg error={msg.error} ok={msg.ok} />
                <button className="btn primary" disabled={busy || !composed || !place} onClick={submit}>
                  <span className="step-tag" style={{ background: '#fff', color: 'var(--hawaii-dark)' }}>4</span>{busy ? 'Spremanje…' : 'Potpiši i spremi'}
                </button>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
