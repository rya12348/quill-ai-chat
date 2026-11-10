import { AnimatePresence, motion } from 'motion/react'
import { Menu as MenuIcon, FileText, Library as LibraryIcon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'

import { BRAND } from '../../shared/config'
import type { Conversation } from '../../shared/types'
import { useConversations, useDeleteConversation, useMe, useRenameConversation } from '../lib/api'
import { ProjectNav } from './ProjectNav'
import { cx } from '../lib/cx'
import { DAY_GROUPS, dayGroup } from '../lib/format'
import { useTurn } from '../lib/turn'
import { Avatar, Button, ConfirmDialog, Dialog, Input, Menu, useToast } from './ui'

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <Link to="/" className={cx('inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight', className)}>
      <Mark size={size} />
      {BRAND}
    </Link>
  )
}

/** The brand mark: a quill nib. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-[9px] bg-fg text-bg', className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" width={size * 0.62} height={size * 0.62} fill="currentColor">
        <path d="M44 18c-9 1-17 8-20 18l-4 10 10-4c10-3 17-11 18-20l-9 9-3-3 8-10z" />
      </svg>
    </span>
  )
}

/** Lets the chat page own the mobile top bar instead of stacking a second header. */
const MobileNavContext = createContext<() => void>(() => {})
export const useMobileNav = () => useContext(MobileNavContext)

