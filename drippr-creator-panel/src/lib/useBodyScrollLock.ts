import { useEffect } from "react";

/**
 * Locks page-level scrolling while a dashboard shell is mounted.
 *
 * The dashboard layouts own their scroll regions (sidebar nav + main
 * content), so the document itself must not scroll — otherwise you get
 * two competing scrollbars.
 *
 * Auth pages deliberately do NOT use this: they need normal page scroll
 * so the mobile keyboard can push content up and keep the submit button
 * reachable.
 */
export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add("app-shell-locked");
    return () => {
      document.body.classList.remove("app-shell-locked");
    };
  }, [enabled]);
}

/**
 * Keeps the focused input visible when the on-screen keyboard opens.
 *
 * Mobile browsers shrink the visual viewport rather than the layout
 * viewport, so a field near the bottom of a form can end up hidden behind
 * the keyboard. This scrolls it back into view once the keyboard has
 * finished animating.
 */
export function useKeyboardAwareScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    function handleFocus(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      window.clearTimeout(timer);
      // Wait for the keyboard animation before measuring
      timer = window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 320);
    }

    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      window.clearTimeout(timer);
    };
  }, [enabled]);
}

export default useBodyScrollLock;
