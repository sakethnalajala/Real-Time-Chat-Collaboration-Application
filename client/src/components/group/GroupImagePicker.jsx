import { useRef } from 'react';
import { Camera, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { assetUrl } from '../../config/env.js';
import { useObjectUrl } from '../../hooks/useUtils.js';
import { cn } from '../../utils/cn.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Round image picker with preview; `currentUrl` is the existing image (edit mode). */
export default function GroupImagePicker({ file, onChange, currentUrl, onRemoveCurrent, maxMB = 5, disabled }) {
  const inputRef = useRef(null);
  const preview = useObjectUrl(file);
  const shown = preview || (currentUrl ? assetUrl(currentUrl) : null);

  const pick = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (!IMAGE_TYPES.includes(chosen.type)) return toast.error('Please choose a JPG, PNG, WebP or GIF image');
    if (chosen.size > maxMB * 1024 * 1024) return toast.error(`Group images must be ${maxMB} MB or smaller`);
    onChange(chosen);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="group relative h-24 w-24 overflow-hidden rounded-3xl border border-dashed border-line-strong bg-surface-2 transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Choose group image"
      >
        {shown ? (
          <img src={shown} alt="Group" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-subtle">
            <Users className="h-7 w-7" />
            <span className="text-[10px] font-semibold tracking-wide uppercase">Add photo</span>
          </span>
        )}
        <span className={cn('absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition', !disabled && 'group-hover:opacity-100')}>
          <Camera className="h-6 w-6" />
        </span>
      </button>
      <div className="flex gap-3 text-xs">
        {disabled ? (
          <span className="text-subtle">Image uploads are not configured</span>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-accent-fg hover:underline">
            {shown ? 'Change image' : 'Upload image'}
          </button>
        )}
        {file && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 font-semibold text-rose-500 hover:underline">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
        {!file && currentUrl && onRemoveCurrent && (
          <button type="button" onClick={onRemoveCurrent} className="inline-flex items-center gap-1 font-semibold text-rose-500 hover:underline">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={pick} />
    </div>
  );
}
