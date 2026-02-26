'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/context/AuthContext';
import { coursesApi, type CourseDetail } from '@/lib/api';

export default function CourseDetailPage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [course, setCourse] = useState<CourseDetail | null>(null);

  useEffect(() => {
    coursesApi.get(id).then(setCourse).catch(() => setCourse(null));
  }, [id]);

  if (!course) return <div>Loading...</div>;

  return (
    <div>
      <h1>{course.title}</h1>
      <p style={{ marginBottom: '1rem' }}><Link href="/dashboard/courses">← Courses</Link></p>
      {course.modules.map((mod) => (
        <div key={mod.id} className="card">
          <h2>{mod.title}</h2>
          <ul style={{ listStyle: 'none', marginTop: 8 }}>
            {mod.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/dashboard/courses/${id}/lesson/${lesson.id}`}>
                  {lesson.title} {lesson.type === 'QUIZ' ? '(Quiz)' : ''}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
