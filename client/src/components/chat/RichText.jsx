import { cn } from '../../utils/cn.js';

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

const graphemeCount = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim())].filter((s) => s.segment.trim()).length;
  }
  return Array.from(text.trim()).length;
};

/** 1–3 emoji with no other text are rendered large. */
export const isEmojiOnly = (text = '') => Boolean(text.trim()) && EMOJI_ONLY.test(text) && !/\d/.test(text) && graphemeCount(text) <= 3;

/**
 * Renders user text safely: React escapes everything; only http(s) URLs become links
 * (opened with noopener/noreferrer). No HTML from users is ever injected.
 */
export default function RichText({ text, mine, className }) {
  if (!text) return null;
  const parts = text.split(URL_PATTERN);
  return (
    <p className={cn('break-words whitespace-pre-wrap', isEmojiOnly(text) && 'py-0.5 text-4xl leading-tight', className)}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn('font-medium underline underline-offset-2 break-all', mine ? 'text-white decoration-white/50' : 'text-accent-fg decoration-brand-500/40')}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </p>
  );
}
