// useSpaceShortcut.js — fires `onTrigger` when Space is pressed with nothing
// interactive focused. Space is heavily overloaded natively (scrolls the page,
// activates a focused button, types a literal space in any text field), so this only
// fires when document.activeElement isn't an input/textarea/select/button/link.
// Used by the list pages to open their "new entry" modal — kept local to each page
// (rather than centralized in DashboardLayout, like Alt+1..8) because only the page
// itself owns the modal state that needs to open.
import { useEffect } from 'react';
import { isInteractive } from '../utils/domFocus.js';

export function useSpaceShortcut(onTrigger, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(e) {
      if (e.code === 'Space' && !e.altKey && !e.ctrlKey && !e.metaKey && !isInteractive(document.activeElement)) {
        e.preventDefault();
        onTrigger();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTrigger, enabled]);
}
