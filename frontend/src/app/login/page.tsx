'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { getPublicTenants } from '@/lib/api';
import { loginSchema, type LoginFormData } from '@/lib/validations';

const TENANTS_LOAD_SLOW_MESSAGE_AFTER_MS = 5000;

export default function LoginPage() {
  const { login, user } = useAuth();
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState('');
  const [tenantsSlowHint, setTenantsSlowHint] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantId: '', email: '', password: '' },
    mode: 'onBlur',
  });

  const tenantId = watch('tenantId');

  const loadTenants = () => {
    setTenantsError('');
    setTenantsSlowHint(false);
    setTenantsLoading(true);
    const slowHintTimer = window.setTimeout(() => setTenantsSlowHint(true), TENANTS_LOAD_SLOW_MESSAGE_AFTER_MS);
    getPublicTenants()
      .then((list) => {
        clearTimeout(slowHintTimer);
        setTenants(list);
      })
      .catch(() => {
        clearTimeout(slowHintTimer);
        setTenantsError(
          'Could not load schools. The server may be starting—please try again in a moment.'
        );
      })
      .finally(() => {
        clearTimeout(slowHintTimer);
        setTenantsLoading(false);
      });
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError('');
    setLoading(true);
    try {
      await login(data.email, data.password, data.tenantId);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  });

  if (user) return null;

  return (
    <div className="container login-page">
      <div className="login-card card">
        <h1 className="login-card__title">Login</h1>
        <form onSubmit={onSubmit} className="login-form" noValidate>
          <div className={`form-field ${errors.tenantId ? 'form-field--error' : ''}`}>
            <label htmlFor="tenantId">School <span className="form-required">*</span></label>
            <select
              id="tenantId"
              {...register('tenantId')}
              className="form-input"
              aria-invalid={!!errors.tenantId}
              aria-describedby={errors.tenantId ? 'tenantId-error' : undefined}
            >
              <option value="">— Select your school —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {errors.tenantId && (
              <span id="tenantId-error" className="form-field__error" role="alert">
                {errors.tenantId.message}
              </span>
            )}
          </div>
          <div className={`form-field ${errors.email ? 'form-field--error' : ''}`}>
            <label htmlFor="email">Email <span className="form-required">*</span></label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="form-input"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <span id="email-error" className="form-field__error" role="alert">
                {errors.email.message}
              </span>
            )}
          </div>
          <div className={`form-field ${errors.password ? 'form-field--error' : ''}`}>
            <label htmlFor="password">Password <span className="form-required">*</span></label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="form-input"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <span id="password-error" className="form-field__error" role="alert">
                {errors.password.message}
              </span>
            )}
          </div>
          {tenantsLoading && tenantsSlowHint && !tenantsError && (
            <div className="form-message" role="status" style={{ marginBottom: 8 }}>
              Still loading schools… The server may be waking up. You can wait or{' '}
              <button
                type="button"
                onClick={loadTenants}
                style={{ textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
              >
                retry
              </button>
              .
            </div>
          )}
          {tenantsError && (
            <div className="form-message form-message--error" role="alert">
              {tenantsError}
              <button
                type="button"
                onClick={loadTenants}
                className="form-message__retry"
                style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit' }}
              >
                Retry
              </button>
            </div>
          )}
          {submitError && (
            <div className="form-message form-message--error" role="alert">
              {submitError}
            </div>
          )}
          <button type="submit" disabled={loading || !tenantId} className="form-submit">
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
