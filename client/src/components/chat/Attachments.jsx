import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, File, FileArchive, FileSpreadsheet, FileText, Presentation, X } from 'lucide-react';
import { assetUrl } from '../../config/env.js';
import { cn } from '../../utils/cn.js';
import { formatBytes } from '../../utils/format.js';

export function fileIcon(mimeType = '', name = '') {
  if (mimeType.includes('pdf')) return { icon: FileText, tone: 'text-rose-400 bg-rose-500/12' };
  if (mimeType.includes('sheet') || name.endsWith('.csv')) return { icon: FileSpreadsheet, tone: 'text-emerald-400 bg-emerald-500/12' };
  if (mimeType.includes('presentation')) return { icon: Presentation, tone: 'text-orange-400 bg-orange-500/12' };
  if (mimeType.includes('zip')) return { icon: FileArchive, tone: 'text-amber-400 bg-amber-500/12' };
  if (mimeType.includes('word') || mimeType.startsWith('text/')) return { icon: FileText, tone: 'text-sky-400 bg-sky-500/12' };
  return { icon: File, tone: 'text-brand-300 bg-brand-500/12' };
}

export function ImageGrid({ images, onOpen, onLoad, mine }) {
  const count = images.length;
  return (
    <div className={cn('grid gap-1 overflow-hidden rounded-xl', count === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
      {images.map((image, index) => {
        const ratio = image.width && image.height ? `${image.width} / ${image.height}` : undefined;
        const spanFull = count === 3 && index === 0;
        return (
          <button
            key={image._id}
            type="button"
            onClick={() => onOpen(index)}
            className={cn('group relative overflow-hidden bg-black/10', spanFull && 'col-span-2', count === 1 ? 'max-w-[300px]' : '')}
            aria-label={`Open image ${image.name}`}
          >
            <img
              src={assetUrl(image.url)}
              alt={image.name}
              loading="lazy"
              onLoad={onLoad}
              style={count === 1 && ratio ? { aspectRatio: ratio } : undefined}
              className={cn(
                'w-full object-cover transition duration-300 group-hover:scale-[1.03]',
                count === 1 ? 'max-h-[340px] min-h-24' : 'h-32 sm:h-36',
                mine ? 'bg-white/10' : 'bg-surface-2'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function FileCard({ file, mine }) {
  const { icon: Icon, tone } = fileIcon(file.mimeType, file.name);
  return (
    <a
      href={assetUrl(file.url)}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      className={cn(
        'group flex min-w-[220px] items-center gap-3 rounded-xl border p-2.5 transition',
        mine ? 'border-white/15 bg-white/10 hover:bg-white/15' : 'border-line bg-surface-2/70 hover:border-line-strong'
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', mine ? 'bg-white/15 text-white' : tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className={cn('block text-xs', mine ? 'text-white/70' : 'text-subtle')}>{formatBytes(file.size)}</span>
      </span>
      <Download className={cn('h-4 w-4 shrink-0 opacity-70 transition group-hover:opacity-100', mine ? 'text-white' : 'text-muted')} />
    </a>
  );
}

/** Full-screen image viewer with keyboard navigation. */
export function Lightbox({ images, index, onClose, onIndexChange }) {
  const open = index !== null && index !== undefined;
  const [direction, setDirection] = useState(0);
  const current = open ? images[index] : null;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && index < images.length - 1) {
        setDirection(1);
        onIndexChange(index + 1);
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        setDirection(-1);
        onIndexChange(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, images.length, onClose, onIndexChange]);

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between gap-4 p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="truncate text-sm font-medium text-white/80">
              {current.name} {images.length > 1 && <span className="text-white/50">· {index + 1} / {images.length}</span>}
            </p>
            <div className="flex items-center gap-1">
              <a
                href={assetUrl(current.url)}
                download={current.name}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Download"
              >
                <Download className="h-5 w-5" />
              </a>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.img
                key={current._id}
                src={assetUrl(current.url)}
                alt={current.name}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, x: direction * 60, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: direction * -60, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            </AnimatePresence>
            {index > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(-1);
                  onIndexChange(index - 1);
                }}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {index < images.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(1);
                  onIndexChange(index + 1);
                }}
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
