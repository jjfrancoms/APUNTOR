import { flashcards, quizQuestions } from '@/data/mock';
import type { ApiReviewItem, ApiStudyItem, ApiStudySet, StudyKind } from './api';

/** Datos de ejemplo del estudio, solo para la vista previa (EXPO_PUBLIC_PREVIEW=1). */

const DOCUMENT = 'demo-doc';

function citation(page: number) {
  return { chunkId: `chunk-${page}`, documentId: DOCUMENT, pageNumber: page, quote: '' };
}

export function previewItems(kind: StudyKind): ApiStudyItem[] {
  if (kind === 'quiz') {
    return quizQuestions.map((q) => ({
      id: q.id,
      kind: 'quiz' as const,
      citation: citation(q.page),
      question: q.prompt,
      options: q.options,
      correctIndex: q.answer,
      explanation: q.explanation,
    }));
  }
  return flashcards.map((f) => ({
    id: f.id,
    kind: 'cards' as const,
    citation: citation(f.page),
    front: f.front,
    back: f.back,
  }));
}

export function previewSet(kind: StudyKind): { set: ApiStudySet; items: ApiStudyItem[] } {
  const items = previewItems(kind);
  return {
    set: {
      id: `demo-${kind}`,
      documentId: DOCUMENT,
      documentTitle: 'Cálculo I · Clase 3',
      topicId: null,
      topicTitle: 'Límites laterales',
      kind,
      itemCount: items.length,
      lastScore: null,
      lastTotal: null,
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    items,
  };
}

export function previewReview(): ApiReviewItem[] {
  return previewItems('cards').map((item, i) => ({
    ...item,
    setId: 'demo-cards',
    documentTitle: 'Cálculo I · Clase 3',
    courseId: i % 2 === 0 ? 'c1' : 'c2',
    courseTitle: i % 2 === 0 ? 'Cálculo I' : 'Física II',
    box: 0,
    dueDate: '2026-11-08',
  }));
}
