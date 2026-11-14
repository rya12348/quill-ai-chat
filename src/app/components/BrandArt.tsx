import { cx } from '../lib/cx'

type BrandArtVariant = 'horizon' | 'landscape'

/**
 * The editorial and retro hosts use different artwork but share the same slot.
 * Both images stay in the DOM so switching themes never shifts the layout.
 */
export function BrandArt({ variant = 'horizon', className }: { variant?: BrandArtVariant; className?: string }) {
  const height = variant === 'landscape' ? 160 : 92
  return (
    <span className={cx('theme-art block select-none', className)} aria-hidden="true">
      <img
        src={`/art/quill-${variant}.svg`}
        alt=""
        width={272}
        height={height}
        className="retro-hide block h-auto w-full"
      />
      <img
        src={`/art/retro-${variant}.svg`}
        alt=""
        width={272}
        height={height}
        className="retro-art block h-auto w-full"
      />
    </span>
  )
}
