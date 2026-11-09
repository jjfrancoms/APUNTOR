import { describe, expect, it } from 'vitest';
import {
  conversationsToFetch,
  emptyConversationSync,
  fromServerMessage,
  isUuid,
  markConversationRemoved,
  markMessagesRemoved,
  mergeConversations,
  messageBatches,
  metaKey,
  newUuid,
  recordCreated,
  recordUploaded,
  toServerMessage,
  unsentMessages,
  withUuidIds,
} from '../src/store/conversation-sync';
import type { Conversation, Message } from '../src/store/seed';
import type { ApiConversationDetail } from '../src/lib/api';

const C1 = '11111111-1111-4111-8111-111111111111';
const M1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const M2 = 'aaaaaaaa-2222-4222-8222-222222222222';
const M3 = 'aaaaaaaa-3333-4333-8333-333333333333';

const message = (id: string, text = 'hola'): Message => ({ id, role: 'user', kind: 'text', text });
const conversation = (messages: Message[], updatedAt = 1000): Conversation => ({
  id: C1,
  title: 'Título',
  course: '',
  updatedAt,
  messages,
});
const detail = (ids: string[], updatedAt = 2000): ApiConversationDetail => ({
  id: C1,
  title: 'Título',
  course: '',
  scopeDocumentIds: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(updatedAt).toISOString(),
  messageCount: ids.length,
  messages: ids.map((id) => ({ id, role: 'user', kind: 'text', text: 'hola', payload: {} })),
});
const syncedWith = (ids: string[]) => ({
  ...emptyConversationSync(),
  synced: { [C1]: { messageIds: ids, meta: metaKey(conversation([])) } },
});

describe('ids', () => {
  it('genera UUID v4 válidos y distintos', () => {
    const ids = new Set(Array.from({ length: 50 }, newUuid));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isUuid(id)).toBe(true);
  });

  it('cambia los ids locales antiguos y deja intactos los ya válidos', () => {
    const [changed] = withUuidIds([
      { ...conversation([message('m-1'), message(M2)]), id: 'conv-1' },
    ]);
    expect(isUuid(changed?.id ?? '')).toBe(true);
    expect(isUuid(changed?.messages[0]?.id ?? '')).toBe(true);
    expect(changed?.messages[1]?.id).toBe(M2);
    const valid = [conversation([message(M1)])];
    expect(withUuidIds(valid)).toBe(valid);
  });
});

describe('mensajes', () => {
  it('conserva los datos estructurados al ir y volver', () => {
    const answer: Message = {
      id: M1,
      role: 'mascot',
      kind: 'answer',
      text: 'respuesta',
      claims: [{ text: 'idea', pages: [{ documentId: 'd', page: 2 }] }],
      sources: [{ page: 2, klass: 1, documentId: 'd' }],
    };
    expect(fromServerMessage(toServerMessage(answer))).toEqual(answer);
    const failed: Message = {
      id: M2,
      role: 'mascot',
      kind: 'error',
      text: '',
      errorCode: 'TIMEOUT',
    };
    expect(fromServerMessage(toServerMessage(failed))).toEqual(failed);
  });

  it('parte en lotes por cantidad y por tamaño', () => {
    const many = Array.from({ length: 250 }, () => message(newUuid(), 'a'));
    expect(messageBatches(many).map((b) => b.length)).toEqual([100, 100, 50]);
    const heavy = Array.from({ length: 40 }, () => message(newUuid(), 'x'.repeat(20_000)));
    const batches = messageBatches(heavy);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(JSON.stringify(batch.map(toServerMessage)).length).toBeLessThanOrEqual(300_000);
    }
  });

  it('solo se sube lo que el servidor no confirmó', () => {
    const conv = conversation([message(M1), message(M2)]);
    expect(unsentMessages(conv, syncedWith([M1])).map((m) => m.id)).toEqual([M2]);
  });
});

describe('borrados', () => {
  it('borrar un mensaje nunca subido no genera trabajo en el servidor', () => {
    const sync = syncedWith([M1]);
    expect(markMessagesRemoved(sync, C1, [M2])).toBe(sync);
    expect(markMessagesRemoved(sync, C1, [M1]).deletedMessages[C1]).toEqual([M1]);
  });

  it('un mensaje quitado mientras subía queda marcado para borrarse', () => {
    const sync = recordCreated(emptyConversationSync(), C1, 'meta');
    const next = recordUploaded(sync, conversation([message(M1)]), C1, [M1, M2]);
    expect(next.synced[C1]?.messageIds).toEqual([M1]);
    expect(next.deletedMessages[C1]).toEqual([M2]);
  });

  it('no registra subidas de una conversación ya borrada', () => {
    const sync = markConversationRemoved(syncedWith([M1]), C1);
    expect(recordCreated(sync, C1, 'meta')).toBe(sync);
  });
});

describe('unión con el servidor', () => {
  it('agrega lo nuevo del servidor y conserva lo que falta por subir', () => {
    const local = [conversation([message(M1), message(M3, 'sin subir')])];
    const { conversations, sync } = mergeConversations(
      local,
      syncedWith([M1]),
      [detail([M1, M2])],
      [detail([M1, M2])],
      true,
    );
    expect(conversations[0]?.messages.map((m) => m.id)).toEqual([M1, M2, M3]);
    expect(sync.synced[C1]?.messageIds).toEqual([M1, M2]);
  });

  it('lo confirmado que falta allá se quitó en otro dispositivo', () => {
    const { conversations } = mergeConversations(
      [conversation([message(M1), message(M2)])],
      syncedWith([M1, M2]),
      [detail([M1])],
      [detail([M1])],
      true,
    );
    expect(conversations[0]?.messages.map((m) => m.id)).toEqual([M1]);
  });

  it('un mensaje borrado aquí no vuelve mientras se confirma', () => {
    const sync = { ...syncedWith([M2]), deletedMessages: { [C1]: [M1] } };
    const { conversations } = mergeConversations(
      [conversation([message(M2)])],
      sync,
      [detail([M1, M2])],
      [detail([M1, M2])],
      true,
    );
    expect(conversations[0]?.messages.map((m) => m.id)).toEqual([M2]);
  });

  it('una conversación borrada en otro dispositivo se quita solo con la lista completa', () => {
    const local = [conversation([message(M1)])];
    expect(mergeConversations(local, syncedWith([M1]), [], [], true).conversations).toEqual([]);
    expect(mergeConversations(local, syncedWith([M1]), [], [], false).conversations).toEqual(local);
  });

  it('nunca toca lo que solo existe aquí', () => {
    const local = [conversation([message(M1)])];
    expect(mergeConversations(local, emptyConversationSync(), [], [], true).conversations).toEqual(
      local,
    );
  });

  it('solo descarga lo nuevo o cambiado, y nunca lo borrado aquí', () => {
    const local = [conversation([message(M1)], 5000)];
    const same = detail([M1], 5000);
    expect(conversationsToFetch(local, syncedWith([M1]), [same])).toEqual([]);
    expect(conversationsToFetch(local, syncedWith([M1]), [detail([M1, M2], 6000)])).toEqual([C1]);
    expect(conversationsToFetch([], emptyConversationSync(), [same])).toEqual([C1]);
    expect(
      conversationsToFetch([], markConversationRemoved(emptyConversationSync(), C1), [same]),
    ).toEqual([]);
  });
});
