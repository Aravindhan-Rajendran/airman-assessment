'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/context/AuthContext';
import { coursesApi, api, type Lesson } from '@/lib/api';

type QuizContent = { questions: { id: string; text: string; options: { id: string; text: string }[]; correctOptionId: string }[] };

export default function LessonPage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; incorrectQuestions: { questionId: string; correctOptionId: string; selectedOptionId: string }[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    coursesApi.get(courseId).then((c) => {
      for (const mod of c.modules ?? []) {
        const l = mod.lessons?.find((le) => le.id === lessonId);
        if (l) {
          setLesson(l);
          setModuleId(mod.id);
          break;
        }
      }
    }).catch(console.error);
  }, [courseId, lessonId]);

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson || lesson.type !== 'QUIZ' || !moduleId) return;
    setSubmitting(true);
    try {
      const res = await api<{ score: number; incorrectQuestions: { questionId: string; correctOptionId: string; selectedOptionId: string }[] }>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/attempt`,
        { method: 'POST', body: JSON.stringify({ answers }) }
      );
      setResult({ score: res.score, incorrectQuestions: res.incorrectQuestions || [] });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!lesson) return <div>Loading...</div>;

  if (lesson.type === 'TEXT') {
    return (
      <div>
        <h1>{lesson.title}</h1>
        <p><Link href={`/dashboard/courses/${courseId}`}>← Back to course</Link></p>
        <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{lesson.content ?? 'No content.'}</div>
      </div>
    );
  }

  const quiz = (lesson.content ? JSON.parse(lesson.content) : { questions: [] }) as QuizContent;

  return (
    <div>
      <h1>{lesson.title}</h1>
      <p><Link href={`/dashboard/courses/${courseId}`}>← Back to course</Link></p>
      {!result ? (
        <form onSubmit={handleSubmitQuiz} className="card">
          {quiz.questions?.map((q) => (
            <div key={q.id} style={{ marginBottom: '1rem' }}>
              <p><strong>{q.text}</strong></p>
              {(q.options || []).map((opt) => (
                <label key={opt.id} style={{ display: 'block', marginLeft: '1rem' }}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.id}
                    checked={answers[q.id] === opt.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                  />
                  {opt.text}
                </label>
              ))}
            </div>
          ))}
          <button type="submit" disabled={submitting}>Submit</button>
        </form>
      ) : (
        <div className="card">
          <p>Score: {result.score}%</p>
          {result.incorrectQuestions?.length > 0 && (
            <p className="error">Incorrect: {result.incorrectQuestions.map((i) => `Q ${i.questionId} (correct: ${i.correctOptionId})`).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
