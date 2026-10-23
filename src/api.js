const TOKEN_KEY = 'dipl_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) { payload = raw; headers['content-type'] = 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Greška ${res.status}`);
  }
  return res.headers.get('content-type')?.includes('application/json') ? res.json() : res.arrayBuffer();
}

// Datoteke se šalju u komadima (< 6 MB limita Netlify funkcija).
export async function uploadFile(file, onProgress = () => {}) {
  const init = await api('/files', { method: 'POST', body: { name: file.name, size: file.size, type: file.type } });
  for (let i = 0; i < init.chunks; i++) {
    const part = file.slice(i * init.chunkSize, (i + 1) * init.chunkSize);
    await api(`/files/${init.id}/chunks/${i}`, { method: 'PUT', raw: await part.arrayBuffer() });
    onProgress((i + 1) / init.chunks);
  }
  await api(`/files/${init.id}/complete`, { method: 'POST', body: {} });
  return init.id;
}

export async function downloadFile(fileId) {
  const meta = await api(`/files/${fileId}`);
  const parts = [];
  for (let i = 0; i < meta.chunks; i++) parts.push(await api(`/files/${fileId}/chunks/${i}`));
  const url = URL.createObjectURL(new Blob(parts, { type: meta.type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: meta.name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const fmtSize = (n) => (n == null ? '' : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
