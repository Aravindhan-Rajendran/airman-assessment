'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function PendingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.push('/login');
  }, [user, loading, router]);
  if (loading || !user) return <div className="container">Loading...</div>;
  return (
    <div className="container">
      <h1>Account Pending</h1>
      <p>Your student account is pending approval by an administrator.</p>
      <p>Logged in as: {user?.email}</p>
    </div>
  );
}
