import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/auth';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: authErr } = await auth.signIn(email, password);
    if (authErr) {
      setError(authErr);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏢</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green-primary)' }}>
          TRACE
        </h1>
        <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>Business dashboard</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ color: 'var(--red-border)', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid var(--gray-200)',
  borderRadius: 8,
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
};
