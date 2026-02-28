'use client';

import Link from 'next/link';
import { useRequireAuth, useAuth } from '@/context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useRequireAuth();
  const { logout } = useAuth();

  if (loading || !user) return <div className="container">Loading...</div>;

  return (
    <>
      <nav>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/dashboard/courses">Courses</Link>
        <Link href="/dashboard/schedule">Schedule</Link>
        {user.role === 'ADMIN' && (
          <Link href="/dashboard/admin">Admin</Link>
        )}
        <span style={{ marginLeft: 'auto' }}>{user.email} ({user.role})</span>
        <a href="#" onClick={(e) => { e.preventDefault(); void logout(); }}>Logout</a>
      </nav>
      <main className="container">{children}</main>
    </>
  );
}
