import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>AIRMAN Core</h1>
      <p style={{ marginBottom: '1.5rem' }}>Learning &amp; Scheduling</p>
      <Link href="/login">Login</Link>
    </div>
  );
}
