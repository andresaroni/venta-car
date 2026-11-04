// Utilidades del panel (lado cliente)

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2,
  }).format(n || 0);

export const parseMoney = (v: string | null | undefined) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url.startsWith('/api/admin/')) {
    window.location.href = '/admin';
  }
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error. Intenta de nuevo.');
  return data as T;
}

let toastTimer: number | undefined;
export function toast(message: string, type: 'ok' | 'error' = 'ok') {
  let el = document.querySelector<HTMLElement>('.a-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'a-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 3200);
}

/** Muestra un mensaje tras recargar la página. */
export function reloadWith(message: string) {
  try {
    sessionStorage.setItem('admin-toast', message);
  } catch {}
  window.location.reload();
}

export function flushToast() {
  try {
    const msg = sessionStorage.getItem('admin-toast');
    if (msg) {
      sessionStorage.removeItem('admin-toast');
      toast(msg);
    }
  } catch {}
}

export function showError(el: HTMLElement | null, message: string) {
  if (!el) return toast(message, 'error');
  el.textContent = message;
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Diálogo de confirmación reutilizable (usa el <dialog id="confirm-dialog"> del layout). */
export function confirmAction(opts: { title: string; message: string; confirm?: string }): Promise<boolean> {
  const dlg = document.getElementById('confirm-dialog') as HTMLDialogElement | null;
  if (!dlg) return Promise.resolve(window.confirm(opts.message));
  dlg.querySelector('[data-confirm-title]')!.textContent = opts.title;
  dlg.querySelector('[data-confirm-message]')!.textContent = opts.message;
  const ok = dlg.querySelector<HTMLButtonElement>('[data-confirm-ok]')!;
  ok.textContent = opts.confirm ?? 'Eliminar';
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      dlg.removeEventListener('close', onClose);
      ok.removeEventListener('click', onOk);
      resolve(v);
    };
    const onOk = () => {
      done(true);
      dlg.close();
    };
    const onClose = () => done(false);
    ok.addEventListener('click', onOk);
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

/** Cierra los <dialog> al hacer clic en el fondo y con [data-close]. */
export function wireDialogs() {
  document.querySelectorAll<HTMLDialogElement>('dialog.a-modal').forEach((dlg) => {
    // Los formularios largos (data-static) no se cierran al tocar el fondo para no perder datos
    if (!dlg.hasAttribute('data-static')) {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close();
      });
    }
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  });
}
