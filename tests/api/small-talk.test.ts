import { describe, expect, it } from 'vitest';
import { answerQuestion } from '../../api/src/rag/answer';
import { detectSmallTalk } from '../../api/src/rag/small-talk';
import { fakeEmbedder, fakeGenerator, fakeQuota, VALID_ANSWER } from './helpers';

describe('saludos y cortesías', () => {
  it.each([
    ['HOLA', 'greeting'],
    ['Hola Illari!', 'greeting'],
    ['hola, ¿qué tal?', 'greeting'],
    ['buenas tardes', 'greeting'],
    ['Gracias!', 'thanks'],
    ['ok gracias', 'thanks'],
    ['¿Quién eres?', 'identity'],
    ['chao', 'farewell'],
  ])('reconoce "%s"', (question, kind) => {
    expect(detectSmallTalk(question)).toBe(kind);
  });

  it.each([
    'hola, ¿qué es una tautología?',
    'tablas de verdad',
    'buenos ejemplos de tautología',
    'gracias a qué ley se simplifica',
  ])('una pregunta real no es saludo: "%s"', (question) => {
    expect(detectSmallTalk(question)).toBeNull();
  });

  it('se responde sin buscar, sin IA y sin gastar la cuota', async () => {
    const quota = fakeQuota();
    let searched = false;
    const result = await answerQuestion(
      {
        embedder: fakeEmbedder,
        search: () => {
          searched = true;
          return Promise.resolve([]);
        },
        generator: fakeGenerator(VALID_ANSWER),
        quota,
      },
      { userId: '11111111-1111-4111-8111-111111111111', question: 'Hola' },
    );
    expect(result).toEqual({ status: 'small_talk', kind: 'greeting' });
    expect(searched).toBe(false);
    expect(quota.used).toBe(0);
  });
});
