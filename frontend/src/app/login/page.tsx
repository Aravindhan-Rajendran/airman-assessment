'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { tenantsApi } from '@/lib/api';
import { loginSchema, type LoginFormData } from '@/lib/validations';

export default function LoginPage() {
  const { login, user } = useAuth();
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
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

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${base}/api/tenants/public`)
      .then((r) => r.json())
      .then((r: { data: { id: string; name: string; slug: string }[] }) => setTenants(r.data || []))
      .catch(() => {});
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
