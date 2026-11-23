import { Download, FileText, Link2, Maximize2, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import type { MessageAttachment } from '../../shared/types'
import { attachmentTypeLabel, formatFileSize } from '../lib/attachments'
import { cx } from '../lib/cx'

/** A small preview that opens the untouched image in the lightbox. */
export function AttachmentThumbnail({
  attachment,
  onOpen,
  className,
}: {
  attachment: MessageAttachment
  onOpen: () => void
  className?: string
}) {
  const src = attachment.thumbnailUrl ?? attachment.url
  if (!src) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${attachment.name}`}
      title={`View ${attachment.name}`}
      className={cx(
        'group/thumb relative block shrink-0 overflow-hidden rounded-[16px] border border-line bg-surface-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className ?? 'h-28 w-40',
      )}
    >
      <img
        src={src}
        alt={attachment.name}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-[1.02]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-[background-color,opacity] group-hover/thumb:bg-black/20 group-hover/thumb:opacity-100"
      >
        <span className="grid size-7 place-items-center rounded-full bg-black/55 shadow-sm">
          <Maximize2 className="size-3.5" />
        </span>
      </span>
    </button>
  )
}

/** File metadata and a download link for the original stored document. */
export function AttachmentFile({
  attachment,
  className,
  align = 'start',
}: {
  attachment: MessageAttachment
  className?: string
  align?: 'start' | 'end'
}) {
  const type = attachmentTypeLabel(attachment.mime, attachment.name)
  const link =
    attachment.mime === 'text/uri-list' && attachment.url && /^https?:\/\//i.test(attachment.url)
      ? attachment.url
      : null
  const body = (
    <>
      <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-muted">
        {link ? <Link2 className="size-3.5" /> : <FileText className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{attachment.name}</span>
        <span className="mt-0.5 block truncate text-[10.5px] text-faint">
          {type}
          {link ? '' : ` · ${formatFileSize(attachment.size)}`}
        </span>
      </span>
      {link || !attachment.downloadUrl ? null : <Download className="size-3.5 shrink-0 text-faint" />}
    </>
  )
  const classes = cx(
    'inline-flex max-w-[300px] items-center gap-2 rounded-[12px] border border-line bg-surface px-2.5 py-1.5 text-left text-fg transition-colors hover:border-accent/40 hover:bg-surface-2',
    align === 'end' ? 'ml-auto' : 'mr-auto',
    className,
  )

  if (link) {
    return (
      <a href={link} target="_blank" rel="noreferrer" title={link} className={classes}>
        {body}
      </a>
    )
  }
  if (attachment.downloadUrl) {
    return (
      <a
        href={attachment.downloadUrl}
        download={attachment.name}
        title={`Download ${attachment.name}`}
        className={classes}
      >
        {body}
      </a>
    )
  }
  return <span className={classes}>{body}</span>
}

/** A full-screen preview with the attachment's metadata and original download. */
export function AttachmentLightbox({
  attachment,
  onClose,
}: {
  attachment: MessageAttachment | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!attachment) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [attachment, onClose])

  if (!attachment) return null
  const type = attachmentTypeLabel(attachment.mime, attachment.name)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border border-white/10 bg-surface shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-fg">{attachment.name}</p>
            <p className="mt-0.5 text-[10.5px] text-faint">
              {type} · {formatFileSize(attachment.size)}
            </p>
          </div>
          {attachment.downloadUrl ? (
            <a
              href={attachment.downloadUrl}
              download={attachment.name}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Download original</span>
            </a>
          ) : null}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close image preview"
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/20 p-3 sm:p-6">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-[78vh] max-w-full rounded-[8px] object-contain"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
