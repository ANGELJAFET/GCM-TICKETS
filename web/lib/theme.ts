const STORAGE_KEY = 'gcm_dark';

// Script inyectado inline en <head> (ver app/layout.tsx) para fijar
// data-theme antes del primer paint y evitar el flash de tema claro (FOUC),
// igual que el <script> inline que hoy tienen admin.html/usuario.html.
export const NO_FOUC_SCRIPT = `
try {
  var d = localStorage.getItem('${STORAGE_KEY}') === '1';
  if (d) document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) {}
`;

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function setDarkMode(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // localStorage no disponible (modo privado, etc.) — el toggle igual
    // funciona para la sesión actual, solo no persiste.
  }
}

export function toggleDarkMode(): boolean {
  const next = !isDarkMode();
  setDarkMode(next);
  return next;
}
