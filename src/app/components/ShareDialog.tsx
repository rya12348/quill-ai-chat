import { Check, Copy, Link2, LockKeyhole, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useConversationShare, useCreateConversationShare, useRevokeConversationShare } from '../lib/api'
import { Button, Dialog, Spinner, useToast } from './ui'

export function ShareDialog({ open, onClose, conversationId }: { open: boolean; onClose: () => void; conversationId: string | undefined }) {
  const toast = useToast()
  const { data, isLoading, error } = useConversationShare(conversationId, open)
  const create = useCreateConversationShare()
  const revoke = useRevokeConversationShare()
  const [copied, setCopied] = useState(false)
  const token = data?.token ?? null
  const link = token ? `${window.location.origin}/s/${token}` : ''

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast('Share link copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('Select the link and copy it', 'danger')
    }
  }

  const createLink = () => {
    if (!conversationId) return
    create.mutate(conversationId, {
      onSuccess: () => toast('Share link created'),
      onError: () => toast('Could not create a share link', 'danger'),
    })
  }

  const revokeLink = () => {
    if (!conversationId) return
    revoke.mutate(conversationId, {
      onSuccess: () => {
        toast('Share link revoked')
        setCopied(false)
      },
      onError: () => toast('Could not revoke the share link', 'danger'),
    })
  }

  return (
    <Dialog
      open={open && Boolean(conversationId)}
      onClose={onClose}
      title="Share this chat"
      description="Create a read-only link to this conversation."
      width={480}
      footer={
        isLoading
          ? undefined
          : token ? (
              <>
                <Button onClick={() => void copy()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
                <Button variant="danger" loading={revoke.isPending} onClick={revokeLink}>
                  <Trash2 />
                  Revoke
                </Button>
              </>
            ) : error ? undefined : (
              <Button variant="primary" loading={create.isPending} onClick={createLink}>
                <Link2 />
                Create link
              </Button>
            )
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner />
          Checking sharing…
        </div>
      ) : error ? (
        <p className="text-[13.5px] leading-relaxed text-danger">Could not load sharing for this chat. Close this window and try again.</p>
      ) : token ? (
        <div>
          <label htmlFor="share-link" className="text-[12.5px] font-medium text-fg">
            Public link
          </label>
          <input
            id="share-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-10 w-full rounded-control border border-line-strong bg-bg px-3 text-[13px] text-muted focus:border-fg/40 focus:outline-none focus:ring-[3px] focus:ring-fg/8"
          />
          <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-muted">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-faint" />
            Anyone with this link can read this chat. They can&apos;t reply, rate it, or see your other chats.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">Revoking makes this URL stop working immediately. The chat itself stays in your sidebar.</p>
        </div>
      ) : (
        <div>
          <p className="text-[13.5px] leading-relaxed text-muted">A link is the only thing people need to read this conversation. They won&apos;t see your account or any other chats.</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-faint">You can revoke it at any time. If you delete this chat, the link is removed too.</p>
        </div>
      )}
    </Dialog>
  )
}
