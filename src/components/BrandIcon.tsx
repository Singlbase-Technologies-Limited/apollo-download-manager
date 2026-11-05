import { useId } from 'react';

/**
 * The Apollo app icon, drawn from `assets/brand/apollo-icon-small.svg` (the A drawn heavier
 * for small sizes). Decorative: the app name next to it is the accessible label.
 */
export function BrandIcon({ className }: { className?: string }) {
  const front = useId();
  return (
    <svg viewBox="0 0 128 128" className={className} aria-hidden focusable="false">
      <defs>
        <clipPath id={front}>
          <rect x="64" y="0" width="80" height="128" />
        </clipPath>
      </defs>
      <g transform="translate(2 2) skewX(-10) translate(19 0)">
        <path
          fill="#1659B3"
          fillRule="evenodd"
          d="M8 112 L52 10 H76 L120 112 H92 L83.6 92 H44.4 L36 112 Z M64 56 L70.6 72 H57.4 Z M17 112 L50.4 34 L57.4 34 L24 112 Z"
        />
        <path
          fill="#2F80E4"
          fillRule="evenodd"
          clipPath={`url(#${front})`}
          d="M8 112 L52 10 H76 L120 112 H92 L83.6 92 H44.4 L36 112 Z M64 56 L70.6 72 H57.4 Z"
        />
      </g>
    </svg>
  );
}
