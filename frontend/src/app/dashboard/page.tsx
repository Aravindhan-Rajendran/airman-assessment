'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useRequireAuth();
  const isStudent = user?.role === 'STUDENT';
  const isInstructor = user?.role === 'INSTRUCTOR';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.email}. Role: {user?.role}.</p>

      {isStudent && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>What you can do</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <Link href="/dashboard/courses" className="card" style={{ padding: '1rem', minWidth: 200, textDecoration: 'none' }}>
              <strong>Browse courses</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>View courses, open lessons and quizzes.</p>
            </Link>
            <Link href="/dashboard/schedule" className="card" style={{ padding: '1rem', minWidth: 200, textDecoration: 'none' }}>
              <strong>Request a booking</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Request a training time slot.</p>
            </Link>
          </div>
        </div>
      )}

      {(isInstructor || isAdmin) && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Quick links</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <Link href="/dashboard/courses" className="card" style={{ padding: '1rem', minWidth: 180, textDecoration: 'none' }}>
              <strong>Courses</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Manage courses and content.</p>
            </Link>
            <Link href="/dashboard/schedule" className="card" style={{ padding: '1rem', minWidth: 180, textDecoration: 'none' }}>
              <strong>Schedule</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Add availability, view bookings.</p>
            </Link>
            {(isAdmin) && (
              <Link href="/dashboard/admin" className="card" style={{ padding: '1rem', minWidth: 180, textDecoration: 'none' }}>
                <strong>Admin</strong>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Approve students and bookings.</p>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
