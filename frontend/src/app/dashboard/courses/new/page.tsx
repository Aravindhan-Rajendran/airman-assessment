'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRequireAuth } from '@/context/AuthContext';
import { coursesApi } from '@/lib/api';
import { createCourseSchema, type CreateCourseFormData } from '@/lib/validations';

export default function CreateCoursePage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth(['ADMIN', 'INSTRUCTOR']);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCourseFormData>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { title: '', description: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const course = await coursesApi.create(data.title, data.description);
      router.push(`/dashboard/courses/${course.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  });

  if (loading || !user) return <div className="container">Loading...</div>;

  return (
    <div>
      <h1>Create course</h1>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/courses">← Courses</Link>
      </p>
      <form onSubmit={onSubmit} className="card" style={{ maxWidth: 480 }} noValidate>
        <div className={`form-field ${errors.title ? 'form-field--error' : ''}`} style={{ marginBottom: 16 }}>
          <label htmlFor="course-title">
            Title <span className="form-required">*</span>
          </label>
          <input
            id="course-title"
            type="text"
            {...register('title')}
            className="form-input"
            placeholder="e.g. Private Pilot Ground"
            aria-invalid={!!errors.title}
          />
          {errors.title && (
            <span className="form-field__error" role="alert">
              {errors.title.message}
            </span>
          )}
        </div>
        <div className={`form-field ${errors.description ? 'form-field--error' : ''}`} style={{ marginBottom: 16 }}>
          <label htmlFor="course-description">Description (optional)</label>
          <textarea
            id="course-description"
            {...register('description')}
            className="form-input"
            rows={3}
            placeholder="Brief description of the course"
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <span className="form-field__error" role="alert">
              {errors.description.message}
            </span>
          )}
        </div>
        {submitError && (
          <div className="form-message form-message--error" role="alert" style={{ marginBottom: 12 }}>
            {submitError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={submitting} className="form-submit">
            {submitting ? 'Creating…' : 'Create course'}
          </button>
          <button type="button" onClick={() => router.push('/dashboard/courses')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