export function Shell() {
  const [drawer, setDrawer] = useState(false)
  // Remembered between visits; the drawer is separate and always starts closed.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar') === 'closed')
  const location = useLocation()
  const isChatSurface = location.pathname === '/' || location.pathname.startsWith('/c/')
  useEffect(() => setDrawer(false), [location.pathname, location.search])
  useEffect(() => {
    localStorage.setItem('sidebar', collapsed ? 'closed' : 'open')
  }, [collapsed])
  return (
    <div className="flex h-dvh overflow-hidden">
      {collapsed ? (
        <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-line bg-bg py-2 md:flex" aria-label="Collapsed sidebar">
          <Button variant="ghost" size="icon" aria-label="Show sidebar" title="Show sidebar" onClick={() => setCollapsed(false)}>
            <PanelLeftOpen />
          </Button>
        </aside>
      ) : (
        <aside className="hidden w-[264px] shrink-0 flex-col border-r border-line bg-bg md:flex">
          <Sidebar onCollapse={() => setCollapsed(true)} />
        </aside>
      )}
      <AnimatePresence>
        {drawer && (
          <motion.div key="drawer" className="fixed inset-0 z-40 bg-black/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={() => setDrawer(false)}>
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-[284px] flex-col bg-bg shadow-dialog"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Sidebar onClose={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <MobileNavContext.Provider value={() => setDrawer(true)}>
        <div className="flex min-w-0 flex-1 flex-col">
          {!isChatSurface && (
            <header className="flex h-12 shrink-0 items-center gap-2 px-3 md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setDrawer(true)}>
                <MenuIcon />
              </Button>
              <Logo size={24} />
            </header>
          )}
          <Outlet />
        </div>
      </MobileNavContext.Provider>
    </div>
  )
}

function Sidebar({ onClose, onCollapse }: { onClose?: () => void; onCollapse?: () => void }) {
  const { data: me } = useMe()
  const { data } = useConversations()
  const turn = useTurn()
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const selectedProject = params.get('project')
  const allItems = data?.items ?? []
  const needle = query.trim().toLowerCase()
  const scoped = selectedProject ? allItems.filter((conversation) => conversation.projectId === selectedProject) : allItems
  const items = needle ? scoped.filter((conversation) => conversation.title.toLowerCase().includes(needle)) : scoped
  const groups = DAY_GROUPS.map((group) => ({ group, items: items.filter((c) => dayGroup(c.updatedAt) === group) })).filter((g) => g.items.length)
  return (
    <>
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        {(onClose || onCollapse) && (
          <div className="flex items-center gap-0.5">
            {onCollapse && (
              <Button variant="ghost" size="icon-sm" aria-label="Hide sidebar" title="Hide sidebar" onClick={onCollapse}>
                <PanelLeftClose />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon-sm" aria-label="Close menu" onClick={onClose}>
                <X />
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="px-3">
        <NavLink
          to={selectedProject ? `/?project=${encodeURIComponent(selectedProject)}` : '/'}
          end
          className={({ isActive }) =>
            cx('flex h-9 items-center gap-2 rounded-control px-3 text-[13.5px] font-medium transition-colors', isActive && !turn ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg')
          }
        >
          <Plus className="size-4" />
          New chat
        </NavLink>
        <NavLink
          to="/library"
          className={({ isActive }) =>
            cx('mt-1 flex h-9 items-center gap-2 rounded-control px-3 text-[13.5px] font-medium transition-colors', isActive ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg')
          }
        >
          <LibraryIcon className="size-4" />
          Library
        </NavLink>
        <NavLink
          to="/tools/pdf"
          className={({ isActive }) =>
            cx('mt-1 flex h-9 items-center gap-2 rounded-control px-3 text-[13.5px] font-medium transition-colors', isActive ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg')
          }
        >
          <FileText className="size-4" />
          PDF Studio
        </NavLink>
        <label className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-2 text-[13px] text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
        </label>
      </div>
      <ProjectNav selectedId={selectedProject} totalChats={allItems.length} />
      <nav className="scrollbar-thin mt-1 flex-1 overflow-y-auto px-3 pb-3" aria-label="Chats">
        {groups.map(({ group, items }) => (
          <section key={group} className="mb-4">
            <h2 className="px-3 pb-1.5 pt-1 text-[11.5px] font-medium text-faint">{group}</h2>
            <ul className="space-y-0.5">
              {items.map((conversation) => (
                <ConversationRow key={conversation.id} conversation={conversation} streaming={turn?.conversationId === conversation.id} />
              ))}
            </ul>
          </section>
        ))}
        {data && items.length === 0 && (
          <p className="px-3 pt-6 text-center text-[13px] text-faint">
            {needle ? 'No chats match that search.' : selectedProject ? 'No chats in this project yet.' : 'Your chats will appear here.'}
          </p>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <NavLink to="/settings" className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-control px-2 transition-colors', isActive ? 'bg-surface shadow-card' : 'hover:bg-surface')}>
          {me && <Avatar name={me.user.name ?? me.user.email ?? 'You'} src={me.user.picture} size={28} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium">{me?.user.name ?? 'Account'}</span>
            <span className="block truncate text-[12px] text-faint">
              {me ? `${me.usage.used} of ${me.usage.limit} replies today` : ''}
            </span>
          </span>
          <SettingsIcon className="size-4 text-faint" />
        </NavLink>
      </div>
    </>
  )
}

function ConversationRow({ conversation, streaming }: { conversation: Conversation; streaming: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const projectId = params.get('project')
  const href = `/c/${conversation.id}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`
  const navigate = useNavigate()
  const toast = useToast()
  const active = id === conversation.id
  const [renaming, setRenaming] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  const rename = useRenameConversation()
  const remove = useDeleteConversation()
  return (
    <li className="group relative">
      <NavLink
        to={href}
        className={cx('flex h-9 items-center gap-2 rounded-control pl-3 pr-9 text-[13.5px] transition-colors', active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg')}
      >
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
        {streaming && <span className="round size-1.5 shrink-0 animate-pulse rounded-full bg-accent" />}
      </NavLink>
      <span className={cx('absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100', active && 'opacity-100')}>
        <Menu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${conversation.title}`} className="size-7">
              <MoreHorizontal />
            </Button>
          }
          items={[
            {
              label: 'Rename',
              icon: <Pencil />,
              onSelect: () => {
                setTitle(conversation.title)
                setRenaming(true)
              },
            },
            { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
      </span>
      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename chat"
        footer={
          <>
            <Button onClick={() => setRenaming(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={rename.isPending}
              disabled={!title.trim()}
              onClick={() => rename.mutate({ id: conversation.id, title: title.trim() }, { onSuccess: () => setRenaming(false), onError: () => toast('Could not rename this chat', 'danger') })}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) rename.mutate({ id: conversation.id, title: title.trim() }, { onSuccess: () => setRenaming(false) })
          }}
        >
          <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this chat?"
        description="Its messages are removed for good."
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(conversation.id, {
            onSuccess: () => {
              setConfirm(false)
              if (active) navigate('/', { replace: true })
            },
            onError: () => toast('Could not delete this chat', 'danger'),
          })
        }
      />
    </li>
  )
}
