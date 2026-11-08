import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createConversationsRepository,
  type ConversationsRepository,
} from '../../api/src/conversations';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';

const ROOT = join(__dirname, '..', '..', 'db');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const conv = (n: number) => `cccccccc-0000-4000-8000-00000000000${n}`;
const msg = (n: number) => `dddddddd-0000-4000-8000-00000000000${n}`;

let pg: PGlite;
let repository: ConversationsRepository;

function text(id: string, value: string) {
  return { id, role: 'user', kind: 'text', text: value, payload: {} } as const;
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pg.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
  }
  repository = createConversationsRepository(drizzle(pg, { schema }) as unknown as Database);
}, 60_000);

const base = { title: 'T', course: '', scopeDocumentIds: null, updatedAt: null };

describe('conversaciones (SQL real)', () => {
  it('crea idempotente y no entrega ni toca la de otro usuario', async () => {
    const created = await repository.create(USER, { ...base, id: conv(1) });
    expect(created).toMatchObject({ id: conv(1), title: 'T', messageCount: 0 });
    const again = await repository.create(USER, { ...base, id: conv(1), title: 'Otro' });
    expect(again?.title).toBe('T');
    expect(await repository.create(OTHER, { ...base, id: conv(1), title: 'X' })).toBeNull();
    expect(await repository.appendMessages(OTHER, conv(1), [text(msg(9), 'x')], null)).toBeNull();
    expect(await repository.deleteMessages(OTHER, conv(1), [msg(9)])).toBeNull();
    expect(await repository.update(OTHER, conv(1), { title: 'X' })).toBeNull();
    await repository.delete(OTHER, conv(1));
    expect((await repository.get(USER, conv(1)))?.title).toBe('T');
  });

  it('conserva el orden de llegada y no duplica al reenviar un lote', async () => {
    await repository.appendMessages(USER, conv(1), [text(msg(1), 'a'), text(msg(2), 'b')], null);
    await repository.appendMessages(USER, conv(1), [text(msg(2), 'b'), text(msg(3), 'c')], null);
    const detail = await repository.get(USER, conv(1));
    expect(detail?.messages.map((m) => m.text)).toEqual(['a', 'b', 'c']);
    expect(detail?.messageCount).toBe(3);
  });

  it('quita solo los mensajes indicados y mueve la fecha', async () => {
    const before = await repository.get(USER, conv(1));
    const after = await repository.deleteMessages(USER, conv(1), [msg(3)]);
    expect(after?.messageCount).toBe(2);
    expect(after && before && after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('una fecha del cliente nunca queda en el futuro y conserva la de lo importado', async () => {
    const future = new Date(Date.now() + 86_400_000);
    const created = await repository.create(USER, { ...base, id: conv(2), updatedAt: future });
    expect(created && created.updatedAt.getTime() <= Date.now()).toBe(true);

    const old = new Date('2026-01-15T12:00:00.000Z');
    await repository.create(USER, { ...base, id: conv(3), updatedAt: old });
    const appended = await repository.appendMessages(USER, conv(3), [text(msg(1), 'x')], old);
    expect(appended?.updatedAt.toISOString()).toBe(old.toISOString());
    expect(appended?.createdAt.toISOString()).toBe(old.toISOString());
  });

  it('lista solo las propias, de la más reciente a la más antigua', async () => {
    await repository.create(OTHER, { ...base, id: conv(4) });
    const rows = await repository.list(USER, { limit: 10, offset: 0 });
    expect(rows.map((r) => r.id)).not.toContain(conv(4));
    expect(rows).toHaveLength(3);
    expect(rows.at(-1)?.id).toBe(conv(3));
  });

  it('borrar la conversación se lleva sus mensajes', async () => {
    await repository.delete(USER, conv(1));
    expect(await repository.get(USER, conv(1))).toBeNull();
    const { rows } = await pg.query(
      'SELECT 1 FROM conversation_messages WHERE conversation_id = $1',
      [conv(1)],
    );
    expect(rows).toEqual([]);
  });
});
