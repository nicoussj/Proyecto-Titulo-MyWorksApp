import { vi } from 'vitest';

/** Una llamada encadenada a Supabase: tabla + métodos con sus argumentos. */
export type FakeQuery = { table: string; ops: Array<[string, unknown[]]> };
export type FakeResult = { data?: unknown; error?: { message: string } | null; count?: number };

/**
 * Cliente falso: cada `from(tabla)` devuelve un builder encadenable y
 * «thenable». Al esperar, `responder` decide la respuesta según la consulta.
 */
export function createFakeSupabase() {
  const state = {
    responder: (_q: FakeQuery): FakeResult | Promise<FakeResult> => ({ data: [], error: null }),
    rpc: (_fn: string, _args: unknown): FakeResult | Promise<FakeResult> => ({ data: null, error: null }),
    invoke: (_fn: string, _args: unknown): FakeResult | Promise<FakeResult> => ({ data: null, error: null }),
    queries: [] as FakeQuery[],
    session: null as null | { user: { id: string; email?: string }; access_token?: string },
    authListeners: [] as Array<(event: string, session: unknown) => void>,
  };

  const builder = (query: FakeQuery): unknown =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => state.responder(query))
                .then((r) => ({ error: null, ...r }))
                .then(ok, ko);
          }
          return (...args: unknown[]) => {
            query.ops.push([String(prop), args]);
            return builder(query);
          };
        },
      },
    );

  const channel = () => {
    const ch: Record<string, unknown> = {};
    ch.on = () => ch;
    ch.subscribe = (cb?: (s: string) => void) => {
      cb?.('SUBSCRIBED');
      return ch;
    };
    ch.unsubscribe = vi.fn(async () => 'ok');
    ch.send = vi.fn(async () => 'ok');
    return ch;
  };

  const client = {
    from: (table: string) => {
      const q: FakeQuery = { table, ops: [] };
      state.queries.push(q);
      return builder(q);
    },
    rpc: (fn: string, args?: unknown) => {
      const q: FakeQuery = { table: `rpc:${fn}`, ops: [['rpc', [args]]] };
      state.queries.push(q);
      const run = Promise.resolve().then(() => state.rpc(fn, args)).then((r) => ({ error: null, ...r }));
      const b = builder(q) as Record<string, unknown>;
      return new Proxy(b, {
        get(t, prop) {
          if (prop === 'then') return run.then.bind(run);
          return (t as Record<string | symbol, unknown>)[prop];
        },
      });
    },
    functions: {
      invoke: vi.fn(async (fn: string, args: unknown) => ({ error: null, ...(await state.invoke(fn, args)) })),
    },
    channel: vi.fn(channel),
    removeChannel: vi.fn(async () => 'ok'),
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ data: { path: 'x' }, error: null })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://example.test/f' }, error: null })),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/f' } }),
      }),
    },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: state.session?.user ?? null }, error: null })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        state.authListeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: { user: { id: 'u-nuevo', identities: [{}] }, session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      exchangeCodeForSession: vi.fn(async (_code: string) => ({ data: {}, error: null as null | { message: string } })),
      setSession: vi.fn(async (_s: unknown) => ({ data: {}, error: null as null | { message: string } })),
    },
  };
  return { client, state };
}
