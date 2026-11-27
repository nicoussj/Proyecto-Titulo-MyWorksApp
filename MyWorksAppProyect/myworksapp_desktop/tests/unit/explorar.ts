import { act, fireEvent } from '@testing-library/react';

const espera = (ms = 15) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

const esPestana = (el: Element) => el.getAttribute('role') === 'tab' || Boolean(el.closest('.tabs, [role="tablist"], .segmented'));

const peso = (el: Element) => (esPestana(el) ? 1 : 0) + (/^(Cancelar|Cerrar|Volver)$/.test(el.textContent?.trim() ?? '') ? 2 : 0);

/** Escribe en cada campo visible un valor válido para los formularios de la consola. */
export async function llenarCampos(root: ParentNode = document) {
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))) {
    if (el.disabled) continue;
    if (el instanceof HTMLSelectElement) {
      const opt = el.options[el.options.length - 1];
      if (opt) fireEvent.change(el, { target: { value: opt.value } });
      continue;
    }
    const type = (el as HTMLInputElement).type;
    if (type === 'checkbox' || type === 'radio') { fireEvent.click(el); continue; }
    const frase = el.closest('label')?.textContent?.match(/Escribe (\S+) para confirmar/)?.[1];
    if (frase) { fireEvent.change(el, { target: { value: frase } }); continue; }
    const value = type === 'number' ? '5' : type === 'email' ? 'soporte@local.test' : type === 'password' ? 'Clave12345' : el.inputMode === 'numeric' ? '123456' : 'motivo de prueba suficiente';
    fireEvent.change(el, { target: { value } });
  }
}

/**
 * Recorre la pantalla como un operador: pulsa cada botón una vez, completa
 * los diálogos con un motivo y confirma. Devuelve las etiquetas pulsadas.
 */
export async function explorar(max = 60, omitir: RegExp = /Cerrar sesión|Salir/) {
  const vistos = new Set<string>();
  const pulsados: string[] = [];
  await espera(200);
  for (let i = 0; i < max; i += 1) {
    await espera();
    const dialogos = Array.from(document.querySelectorAll('[role="dialog"]'));
    const ctx = dialogos.length ? `${dialogos.at(-1)?.querySelector('h2')?.textContent}#${i}` : 'main';
    const zonas = dialogos.length ? dialogos.slice(-1) : [document.querySelector('main') ?? document.body];
    const botones = zonas.flatMap((z) => Array.from(z.querySelectorAll<HTMLElement>('button, [role="tab"], [role="button"], tr[tabindex]')))
      .filter((b) => !(b as HTMLButtonElement).disabled && b.getAttribute('aria-disabled') !== 'true')
      .sort((a, b) => peso(a) - peso(b));
    const siguiente = botones.find((b, idx) => {
      const key = `${ctx}|${b.textContent?.trim()}|${b.getAttribute('aria-label') ?? ''}|${idx}`;
      return !vistos.has(key) && !omitir.test(b.textContent ?? '') && !omitir.test(b.getAttribute('aria-label') ?? '');
    });
    if (!siguiente) break;
    const idx = botones.indexOf(siguiente);
    vistos.add(`${ctx}|${siguiente.textContent?.trim()}|${siguiente.getAttribute('aria-label') ?? ''}|${idx}`);
    pulsados.push(siguiente.textContent?.trim() || siguiente.getAttribute('aria-label') || '?');
    await act(async () => { fireEvent.click(siguiente); });
    await espera();
    const dialogo = document.querySelector('[role="dialog"], [role="alertdialog"], dialog[open]');
    if (dialogo) await llenarCampos(dialogo);
  }
  return pulsados;
}
