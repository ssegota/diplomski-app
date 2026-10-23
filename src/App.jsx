import { useCallback, useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import Login from './components/Login.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const logout = useCallback(() => { setToken(null); setMe(null); }, []);
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await api('/config'));
        if (getToken()) setMe(await api('/me').catch(() => { setToken(null); return null; }));
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const onLogin = async ({ token }) => { setToken(token); setMe(await api('/me')); };

  if (loading) return <div className="center pad muted">Učitavanje…</div>;
  if (error) return <div className="wrap pad"><div className="alert error">Aplikacija nije dostupna: {error}</div></div>;

  const content = !me ? <Login config={config} onLogin={onLogin} /> : (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand"><span className="logo">FIPU</span> Završni i diplomski radovi</div>
          <div className="user">
            {me.user.picture && <img src={me.user.picture} alt="" referrerPolicy="no-referrer" />}
            <span className="user-name">{me.student?.name || me.user.name}{me.user.role === 'admin' && <span className="pill pill-admin">admin</span>}</span>
            <button className="btn small ghost" onClick={logout}>Odjava</button>
          </div>
        </div>
      </header>
      {me.user.role === 'admin' ? <AdminDashboard mailConfigured={me.mailConfigured} />
        : me.student ? <StudentDashboard student={me.student} />
          : <div className="wrap pad"><div className="alert error">Studentski zapis nije pronađen.</div></div>}
      <footer className="footer wrap muted small">
        Fakultet informatike u Puli · Sveučilište Jurja Dobrile u Puli ·{' '}
        <a href="https://fipu.unipu.hr/fipu/za_studente/teme_zavrsnih_i_diplomskih_radova" target="_blank" rel="noreferrer">Teme završnih i diplomskih radova</a>
      </footer>
    </div>
  );

  return config?.googleClientId ? <GoogleOAuthProvider clientId={config.googleClientId}>{content}</GoogleOAuthProvider> : content;
}
