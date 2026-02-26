'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { tenantsApi } from '@/lib/api';

export default function LoginPage() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${base}/api/tenants/public`)
      .then((r) => r.json())
      .then((r: { data: { id: string; name: string; slug: string }[] }) => setTenants(r.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError('Please select your school.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password, tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>Login</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>School (required)</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
            style={{ width: '100%' }}
          >
            <option value="">— Select your school —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading || !tenantId}>Login</button>
      </form>
    </div>
  );
}
