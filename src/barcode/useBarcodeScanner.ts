/**
 * useBarcodeScanner.ts
 * Hook for USB barcode scanner input.
 *
 * USB scanners present as HID keyboards – they type a string of characters
 * then press Enter. This hook:
 *   1. Keeps a hidden <input> focused at all times (or the provided inputRef)
 *   2. Buffers keystrokes
 *   3. Fires `onScan(value)` when Enter is detected
 *   4. Re-focuses the input after each scan and on page visibility change
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcanneroptions {
  onScan: (value: string) => void;
  /** Optional ref to an existing input element. If omitted, a hidden one is created. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Minimum characters for a valid scan (ignore shorter accidental enter presses) */
  minLength?: number;
  /** Enabled flag – set to false to pause scanning */
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  inputRef,
  minLength = 3,
  enabled = true,
}: UseBarcanneroptions) {
  const internalRef = useRef<HTMLInputElement | null>(null);
  const bufferRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getInput = useCallback((): HTMLInputElement | null => {
    return inputRef?.current ?? internalRef.current;
  }, [inputRef]);

  const focus = useCallback(() => {
    const el = getInput();
    if (el && document.activeElement !== el) el.focus();
  }, [getInput]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const val = bufferRef.current.trim();
        bufferRef.current = '';
        if (val.length >= minLength) {
          onScan(val);
        }
        // Clear any pending flush timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // Accumulate printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        // Safety flush after 200ms (in case Enter is missed)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
          timerRef.current = null;
        }, 200);
      }
    }

    const el = getInput();
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      focus();
    }

    // Re-focus when tab becomes visible (e.g. user switches back to this tab)
    function handleVisibility() {
      if (document.visibilityState === 'visible') focus();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      el?.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, onScan, minLength, getInput, focus]);

  return { focus, inputRef: internalRef };
}
