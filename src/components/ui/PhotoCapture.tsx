/**
 * PhotoCapture — Reusable camera / file-upload component
 *
 * On mobile (iPhone/iPad/Android):  opens native camera via `capture="environment"`
 * On desktop: standard file browser (drag-and-drop also supported)
 *
 * Photos are stored as base64 data URIs in local state.
 * Pass `photos` + `onChange` for controlled usage.
 */

import React, { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from '../../utils';

export interface PhotoCaptureProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  label?: string;
  compact?: boolean;
  readOnly?: boolean;
}

function isVideo(src: string) {
  return src.startsWith('data:video') || /\.(mp4|webm|mov)$/i.test(src);
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
      >
        <X size={24} />
      </button>
      {photos.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); }}
            disabled={idx === 0}
            className="absolute left-4 text-white/70 hover:text-white p-2 disabled:opacity-30"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => Math.min(photos.length - 1, i + 1)); }}
            disabled={idx === photos.length - 1}
            className="absolute right-4 text-white/70 hover:text-white p-2 disabled:opacity-30"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}
      <img
        src={photos[idx]}
        alt={`Photo ${idx + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
      <div className="absolute bottom-4 text-white/60 text-sm">
        {idx + 1} / {photos.length}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PhotoCapture({
  photos,
  onChange,
  maxPhotos = 10,
  label = 'Photos',
  compact = false,
  readOnly = false,
}: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const canAdd = !readOnly && photos.length < maxPhotos;

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxPhotos - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const newPhotos = await Promise.all(toProcess.map(readFile));
    onChange([...photos, ...newPhotos]);
  }

  function removePhoto(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (canAdd) setDragging(true);
  }, [canAdd]);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canAdd) handleFiles(e.dataTransfer.files);
  }, [canAdd, photos]);

  if (compact && photos.length === 0 && readOnly) return null;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Camera size={13} className="text-gray-400" />
            {label}
            {photos.length > 0 && (
              <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-1.5">{photos.length}</span>
            )}
          </span>
          {!readOnly && photos.length > 0 && (
            <span className="text-xs text-gray-400">{maxPhotos - photos.length} remaining</span>
          )}
        </div>
      )}

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, idx) => (
            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightboxIdx(idx)}
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setLightboxIdx(idx)}
                  className="p-1 bg-white/90 rounded-full text-gray-700 hover:bg-white"
                >
                  <ZoomIn size={12} />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => removePhoto(idx)}
                    className="p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload / Capture zone */}
      {canAdd && (
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={clsx(
            'border-2 border-dashed rounded-xl transition-colors',
            dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300',
            compact ? 'p-2' : 'p-4',
          )}
        >
          <div className={clsx('flex items-center justify-center gap-3', compact ? 'flex-row' : 'flex-col sm:flex-row')}>
            {/* Camera button — triggers camera on mobile */}
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700 transition-colors shadow-sm"
            >
              <Camera size={14} className="text-brand-500" />
              Take Photo
            </button>

            {/* File upload button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700 transition-colors shadow-sm"
            >
              <Upload size={14} className="text-gray-400" />
              Upload Image
            </button>

            {!compact && (
              <span className="text-xs text-gray-400 hidden sm:block">or drag & drop</span>
            )}
          </div>

          {!compact && (
            <p className="text-center text-xs text-gray-400 mt-2">
              JPG, PNG, HEIC · Max {maxPhotos} photos · On phone: tap "Take Photo" to use camera
            </p>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      {/* capture="environment" opens rear camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
