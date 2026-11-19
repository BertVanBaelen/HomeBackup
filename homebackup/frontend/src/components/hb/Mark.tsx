/** The chosen HomeBackup mark: a roof over a clock with a back-arrow (Logo board, option B). */
export function Mark({ size = 24, strokeWidth = 5.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 28 L32 7 L56 28" />
      <g strokeWidth={strokeWidth - 0.5}>
        <path d="M37.1 56.1 A15 15 0 1 0 17 42" />
        <path d="M12.2 40.5 L21.8 40.5 L17 48 Z" fill="currentColor" strokeWidth="2.4" />
        <path d="M32 32.5 V42 L38.5 46.5" />
      </g>
    </svg>
  )
}
