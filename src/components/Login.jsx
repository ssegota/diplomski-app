import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../api.js';

export default function Login({ config, onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState({ email: 'sbaressis@unipu.hr', name: '' });
  const [testPw, setTestPw] = useState('');
  const showTest = config.testLogin && new URLSearchParams(window.location.search).has('test');

  const login = async (path, body) => {
    setBusy(true); setError('');
    try { onLogin(await api(path, { method: 'POST', body })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <header className="hero">
        <div className="kolegij">Fakultet informatike u Puli</div>
        <h1>Završni i diplomski radovi</h1>
        <p className="subtitle">Prijava teme, praćenje statusa, predaja rada, predlošci i upute – na jednom mjestu.</p>
        <div className="autor">Mentor: <b>Sandi Baressi Šegota</b></div>
      </header>
      <div className="wrap">
        <div className="card login-card">
          <h2>Prijava</h2>
          <p className="muted">Prijavite se svojim sveučilišnim Google računom (<b>@{config.allowedDomain}</b>).</p>
          {config.googleClientId ? (
            <div className="google-btn">
              <GoogleLogin
                onSuccess={(r) => login('/auth/google', { credential: r.credential })}
                onError={() => setError('Google prijava nije uspjela. Pokušajte ponovno.')}
                hosted_domain={config.allowedDomain}
                text="signin_with" shape="rectangular" size="large" theme="outline"
              />
            </div>
          ) : <div className="alert warn">Google prijava nije konfigurirana (GOOGLE_CLIENT_ID).</div>}
          {busy && <p className="muted center">Prijava u tijeku…</p>}
          {error && <div className="alert error">{error}</div>}

          {showTest && (
            <form className="form dev-login" onSubmit={(e) => { e.preventDefault(); login('/auth/test', { password: testPw }); }}>
              <div className="muted small"><b>Test prijava</b> – testni studentski račun.</div>
              <input type="password" value={testPw} onChange={(e) => setTestPw(e.target.value)} placeholder="lozinka" autoComplete="current-password" />
              <button className="btn" type="submit" disabled={busy}>Prijavi se kao test student</button>
            </form>
          )}

          {config.devLogin && (
            <form className="form dev-login" onSubmit={(e) => { e.preventDefault(); login('/auth/dev', dev); }}>
              <div className="muted small"><b>DEV prijava</b> – samo lokalno (DEV_LOGIN=true), u produkciji isključena.</div>
              <input type="email" value={dev.email} onChange={(e) => setDev({ ...dev, email: e.target.value })} placeholder="email" />
              <input value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} placeholder="ime (neobavezno)" />
              <div className="row">
                <button className="btn" type="submit" disabled={busy}>Prijavi se</button>
                <button className="link small" type="button" onClick={() => setDev({ email: 'ana.anic@unipu.hr', name: 'Ana Anić' })}>student primjer</button>
                <button className="link small" type="button" onClick={() => setDev({ email: 'sbaressis@unipu.hr', name: '' })}>admin</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
