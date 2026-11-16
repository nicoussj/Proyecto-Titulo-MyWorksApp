import { expect, test } from '@playwright/test';

/**
 * Recorrido de lectura contra lo que está publicado.
 * No crea cuentas, pedidos ni cobros.
 * LIVE_WEB=1 abre https://myworksapp-cl.vercel.app
 * LIVE_DESKTOP=1 abre el preview del hub en 4174, ya compilado contra el proyecto vivo.
 */
const WEB = 'https://myworksapp-cl.vercel.app';
const liveWeb = process.env.LIVE_WEB === '1';
const liveDesktop = process.env.LIVE_DESKTOP === '1';

test.describe('web pública en vivo', () => {
  test.skip(!liveWeb, 'requiere LIVE_WEB=1');

  test('la portada publicada carga y no pide la tarjeta', async ({ page }) => {
    const response = await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText('My Works App').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="cc-csc"]')).toHaveCount(0);
  });

  test('elegir plomería consulta el catálogo vivo y no pide la tarjeta', async ({ page }) => {
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    const catalogo = page.waitForResponse(
      (res) => res.url().includes('listar_profesionales_catalogo') && res.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: /Plomería/ }).first().click();
    const respuesta = await catalogo;
    expect(respuesta.ok()).toBeTruthy();
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="cc-csc"]')).toHaveCount(0);
  });
});

test.describe('consola de escritorio contra el proyecto vivo', () => {
  test.skip(!liveDesktop, 'requiere LIVE_DESKTOP=1 y el preview en 4174');

  test('un correo que no existe llega a Auth y no entra a la consola', async ({ page }) => {
    const auth = page.waitForResponse(
      (res) => res.url().includes('supabase.co/auth/v1/token') && res.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Consola operativa' })).toBeVisible();
    await page.getByLabel('CORREO ELECTRÓNICO').fill('live-check-no-existe@example.com');
    await page.getByRole('textbox', { name: 'CONTRASEÑA' }).fill('NoExiste2026x');
    await page.getByRole('button', { name: 'Entrar' }).click();
    const token = await auth;
    expect(token.status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(/correo o contraseña incorrectos|no se pudo iniciar sesión/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consola operativa' })).toBeVisible();
  });
});
