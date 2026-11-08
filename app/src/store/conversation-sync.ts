import type {
  ApiConversationDetail,
  ApiConversationInput,
  ApiConversationMessage,
  ApiConversationSummary,
} from '@/lib/api';
import type { Conversation, Message } from './seed';

/*
 * Lógica pura de la sincronización de conversaciones (fase 2). El store guarda este estado junto
 * a las conversaciones y compara: lo que falta en el servidor se sube, lo borrado aquí se borra
 * allá. Como el servidor es idempotente por id, reintentar nunca duplica. Las respuestas en
 * camino viven en `pendingAnswers`, no en `messages`: nunca llegan aquí.
 */

export interface SyncedConversation {
  /** Ids de mensajes que el servidor ya confirmó. */
  messageIds: string[];
  /** Título, curso y alcance tal como los tiene el servidor (`metaKey`). */
  meta: string;
}

export interface ConversationSyncState {
  synced: Record<string, SyncedConversation>;
  /** Conversaciones borradas aquí, hasta que el servidor confirme. */
  deletedConversations: string[];
  /** Mensajes quitados aquí (editar o reintentar), hasta que el servidor confirme. */
  deletedMessages: Record<string, string[]>;
}

export function emptyConversationSync(): ConversationSyncState {
  return { synced: {}, deletedConversations: [], deletedMessages: {} };
}

