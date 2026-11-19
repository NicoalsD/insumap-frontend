import { useLayoutEffect, type RefObject } from 'react';

function isOpen(element: HTMLElement): boolean {
  try {
    return element.matches(':popover-open');
  } catch {
    return false;
  }
}

/**
 * Inline navigation when the header row fits, a native popover menu when it does not. The row is
 * measured in its inline layout (no hard-coded breakpoint), so longer labels or larger text move
 * the switch on their own. While collapsed it only re-measures when the header grows, to avoid
 * layout thrash on every shrink.
 */
export function useResponsiveNav(
  headerRef: RefObject<HTMLElement | null>,
  rowRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const header = headerRef.current;
    const row = rowRef.current;
    const menu = menuRef.current;
    if (!header || !row || !menu || typeof ResizeObserver === 'undefined') return;
    let wide = false;
    let lastWidth = 0;

    const measure = () => {
      const width = row.clientWidth;
      if (!wide && width <= lastWidth) {
        lastWidth = width;
        return;
      }
      lastWidth = width;
      const wasOpen = isOpen(menu);
      header.classList.add('is-measuring', 'is-wide');
      // A closed popover is display: none; drop the attribute to measure the inline row.
      menu.removeAttribute('popover');
      const fits = row.scrollWidth <= row.clientWidth;
      header.classList.toggle('is-wide', fits);
      if (!fits) {
        menu.setAttribute('popover', 'auto');
        if (wasOpen) {
          try {
            menu.showPopover();
          } catch {
            // Popover API unavailable: the list stays in the page flow.
          }
        }
      }
      wide = fits;
      requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(menu);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [headerRef, rowRef, menuRef]);
}
