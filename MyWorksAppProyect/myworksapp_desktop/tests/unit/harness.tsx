import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../src/context/auth-store';
import { ToastProvider } from '../../src/ui/toast';

export function perfil(role = 'administrador') {
  return { id: '11111111-1111-1111-1111-111111111111', name: 'Admin de prueba', email: 'admin.consola@local.test', role } as never;
}

export function auth(over: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    profile: perfil(),
    loading: false,
    needsMfa: false,
    mustSetPassword: false,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    completeMfa: vi.fn(async () => {}),
    finishPasswordSetup: vi.fn(async () => {}),
    ...over,
  };
}

export function montar(ui: ReactNode, value: AuthContextValue = auth()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const out = render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={value}>
        <ToastProvider>{ui}</ToastProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...out, qc };
}