/** Topes de `POST /v1/conversations/:id/messages` (100 mensajes; 1 MB de cuerpo). */
const MAX_BATCH_MESSAGES = 100;
const MAX_BATCH_CHARS = 300_000;
const MAX_TITLE = 200;
const MAX_MESSAGE_TEXT = 20_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const source = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => unknown } })
    .crypto;
  if (source?.getRandomValues) {
    source.getRandomValues(bytes);
    return bytes;
  }
  // Hermes no siempre trae `crypto`: estos ids identifican filas, no protegen nada.
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** UUID v4: el servidor lo exige para que crear y agregar sean idempotentes. */
export function newUuid(): string {
  const bytes = randomBytes();
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Conversaciones guardadas antes de la fase 2 tenían ids locales: se cambian una sola vez. */
export function withUuidIds(conversations: Conversation[]): Conversation[] {
  const valid = conversations.every((c) => isUuid(c.id) && c.messages.every((m) => isUuid(m.id)));
  if (valid) return conversations;
  return conversations.map((c) => ({
    ...c,
    id: isUuid(c.id) ? c.id : newUuid(),
    messages: c.messages.map((m) => (isUuid(m.id) ? m : { ...m, id: newUuid() })),
  }));
}

function scopeOf(conversation: Pick<Conversation, 'scopeDocIds'>): string[] | null {
  const scope = (conversation.scopeDocIds ?? []).filter(isUuid);
  return scope.length > 0 ? scope : null;
}

function clipTitle(value: string): string {
  return value.trim().slice(0, MAX_TITLE);
}

/** Lo que se manda al crear o renombrar, con los mismos límites que valida la API. */
export function conversationInput(conversation: Conversation): ApiConversationInput {
  return {
    title: clipTitle(conversation.title),
    course: clipTitle(conversation.course),
    scopeDocumentIds: scopeOf(conversation),
  };
}

export function metaKey(conversation: Conversation): string {
  const { title, course, scopeDocumentIds } = conversationInput(conversation);
  return JSON.stringify([title, course, scopeDocumentIds]);
}

export function toServerMessage(message: Message): ApiConversationMessage {
  const { id, role, kind, text, claims, sources, reason, unclear, errorCode, smallTalk, external } =
    message;
  return {
    id,
    role,
    kind,
    text: text.slice(0, MAX_MESSAGE_TEXT),
    payload: {
      ...(claims === undefined ? {} : { claims }),
      ...(sources === undefined ? {} : { sources }),
      ...(reason === undefined ? {} : { reason }),
      ...(unclear === undefined ? {} : { unclear }),
      ...(errorCode === undefined ? {} : { errorCode }),
      ...(smallTalk === undefined ? {} : { smallTalk }),
      ...(external === undefined ? {} : { external }),
    },
  };
}

export function fromServerMessage(message: ApiConversationMessage): Message {
  return {
    id: message.id,
    role: message.role,
    kind: message.kind,
    text: message.text,
    ...message.payload,
  };
}

/** Divide por cantidad y por tamaño: una respuesta con citas pesa mucho más que una pregunta. */
export function messageBatches(messages: readonly Message[]): Message[][] {
  const batches: Message[][] = [];
  let current: Message[] = [];
  let chars = 0;
  for (const message of messages) {
    const size = JSON.stringify(toServerMessage(message)).length;
    if (
      current.length >= MAX_BATCH_MESSAGES ||
      (current.length > 0 && chars + size > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(message);
    chars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Mensajes que el servidor aún no tiene. Una conversación vacía no se sube. */
export function unsentMessages(conversation: Conversation, sync: ConversationSyncState): Message[] {
  const sent = new Set(sync.synced[conversation.id]?.messageIds ?? []);
  return conversation.messages.filter((message) => !sent.has(message.id));
}

export function hasPendingWork(
  conversations: readonly Conversation[],
  sync: ConversationSyncState,
): boolean {
  return (
    sync.deletedConversations.length > 0 ||
    Object.keys(sync.deletedMessages).length > 0 ||
    conversations.some(
      (c) =>
        unsentMessages(c, sync).length > 0 ||
        (sync.synced[c.id] !== undefined && sync.synced[c.id]?.meta !== metaKey(c)),
    )
  );
}

/** Solo los ids ya confirmados necesitan borrarse allá; lo no subido simplemente no se sube. */
export function markMessagesRemoved(
  sync: ConversationSyncState,
  conversationId: string,
  removedIds: readonly string[],
): ConversationSyncState {
  const entry = sync.synced[conversationId];
  if (!entry || removedIds.length === 0) return sync;
  const removed = new Set(removedIds);
  const toDelete = entry.messageIds.filter((id) => removed.has(id));
  if (toDelete.length === 0) return sync;
  return {
    ...sync,
    synced: {
      ...sync.synced,
      [conversationId]: {
        ...entry,
        messageIds: entry.messageIds.filter((id) => !removed.has(id)),
      },
    },
    deletedMessages: {
      ...sync.deletedMessages,
      [conversationId]: [...(sync.deletedMessages[conversationId] ?? []), ...toDelete],
    },
  };
}

/** Siempre deja la marca: quizá hay una subida en vuelo que aún no se registró. */
export function markConversationRemoved(
  sync: ConversationSyncState,
  conversationId: string,
): ConversationSyncState {
  const { [conversationId]: _synced, ...synced } = sync.synced;
  const { [conversationId]: _messages, ...deletedMessages } = sync.deletedMessages;
  return {
    synced,
    deletedMessages,
    deletedConversations: sync.deletedConversations.includes(conversationId)
      ? sync.deletedConversations
      : [...sync.deletedConversations, conversationId],
  };
}

export function clearDeletedConversation(
  sync: ConversationSyncState,
  conversationId: string,
): ConversationSyncState {
  return {
    ...sync,
    deletedConversations: sync.deletedConversations.filter((id) => id !== conversationId),
  };
}

export function clearDeletedMessages(
  sync: ConversationSyncState,
  conversationId: string,
  ids: readonly string[],
): ConversationSyncState {
  const done = new Set(ids);
  const left = (sync.deletedMessages[conversationId] ?? []).filter((id) => !done.has(id));
  const { [conversationId]: _old, ...others } = sync.deletedMessages;
  return {
    ...sync,
    deletedMessages: left.length > 0 ? { ...others, [conversationId]: left } : others,
  };
}

/** El servidor ya tiene esta conversación con estos metadatos. */
export function recordCreated(
  sync: ConversationSyncState,
  conversationId: string,
  meta: string,
): ConversationSyncState {
  if (sync.deletedConversations.includes(conversationId)) return sync;
  const entry = sync.synced[conversationId];
  return {
    ...sync,
    synced: { ...sync.synced, [conversationId]: { messageIds: entry?.messageIds ?? [], meta } },
  };
}

/**
 * Registra un lote confirmado. Si mientras subía la persona quitó uno de esos mensajes
 * (editar), ese id pasa a borrarse en el servidor: de lo contrario volvería al sincronizar.
 */
export function recordUploaded(
  sync: ConversationSyncState,
  conversation: Conversation | undefined,
  conversationId: string,
  uploadedIds: readonly string[],
): ConversationSyncState {
  const entry = sync.synced[conversationId];
  if (!conversation || !entry) return sync;
  const present = new Set(conversation.messages.map((m) => m.id));
  const kept = uploadedIds.filter((id) => present.has(id));
  const gone = uploadedIds.filter((id) => !present.has(id));
  return {
    ...sync,
    synced: {
      ...sync.synced,
      [conversationId]: { ...entry, messageIds: [...new Set([...entry.messageIds, ...kept])] },
    },
    deletedMessages:
      gone.length === 0
        ? sync.deletedMessages
        : {
            ...sync.deletedMessages,
            [conversationId]: [...(sync.deletedMessages[conversationId] ?? []), ...gone],
          },
  };
}

export function recordMeta(
  sync: ConversationSyncState,
  conversationId: string,
  meta: string,
): ConversationSyncState {
  const entry = sync.synced[conversationId];
  if (!entry) return sync;
  return { ...sync, synced: { ...sync.synced, [conversationId]: { ...entry, meta } } };
}

/** Qué conversaciones del servidor hay que descargar enteras (nuevas o cambiadas en otro lado). */
export function conversationsToFetch(
  local: readonly Conversation[],
  sync: ConversationSyncState,
  summaries: readonly ApiConversationSummary[],
): string[] {
  const byId = new Map(local.map((c) => [c.id, c]));
  return summaries
    .filter((summary) => {
      if (sync.deletedConversations.includes(summary.id)) return false;
      const mine = byId.get(summary.id);
      if (!mine) return summary.messageCount > 0;
      const entry = sync.synced[summary.id];
      return (
        !entry ||
        summary.messageCount !== entry.messageIds.length ||
        Date.parse(summary.updatedAt) > mine.updatedAt
      );
    })
    .map((summary) => summary.id);
}

function fromServer(detail: ApiConversationDetail): Conversation {
  return {
    id: detail.id,
    title: detail.title,
    course: detail.course,
    updatedAt: Date.parse(detail.updatedAt),
    messages: detail.messages.map(fromServerMessage),
    ...(detail.scopeDocumentIds && detail.scopeDocumentIds.length > 0
      ? { scopeDocIds: detail.scopeDocumentIds }
      : {}),
  };
}

function mergeOne(
  mine: Conversation,
  detail: ApiConversationDetail,
  sync: ConversationSyncState,
): Conversation {
  const known = new Set(sync.synced[mine.id]?.messageIds ?? []);
  const removed = new Set(sync.deletedMessages[mine.id] ?? []);
  const localById = new Map(mine.messages.map((m) => [m.id, m]));
  const onServer = new Set(detail.messages.map((m) => m.id));
  const fromTheServer = detail.messages
    .filter((m) => !removed.has(m.id))
    .map((m) => localById.get(m.id) ?? fromServerMessage(m));
  // Sin confirmar = escrito aquí y aún sin subir. Confirmado y ausente = se quitó en otro equipo.
  const localOnly = mine.messages.filter(
    (m) => !onServer.has(m.id) && !known.has(m.id) && !removed.has(m.id),
  );
  const server = fromServer(detail);
  const serverIsNewer = server.updatedAt >= mine.updatedAt;
  const useServerMeta = serverIsNewer && server.title !== '';
  const { scopeDocIds: _scope, ...withoutScope } = mine;
  const base: Conversation = useServerMeta ? withoutScope : mine;
  return {
    ...base,
    ...(useServerMeta
      ? {
          title: server.title,
          course: server.course,
          ...(server.scopeDocIds ? { scopeDocIds: server.scopeDocIds } : {}),
        }
      : {}),
    updatedAt: Math.max(server.updatedAt, mine.updatedAt),
    messages: [...fromTheServer, ...localOnly],
  };
}

export interface MergeResult {
  conversations: Conversation[];
  sync: ConversationSyncState;
  changed: boolean;
}

/**
 * Une lo del servidor con lo local. `listComplete` indica que se leyó toda la lista: solo
 * entonces lo ya confirmado que falta allá cuenta como borrado en otro dispositivo (borrar gana).
 */
export function mergeConversations(
  local: readonly Conversation[],
  sync: ConversationSyncState,
  summaries: readonly ApiConversationSummary[],
  details: readonly ApiConversationDetail[],
  listComplete: boolean,
): MergeResult {
  const onServer = new Set(summaries.map((s) => s.id));
  const goneElsewhere = (id: string) =>
    listComplete && sync.synced[id] !== undefined && !onServer.has(id);
  const kept = local.filter((c) => !goneElsewhere(c.id));
  let changed = kept.length !== local.length;

  const synced = { ...sync.synced };
  for (const id of Object.keys(synced)) {
    if (goneElsewhere(id)) delete synced[id];
  }

  const conversations = [...kept];
  for (const detail of details) {
    if (sync.deletedConversations.includes(detail.id)) continue;
    const index = conversations.findIndex((c) => c.id === detail.id);
    const mine = conversations[index];
    if (mine) conversations[index] = mergeOne(mine, detail, sync);
    else conversations.push(fromServer(detail));
    const removed = new Set(sync.deletedMessages[detail.id] ?? []);
    synced[detail.id] = {
      messageIds: detail.messages.map((m) => m.id).filter((id) => !removed.has(id)),
      meta: metaKey(fromServer(detail)),
    };
    changed = true;
  }
  return {
    conversations,
    sync: { ...sync, synced },
    changed: changed || Object.keys(synced).length !== Object.keys(sync.synced).length,
  };
}
