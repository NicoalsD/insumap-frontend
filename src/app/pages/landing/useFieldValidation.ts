import { useEffect, useRef, useState } from 'react';

const ANNOUNCE_DELAY_MS = 500;

function userInvalid(field: HTMLInputElement): boolean {
  try {
    return field.matches(':user-invalid');
  } catch {
    return !field.validity.valid;
  }
}

/** Lists the field's error (its `data-error` id) in aria-describedby only while it is shown. */
function linkError(field: HTMLInputElement, shown: boolean): void {
  const errorId = field.dataset.error;
  if (!errorId) return;
  const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length > 0) field.setAttribute('aria-describedby', ids.join(' '));
  else field.removeAttribute('aria-describedby');
}

/**
 * Keeps `aria-invalid` and the error description in step with the visual `:user-invalid` state,
 * so a field is never announced as invalid before the person has used it. An error that appears
 * when leaving a field is announced once through a polite live region; after a failed submit the
 * browser moves focus to the first invalid field, which reads its error.
 */
export function useFieldValidation() {
  const formRef = useRef<HTMLFormElement>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const flagged = new WeakSet<HTMLInputElement>();
    const announced = new WeakSet<HTMLInputElement>();
    let timer: number | undefined;

    const announce = (field: HTMLInputElement) => {
      const error = field.dataset.error ? document.getElementById(field.dataset.error) : null;
      if (!error) return;
      const label = field.labels?.[0]?.textContent.trim() ?? '';
      window.clearTimeout(timer);
      setAnnouncement('');
      timer = window.setTimeout(() => {
        setAnnouncement(`${label}: ${error.textContent.trim()}`);
      }, ANNOUNCE_DELAY_MS);
    };

    const sync = (target: EventTarget | null, shouldAnnounce: boolean) => {
      if (!(target instanceof HTMLInputElement)) return;
      if (userInvalid(target)) {
        if (shouldAnnounce && !announced.has(target)) {
          announce(target);
          announced.add(target);
        }
        target.setAttribute('aria-invalid', 'true');
        linkError(target, true);
        flagged.add(target);
      } else if (flagged.has(target) || target.getAttribute('aria-invalid') !== 'true') {
        target.setAttribute('aria-invalid', 'false');
        linkError(target, false);
        flagged.delete(target);
        announced.delete(target);
      }
    };

    const onBlur = (event: Event) => {
      sync(event.target, true);
    };
    const onInput = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.hasAttribute('aria-invalid')) sync(event.target, false);
    };
    const onInvalid = (event: Event) => {
      if (event.target instanceof HTMLInputElement) announced.add(event.target);
      sync(event.target, false);
    };
    form.addEventListener('blur', onBlur, true);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onBlur, true);
    form.addEventListener('invalid', onInvalid, true);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener('blur', onBlur, true);
      form.removeEventListener('input', onInput);
      form.removeEventListener('change', onBlur, true);
      form.removeEventListener('invalid', onInvalid, true);
    };
  }, []);

  return { formProps: { ref: formRef }, announcement };
}
