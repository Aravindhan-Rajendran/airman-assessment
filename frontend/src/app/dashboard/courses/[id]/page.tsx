'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRequireAuth } from '@/context/AuthContext';
import { coursesApi, type CourseDetail, type CourseModule } from '@/lib/api';
import {
  createModuleSchema,
  createLessonSchema,
  createQuizContentSchema,
  type CreateModuleFormData,
  type CreateLessonFormData,
} from '@/lib/validations';

export type QuizQuestionState = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
};

const defaultQuizQuestion = (): QuizQuestionState => ({
  id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
});

export default function CourseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useRequireAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [lessonFormModuleId, setLessonFormModuleId] = useState<string | null>(null);

  const loadCourse = useCallback(() => {
    coursesApi
      .get(id)
      .then(setCourse)
      .catch(() => {
        setCourse(null);
        setError('Failed to load course');
      });
  }, [id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const canCreate = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';

  const moduleForm = useForm<CreateModuleFormData>({
    resolver: zodResolver(createModuleSchema),
    defaultValues: { title: '', order: 0 },
    mode: 'onBlur',
  });

  const lessonForm = useForm<CreateLessonFormData>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: { title: '', type: 'TEXT', content: '', order: 0 },
    mode: 'onBlur',
  });

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionState[]>([defaultQuizQuestion()]);

  const onModuleSubmit = moduleForm.handleSubmit(async (data) => {
    setError(null);
    try {
      await coursesApi.createModule(id, { title: data.title, order: data.order });
      moduleForm.reset({ title: '', order: 0 });
      setModuleFormOpen(false);
      loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    }
  });

  const onLessonSubmit = lessonForm.handleSubmit(async (data) => {
    if (!lessonFormModuleId) return;
    setError(null);
    let content: string | undefined = data.content?.trim() || undefined;
    if (data.type === 'QUIZ') {
      const built = quizQuestions.map((q) => {
        const nonEmpty = q.options
          .map((t, origIndex) => ({ text: t.trim(), origIndex }))
          .filter((x) => x.text);
        const options = nonEmpty.map((o, i) => ({
          id: String.fromCharCode(97 + i),
          text: o.text,
        }));
        const correctNewIndex = nonEmpty.findIndex((o) => o.origIndex === q.correctIndex);
        const correctOptionId =
          correctNewIndex >= 0 ? String.fromCharCode(97 + correctNewIndex) : options[0]?.id ?? '';
        return {
          id: q.id,
          text: q.text.trim(),
          options,
          correctOptionId,
        };
      });
      const parsed = createQuizContentSchema.safeParse({ questions: built });
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        setError(first?.message ?? 'Invalid quiz: at least 1 question, each with ≥2 options.');
        return;
      }
      content = JSON.stringify(parsed.data);
    }
    try {
      await coursesApi.createLesson(id, lessonFormModuleId, {
        title: data.title,
        type: data.type,
        content,
        order: data.order,
      });
      lessonForm.reset({ title: '', type: 'TEXT', content: '', order: 0 });
      setQuizQuestions([defaultQuizQuestion()]);
      setLessonFormModuleId(null);
      loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    }
  });

  const openLessonForm = (moduleId: string) => {
    setLessonFormModuleId(moduleId);
    setError(null);
  };
  const closeLessonForm = () => {
    setLessonFormModuleId(null);
    lessonForm.reset();
    setQuizQuestions([defaultQuizQuestion()]);
  };

  const addQuizQuestion = () => setQuizQuestions((prev) => [...prev, defaultQuizQuestion()]);
  const removeQuizQuestion = (index: number) => {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
  };
  const updateQuizQuestion = (index: number, patch: Partial<QuizQuestionState>) => {
    setQuizQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };
  const addQuizOption = (qIndex: number) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q))
    );
  };
  const removeQuizOption = (qIndex: number, oIndex: number) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 4) return q;
        const options = q.options.filter((_, j) => j !== oIndex);
        const correctIndex = Math.min(q.correctIndex, options.length - 1);
        return { ...q, options, correctIndex };
      })
    );
  };
  const setQuizOptionText = (qIndex: number, oIndex: number, value: string) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q
      )
    );
  };

  if (!course) return <div>Loading...</div>;

  return (
    <div>
      <h1>{course.title}</h1>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/courses">← Courses</Link>
      </p>
      {error && (
        <div className="form-message form-message--error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {canCreate && (
        <section className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Add module</h2>
          {!moduleFormOpen ? (
            <button type="button" onClick={() => setModuleFormOpen(true)}>
              Create module
            </button>
          ) : (
            <form onSubmit={onModuleSubmit} noValidate style={{ maxWidth: 400 }}>
              <div className={`form-field ${moduleForm.formState.errors.title ? 'form-field--error' : ''}`} style={{ marginBottom: 12 }}>
                <label htmlFor="module-title">Module title <span className="form-required">*</span></label>
                <input
                  id="module-title"
                  type="text"
                  {...moduleForm.register('title')}
                  className="form-input"
                  aria-invalid={!!moduleForm.formState.errors.title}
                />
                {moduleForm.formState.errors.title && (
                  <span className="form-field__error" role="alert">{moduleForm.formState.errors.title.message}</span>
                )}
              </div>
              <div className={`form-field ${moduleForm.formState.errors.order ? 'form-field--error' : ''}`} style={{ marginBottom: 12 }}>
                <label htmlFor="module-order">Order (optional)</label>
                <input
                  id="module-order"
                  type="number"
                  min={0}
                  {...moduleForm.register('order')}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={moduleForm.formState.isSubmitting}>Create module</button>
                <button type="button" onClick={() => { setModuleFormOpen(false); moduleForm.reset(); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {course.modules.map((mod) => (
        <ModuleCard
          key={mod.id}
          courseId={id}
          mod={mod}
          canCreate={canCreate ?? false}
          lessonFormModuleId={lessonFormModuleId}
          lessonForm={lessonForm}
          quizQuestions={quizQuestions}
          addQuizQuestion={addQuizQuestion}
          removeQuizQuestion={removeQuizQuestion}
          updateQuizQuestion={updateQuizQuestion}
          addQuizOption={addQuizOption}
          removeQuizOption={removeQuizOption}
          setQuizOptionText={setQuizOptionText}
          onOpenLessonForm={openLessonForm}
          onCloseLessonForm={closeLessonForm}
          onLessonSubmit={onLessonSubmit}
        />
      ))}
    </div>
  );
}

type ModuleCardProps = {
  courseId: string;
  mod: CourseModule;
  canCreate: boolean;
  lessonFormModuleId: string | null;
  lessonForm: ReturnType<typeof useForm<CreateLessonFormData>>;
  quizQuestions: QuizQuestionState[];
  addQuizQuestion: () => void;
  removeQuizQuestion: (index: number) => void;
  updateQuizQuestion: (index: number, patch: Partial<QuizQuestionState>) => void;
  addQuizOption: (qIndex: number) => void;
  removeQuizOption: (qIndex: number, oIndex: number) => void;
  setQuizOptionText: (qIndex: number, oIndex: number, value: string) => void;
  onOpenLessonForm: (moduleId: string) => void;
  onCloseLessonForm: () => void;
  onLessonSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
};

function ModuleCard({
  courseId,
  mod,
  canCreate,
  lessonFormModuleId,
  lessonForm,
  quizQuestions,
  addQuizQuestion,
  removeQuizQuestion,
  updateQuizQuestion,
  addQuizOption,
  removeQuizOption,
  setQuizOptionText,
  onOpenLessonForm,
  onCloseLessonForm,
  onLessonSubmit,
}: ModuleCardProps) {
  const isAddingLesson = lessonFormModuleId === mod.id;
  const type = lessonForm.watch('type');

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>{mod.title}</h2>
      <ul style={{ listStyle: 'none', marginTop: 8, marginBottom: 8 }}>
        {mod.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/dashboard/courses/${courseId}/lesson/${lesson.id}`}>
              {lesson.title} {lesson.type === 'QUIZ' ? '(Quiz)' : ''}
            </Link>
          </li>
        ))}
      </ul>
      {canCreate && (
        <>
          {!isAddingLesson ? (
            <button type="button" onClick={() => onOpenLessonForm(mod.id)}>
              Add lesson
            </button>
          ) : (
            <form onSubmit={onLessonSubmit} noValidate style={{ marginTop: 12, maxWidth: 480 }}>
              <div className={`form-field ${lessonForm.formState.errors.title ? 'form-field--error' : ''}`} style={{ marginBottom: 12 }}>
                <label htmlFor={`lesson-title-${mod.id}`}>Lesson title <span className="form-required">*</span></label>
                <input
                  id={`lesson-title-${mod.id}`}
                  type="text"
                  {...lessonForm.register('title')}
                  className="form-input"
                  aria-invalid={!!lessonForm.formState.errors.title}
                />
                {lessonForm.formState.errors.title && (
                  <span className="form-field__error" role="alert">{lessonForm.formState.errors.title.message}</span>
                )}
              </div>
              <div className={`form-field ${lessonForm.formState.errors.type ? 'form-field--error' : ''}`} style={{ marginBottom: 12 }}>
                <label htmlFor={`lesson-type-${mod.id}`}>Type <span className="form-required">*</span></label>
                <select id={`lesson-type-${mod.id}`} {...lessonForm.register('type')} className="form-input">
                  <option value="TEXT">Text</option>
                  <option value="QUIZ">Quiz (MCQ)</option>
                </select>
              </div>
              {type === 'TEXT' && (
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label htmlFor={`lesson-content-${mod.id}`}>Content (optional)</label>
                  <textarea
                    id={`lesson-content-${mod.id}`}
                    {...lessonForm.register('content')}
                    className="form-input"
                    rows={4}
                    placeholder="Lesson text content"
                  />
                </div>
              )}
              {type === 'QUIZ' && (
                <div style={{ marginBottom: 12, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontWeight: 600 }}>Quiz questions (min 1, each with exactly 4+ options and one correct)</label>
                    <button type="button" onClick={addQuizQuestion} className="form-input" style={{ padding: '6px 12px' }}>
                      + Add question
                    </button>
                  </div>
                  {quizQuestions.map((q, qIndex) => (
                    <div
                      key={q.id}
                      style={{
                        marginBottom: 16,
                        padding: 12,
                        border: '1px solid #dee2e6',
                        borderRadius: 4,
                        background: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>Question {qIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeQuizQuestion(qIndex)}
                          disabled={quizQuestions.length <= 1}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          title={quizQuestions.length <= 1 ? 'At least one question required' : 'Remove question'}
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuizQuestion(qIndex, { text: e.target.value })}
                        className="form-input"
                        placeholder="Question text"
                        style={{ marginBottom: 8, width: '100%' }}
                      />
                      <label style={{ display: 'block', marginBottom: 4 }}>Options (minimum 4 required)</label>
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => setQuizOptionText(qIndex, oIndex, e.target.value)}
                            className="form-input"
                            placeholder={`Option ${oIndex + 1}`}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => removeQuizOption(qIndex, oIndex)}
                            disabled={q.options.length <= 4}
                            title={q.options.length <= 4 ? 'At least 4 options required' : 'Remove option'}
                            style={{ padding: '4px 8px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addQuizOption(qIndex)}
                        style={{ marginBottom: 8, padding: '4px 8px', fontSize: 12 }}
                      >
                        + Add option
                      </button>
                      <label style={{ display: 'block', marginTop: 4, marginBottom: 4 }}>Correct option</label>
                      <select
                        value={q.correctIndex}
                        onChange={(e) => updateQuizQuestion(qIndex, { correctIndex: Number(e.target.value) })}
                        className="form-input"
                      >
                        {q.options.map((_, i) => (
                          <option key={i} value={i}>
                            Option {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label htmlFor={`lesson-order-${mod.id}`}>Order (optional)</label>
                <input id={`lesson-order-${mod.id}`} type="number" min={0} {...lessonForm.register('order')} className="form-input" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={lessonForm.formState.isSubmitting}>Create lesson</button>
                <button type="button" onClick={onCloseLessonForm}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
