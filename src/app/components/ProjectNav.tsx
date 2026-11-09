import { BookOpen, Folder, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { MAX_INSTRUCTIONS_CHARS } from '../../shared/config'
import type { Project } from '../../shared/types'
import { useCreateProject, useDeleteProject, useProjects, useRenameProject, useUpdateProjectInstructions } from '../lib/api'
import { cx } from '../lib/cx'
import { Button, ConfirmDialog, Dialog, Input, inputClass, Menu, useToast } from './ui'

export function ProjectNav({ selectedId, totalChats }: { selectedId: string | null; totalChats: number }) {
  const { data, isLoading } = useProjects()
  const projects = data?.items ?? []
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [instructionsFor, setInstructionsFor] = useState<Project | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const remove = useDeleteProject()

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (project: Project) => {
    setEditing(project)
    setDialogOpen(true)
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-3 pb-1.5">
        <h2 className="text-[11.5px] font-medium text-faint">Projects</h2>
        <Button variant="ghost" size="icon-sm" className="size-7" aria-label="New project" title="New project" onClick={openNew}>
          <Plus />
        </Button>
      </div>
      <ul className="space-y-0.5" aria-label="Projects">
        <li>
          <Link
            to="/"
            className={cx(
              'flex h-8 items-center gap-2 rounded-control px-3 text-[13px] transition-colors',
              !selectedId ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg',
            )}
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">All chats</span>
            <span className="text-[11px] tabular-nums text-faint">{totalChats}</span>
          </Link>
        </li>
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            selected={selectedId === project.id}
            onEdit={openEdit}
            onDelete={setDeleting}
            onInstructions={setInstructionsFor}
          />
        ))}
      </ul>
      {!isLoading && projects.length === 0 && <p className="px-3 pb-1 pt-1 text-[11.5px] leading-relaxed text-faint">Group related chats together.</p>}

      <ProjectDialog open={dialogOpen} project={editing} onClose={() => setDialogOpen(false)} />
      <InstructionsDialog project={instructionsFor} onClose={() => setInstructionsFor(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this project?"
        description="Its conversations stay in All chats; only the project is removed."
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast('Project deleted')
              if (selectedId === deleting.id) navigate('/')
              setDeleting(null)
            },
            onError: () => toast('Could not delete this project', 'danger'),
          })
        }}
      />
    </div>
  )
}

function ProjectRow({
  project,
  selected,
  onEdit,
  onDelete,
  onInstructions,
}: {
  project: Project
  selected: boolean
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onInstructions: (project: Project) => void
}) {
  return (
    <li className="group relative">
      <Link
        to={`/?project=${encodeURIComponent(project.id)}`}
        className={cx(
          'flex h-8 items-center gap-2 rounded-control pl-3 pr-9 text-[13px] transition-colors',
          selected ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface hover:text-fg',
        )}
      >
        <Folder className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        <span className="text-[11px] tabular-nums text-faint">{project.conversationCount}</span>
      </Link>
      <span className={cx('absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100', selected && 'opacity-100')}>
        <Menu
          trigger={
            <Button variant="ghost" size="icon-sm" className="size-7" aria-label={`Options for project ${project.name}`}>
              <MoreHorizontal />
            </Button>
          }
          items={[
            { label: 'Rename', icon: <Pencil />, onSelect: () => onEdit(project) },
            { label: 'Instructions', icon: <BookOpen />, onSelect: () => onInstructions(project) },
            { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => onDelete(project) },
          ]}
        />
      </span>
    </li>
  )
}

function ProjectDialog({ open, project, onClose }: { open: boolean; project: Project | null; onClose: () => void }) {
  const create = useCreateProject()
  const rename = useRenameProject()
  const toast = useToast()
  const [name, setName] = useState('')
  useEffect(() => {
    if (open) setName(project?.name ?? '')
  }, [open, project])
  const pending = project ? rename.isPending : create.isPending
  const save = () => {
    const value = name.replace(/\s+/g, ' ').trim()
    if (!value) return
    const done = () => {
      toast(project ? 'Project renamed' : 'Project created')
      onClose()
    }
    const failed = () => toast(project ? 'Could not rename this project' : 'Could not create this project', 'danger')
    if (project) rename.mutate({ id: project.id, name: value }, { onSuccess: done, onError: failed })
    else create.mutate(value, { onSuccess: done, onError: failed })
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? 'Rename project' : 'New project'}
      description={project ? 'Give this collection a new name.' : 'Group related conversations without moving their messages.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!name.trim()} onClick={save}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label htmlFor="project-name" className="text-[12.5px] font-medium text-fg">
          Project name
        </label>
        <Input id="project-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="e.g. Client work" className="mt-2" />
      </form>
    </Dialog>
  )
}

function InstructionsDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const save = useUpdateProjectInstructions()
  const toast = useToast()
  const [value, setValue] = useState('')
  useEffect(() => {
    if (project) setValue(project.instructions ?? '')
  }, [project])
  const submit = () => {
    if (!project) return
    save.mutate(
      { id: project.id, instructions: value },
      {
        onSuccess: () => {
          toast('Project instructions saved')
          onClose()
        },
        onError: () => toast('Could not save these instructions', 'danger'),
      },
    )
  }
  return (
    <Dialog
      open={Boolean(project)}
      onClose={onClose}
      title={project ? `Instructions for ${project.name}` : 'Project instructions'}
      description="Added to every reply in chats in this project. Keep it short and concrete."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save instructions
          </Button>
        </>
      }
    >
      <label htmlFor="project-instructions" className="text-[12.5px] font-medium text-fg">
        Instructions
      </label>
      <textarea
        id="project-instructions"
        value={value}
        maxLength={MAX_INSTRUCTIONS_CHARS}
        onChange={(event) => setValue(event.target.value)}
        placeholder="e.g. Always cite primary sources and keep answers under 200 words."
        className={cx(inputClass, 'mt-2 h-auto min-h-[132px] resize-y py-2.5 leading-relaxed')}
      />
      <p className="mt-1.5 text-right text-[11px] tabular-nums text-faint">
        {value.length} / {MAX_INSTRUCTIONS_CHARS}
      </p>
    </Dialog>
  )
}
