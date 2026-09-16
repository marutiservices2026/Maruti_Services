// domFocus.js — shared by keyboard-shortcut guards (useSpaceShortcut, DashboardLayout's
// Backspace-to-go-back) to check whether the currently focused element should swallow a
// key press instead of letting a global shortcut act on it.
export function isInteractive(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName);
}
