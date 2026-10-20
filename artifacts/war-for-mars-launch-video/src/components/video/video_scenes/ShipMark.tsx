import type { CSSProperties } from 'react';

export function ShipMark({
  color = '#e0a15a',
  size = '4.5vmin',
  style,
  className = '',
}: {
  color?: string;
  size?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      style={{ width: size, height: size, overflow: 'visible', ...style }}
    >
      <path
        d="M50 2 61 37 94 64 57 59 50 97 43 59 6 64 39 37Z"
        fill={color}
        stroke="#f4e9d5"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M50 13 50 73" stroke="#07080d" strokeOpacity=".58" strokeWidth="2" />
    </svg>
  );
}
