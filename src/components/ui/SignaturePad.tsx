import React, {
  useRef, useEffect, useState, useImperativeHandle, forwardRef,
} from 'react';
import { Trash2 } from 'lucide-react';

export interface SignaturePadRef {
  /** Returns base64 PNG data URI, or null if nothing has been drawn */
  getSignature: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  height?: number;
  lineColor?: string;
  minLineWidth?: number;
  maxLineWidth?: number;
  className?: string;
  onSignatureChange?: (isEmpty: boolean) => void;
}

/**
 * Canvas-based signature pad.
 * Uses the Pointer Events API — works with mouse, touch, and stylus/pen.
 * Pen pressure is detected via e.pressure and modulates line width.
 */
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      height = 180,
      lineColor = '#1f355e',
      minLineWidth = 1.2,
      maxLineWidth = 3.5,
      className = '',
      onSignatureChange,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [empty, setEmpty] = useState(true);

    // Device pixel ratio for crisp rendering on high-DPI / Retina / Surface
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    function ctx() {
      return canvasRef.current?.getContext('2d') ?? null;
    }

    function canvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * dpr,
        y: (e.clientY - r.top) * dpr,
      };
    }

    function lineWidth(pressure: number) {
      // pressure is 0–1 from stylus; mouse/touch defaults to 0.5
      const p = pressure > 0 ? pressure : 0.5;
      return minLineWidth * dpr + (maxLineWidth - minLineWidth) * dpr * p;
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      drawing.current = true;
      const pos = canvasPos(e);
      last.current = pos;

      // Draw a dot on tap (so a single tap registers)
      const c = ctx();
      if (c) {
        c.beginPath();
        c.arc(pos.x, pos.y, lineWidth(e.pressure) / 2, 0, Math.PI * 2);
        c.fillStyle = lineColor;
        c.fill();
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || !last.current) return;
      e.preventDefault();
      const c = ctx();
      if (!c) return;

      const pos = canvasPos(e);
      c.beginPath();
      c.moveTo(last.current.x, last.current.y);
      c.lineTo(pos.x, pos.y);
      c.strokeStyle = lineColor;
      c.lineWidth = lineWidth(e.pressure);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.stroke();
      last.current = pos;

      if (empty) {
        setEmpty(false);
        onSignatureChange?.(false);
      }
    }

    function stopDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      drawing.current = false;
      last.current = null;
    }

    function clear() {
      const canvas = canvasRef.current;
      const c = ctx();
      if (!canvas || !c) return;
      c.clearRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
      onSignatureChange?.(true);
    }

    useImperativeHandle(ref, () => ({
      getSignature: () => {
        if (empty || !canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
      clear,
      isEmpty: () => empty,
    }));

    // Resize canvas to match DOM size × DPR on mount and on window resize
    useEffect(() => {
      function resize() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width } = canvas.getBoundingClientRect();
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        // No need to ctx().scale here because we already multiply by dpr in canvasPos/lineWidth
      }
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [height, dpr]);

    return (
      <div className={`relative select-none ${className}`}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-white cursor-crosshair"
          style={{ height: `${height}px`, touchAction: 'none', display: 'block' }}
        />

        {/* Placeholder text */}
        {empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
            <span className="text-3xl opacity-20">✍</span>
            <span className="text-gray-300 text-xs font-medium tracking-wide">
              Sign here using your finger, mouse, or stylus
            </span>
          </div>
        )}

        {/* Signature baseline */}
        <div className="absolute bottom-7 left-8 right-12 border-b border-gray-300 pointer-events-none" />
        <span className="absolute bottom-2 left-8 text-[10px] text-gray-300 pointer-events-none">
          Authorized signature
        </span>

        {/* Clear button */}
        {!empty && (
          <button
            onClick={clear}
            className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Clear signature"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
