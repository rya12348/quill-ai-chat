import {
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Minimize2,
  PenLine,
  RotateCw,
  Save,
  ScanText,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'

import type { PdfFormField } from '../lib/pdf-workbench'
import {
  compressPdf,
  docxToPdf,
  extractPdfText,
  fillPdfForm,
  ocrPdf,
  pdfPageCount,
  pdfToDocx,
  pdfToWorkbook,
  readPdfFormFields,
  redactPdf,
  renderPdfPreview,
  sheetToPdf,
  signPdf,
  textBlob,
  textFileToPdf,
} from '../lib/pdf-workbench'
import { extractPdfPages, mergePdfs, rotatePdf } from '../lib/pdf-tools'
import { downloadBlob, savePdfFile } from '../lib/pdf-store'
import { formatBytes, outputName, parsePageSelection, pdfFileKind, type PdfFileKind } from '../../shared/pdf'
import { Button, Spinner, useToast } from '../components/ui'
import { cx } from '../lib/cx'

type TabId = 'organize' | 'compress' | 'edit' | 'forms' | 'convert' | 'ocr'
type WorkFile = { id: string; file: File; kind: PdfFileKind; pages?: number }
type OutputKind = 'pdf' | 'docx' | 'sheet' | 'text'
type StudioOutput = { blob: Blob; name: string; note: string; pages?: number; preview?: string; kind: OutputKind }

const TABS: { id: TabId; label: string }[] = [
  { id: 'organize', label: 'Organize' },
  { id: 'compress', label: 'Compress' },
  { id: 'edit', label: 'Redact & sign' },
  { id: 'forms', label: 'Forms' },
  { id: 'convert', label: 'Convert' },
  { id: 'ocr', label: 'OCR' },
]

const KIND_ICON = {
  pdf: FileText,
  docx: FileText,
  sheet: FileSpreadsheet,
  text: FileText,
  other: FileText,
}

const selectClass =
  'h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] text-fg focus:border-fg/40 focus:outline-none focus:ring-[3px] focus:ring-fg/8'
function fileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
}

function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: 'application/pdf' })
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [typed, setTyped] = useState('')

  const prepare = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 640
    canvas.height = 180
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 3.2
    context.strokeStyle = '#1b1a17'
    dirty.current = false
  }

  useEffect(prepare, [])

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.setPointerCapture(event.pointerId)
    const startPoint = point(event)
    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)
    drawing.current = true
  }

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const next = point(event)
    context.lineTo(next.x, next.y)
    context.stroke()
    dirty.current = true
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && dirty.current) onChange(canvas.toDataURL('image/png'))
  }

  const useTyped = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !typed.trim()) return
    prepare()
    context.font = 'italic 44px "Segoe Script", "Bradley Hand", cursive'
    context.fillStyle = '#1b1a17'
    context.fillText(typed.trim().slice(0, 60), 22, 106)
    dirty.current = true
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-tile border border-line bg-white">
        <canvas
          ref={canvasRef}
          className="block h-[150px] w-full cursor-crosshair touch-none"
          aria-label="Draw your signature"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
        />
        <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-[#9d9890]">Sign above</span>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Or type a signature"
          className="h-9 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none"
        />
        <Button size="sm" disabled={!typed.trim()} onClick={useTyped}>
          Use typed
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear signature"
          title="Clear signature"
          onClick={() => {
            setTyped('')
            prepare()
            onChange('')
          }}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

export function PdfWorkbench() {
  const [files, setFiles] = useState<WorkFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('organize')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<StudioOutput | null>(null)
  const [saved, setSaved] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [splitPages, setSplitPages] = useState('')
  const [rotatePages, setRotatePages] = useState('')
  const [rotateAngle, setRotateAngle] = useState('90')
  const [compression, setCompression] = useState<'balanced' | 'strong'>('balanced')
  const [redactTerms, setRedactTerms] = useState('')
  const [signature, setSignature] = useState('')
  const [signPage, setSignPage] = useState('1')
  const [formFields, setFormFields] = useState<PdfFormField[] | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [flattenForm, setFlattenForm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const selected = files.find((file) => file.id === selectedId) ?? files.find((file) => file.kind === 'pdf') ?? files[0]
  const selectedPdf = selected?.kind === 'pdf' ? selected : undefined
  const pdfFiles = files.filter((file) => file.kind === 'pdf')
  const busyNow = Boolean(busy)
  const Icon = KIND_ICON[selected?.kind ?? 'pdf']

  useEffect(() => {
    if (!selectedPdf) {
      setSignPage('1')
      return
    }
    setSignPage(String(selectedPdf.pages || 1))
  }, [selectedId, selectedPdf?.pages])

  useEffect(() => {
    let cancelled = false
    setFormFields(null)
    setFormError('')
    if (tab !== 'forms' || !selectedPdf) return
    setFormLoading(true)
    void fileBytes(selectedPdf.file)
      .then((bytes) => readPdfFormFields(bytes))
      .then((fields) => {
        if (cancelled) return
        setFormFields(fields)
        setFormValues(Object.fromEntries(fields.map((field) => [field.name, field.value])))
      })
      .catch((cause) => {
        if (!cancelled) setFormError(cause instanceof Error ? cause.message : 'The form fields could not be read.')
      })
      .finally(() => {
        if (!cancelled) setFormLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, selectedId, selectedPdf?.file])

  const addFiles = async (incoming: FileList | File[]) => {
    const candidates = Array.from(incoming)
    if (!candidates.length) return
    setBusy('Reading files…')
    const additions: WorkFile[] = []
    try {
      for (const file of candidates) {
        const kind = pdfFileKind(file.name)
        if (kind === 'other') {
          toast(`${file.name} is not a PDF, Word, text or spreadsheet file.`, 'danger')
          continue
        }
        if (file.size > 40_000_000) {
          toast(`${file.name} is larger than 40 MB.`, 'danger')
          continue
        }
        if (files.some((item) => item.file.name === file.name && item.file.size === file.size)) continue
        let pages: number | undefined
        if (kind === 'pdf') {
          try {
            pages = await pdfPageCount(await fileBytes(file))
          } catch (cause) {
            toast(cause instanceof Error ? cause.message : `${file.name} could not be opened.`, 'danger')
            continue
          }
        }
        additions.push({ id: crypto.randomUUID(), file, kind, pages })
      }
      if (!additions.length) return
      setFiles((current) => [...current, ...additions])
      setSelectedId((current) => current ?? additions[0]?.id ?? null)
    } finally {
      setBusy('')
    }
  }

  const makePdfOutput = async (bytes: Uint8Array, name: string, note: string): Promise<StudioOutput> => {
    let preview: string | undefined
    let pages: number | undefined
    try {
      const meta = await renderPdfPreview(bytes)
      preview = meta.dataUrl
      pages = meta.pageCount
    } catch {
      // A browser that cannot preview the result can still download it.
    }
    return { blob: pdfBlob(bytes), name, note, pages, preview, kind: 'pdf' }
  }

  const run = async (label: string, task: () => Promise<StudioOutput>) => {
    setBusy(label)
    setProgress('')
    setResult(null)
    setSaved(false)
    try {
      setResult(await task())
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'That PDF operation failed.', 'danger')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  const requirePdf = (): WorkFile => {
    if (!selectedPdf) throw new Error('Choose a PDF first.')
    return selectedPdf
  }

  const merge = () =>
    run('Merging PDFs', async () => {
      if (pdfFiles.length < 2) throw new Error('Choose at least two PDFs to merge.')
      const sources = await Promise.all(pdfFiles.map((file) => fileBytes(file.file)))
      return makePdfOutput(await mergePdfs(sources), outputName(pdfFiles[0]!.file.name, 'merged'), `${pdfFiles.length} PDFs combined in the order shown.`)
    })

  const split = () =>
    run('Splitting PDF', async () => {
      const file = requirePdf()
      const pages = parsePageSelection(splitPages.replace(/-$/, ''), file.pages ?? 1)
      return makePdfOutput(await extractPdfPages(await fileBytes(file.file), pages), outputName(file.file.name, 'pages'), `Extracted ${pages.length} page${pages.length === 1 ? '' : 's'}.`)
    })

  const rotate = () =>
    run('Rotating pages', async () => {
      const file = requirePdf()
      const pages = parsePageSelection(rotatePages, file.pages ?? 1)
      return makePdfOutput(await rotatePdf(await fileBytes(file.file), pages, Number(rotateAngle)), outputName(file.file.name, 'rotated'), `Rotated ${pages.length} page${pages.length === 1 ? '' : 's'} by ${rotateAngle}°.`)
    })

  const compress = () =>
    run('Compressing PDF', async () => {
      const file = requirePdf()
      const compressed = await compressPdf(await fileBytes(file.file), compression)
      return makePdfOutput(compressed.bytes, outputName(file.file.name, 'compressed'), compressed.note)
    })

  const redact = () =>
    run('Redacting text', async () => {
      const file = requirePdf()
      const terms = redactTerms.split(/[,\n]/).map((term) => term.trim()).filter(Boolean)
      const redacted = await redactPdf(await fileBytes(file.file), terms)
      return makePdfOutput(redacted.bytes, outputName(file.file.name, 'redacted'), redacted.note)
    })

  const sign = () =>
    run('Adding signature', async () => {
      const file = requirePdf()
      if (!signature) throw new Error('Draw or type a signature first.')
      return makePdfOutput(
        await signPdf(await fileBytes(file.file), signature, Number(signPage) || 1),
        outputName(file.file.name, 'signed'),
        `Signature placed on page ${Math.min(Math.max(1, Number(signPage) || 1), file.pages ?? 1)}.`,
      )
    })

  const fillForm = () =>
    run('Filling form', async () => {
      const file = requirePdf()
      if (!formFields?.length) throw new Error('This PDF has no fillable form fields.')
      const bytes = await fillPdfForm(await fileBytes(file.file), formValues, flattenForm)
      return makePdfOutput(bytes, outputName(file.file.name, 'filled'), flattenForm ? 'Fields filled and flattened into the page.' : 'Fields filled; the PDF remains editable.')
    })

  const convertText = () =>
    run('Extracting text', async () => {
      const file = requirePdf()
      const pages = await extractPdfText(await fileBytes(file.file))
      return { blob: textBlob(pages), name: outputName(file.file.name, 'text', 'txt'), note: 'Text extracted from every page.', kind: 'text' as const }
    })

  const convertDocx = () =>
    run('Making Word file', async () => {
      const file = requirePdf()
      const pages = await extractPdfText(await fileBytes(file.file))
      return {
        blob: await pdfToDocx(pages),
        name: outputName(file.file.name, 'converted', 'docx'),
        note: 'Text-first conversion: layout, images and tables are not preserved.',
        kind: 'docx' as const,
      }
    })

  const convertWorkbook = () =>
    run('Making spreadsheet', async () => {
      const file = requirePdf()
      const pages = await extractPdfText(await fileBytes(file.file))
      return {
        blob: await pdfToWorkbook(pages),
        name: outputName(file.file.name, 'converted', 'xlsx'),
        note: 'Rows come from the PDF text layer; complex tables may need cleanup.',
        kind: 'sheet' as const,
      }
    })

  const convertToPdf = () =>
    run('Making PDF', async () => {
      if (!selected) throw new Error('Choose a file first.')
      if (selected.kind === 'docx') {
        return makePdfOutput(await docxToPdf(selected.file), outputName(selected.file.name, 'converted'), 'Text-first conversion; original Word layout is simplified.')
      }
      if (selected.kind === 'text') {
        return makePdfOutput(await textFileToPdf(selected.file), outputName(selected.file.name, 'converted'), 'Plain-text conversion with wrapped lines.')
      }
      if (selected.kind === 'sheet') {
        const converted = await sheetToPdf(selected.file)
        return makePdfOutput(converted.bytes, outputName(selected.file.name, 'converted'), converted.note)
      }
      throw new Error('Choose a Word, text or spreadsheet file to convert.')
    })

  const runOcr = () =>
    run('Running OCR', async () => {
      const file = requirePdf()
      const ocr = await ocrPdf(await fileBytes(file.file), setProgress)
      return { blob: textBlob(ocr.pages), name: outputName(file.file.name, 'ocr', 'txt'), note: 'English OCR. Review the text before relying on it.', kind: 'text' as const }
    })

  const saveToLibrary = async () => {
    if (!result) return
    try {
      await savePdfFile({ blob: result.blob, name: result.name, pages: result.pages, tool: result.kind === 'pdf' ? 'PDF Studio' : 'PDF conversion' })
      setSaved(true)
      toast('Saved to Library on this device')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'This result could not be saved locally.', 'danger')
    }
  }

  const download = () => {
    if (!result) return
    downloadBlob(result.blob, result.name)
    toast(`Downloaded ${result.name}`)
  }

  const removeFile = (id: string) => {
    const next = files.filter((file) => file.id !== id)
    setFiles(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1160px] px-4 pb-16 pt-8 md:px-6 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">PDF Studio</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">Every page, handled here.</h1>
            <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-muted">
              Merge, split, compress, sign and convert documents without sending the file to a server.
            </p>
          </div>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11.5px] font-medium text-muted">
            <ShieldCheck className="size-3.5 text-success" />
            Private by default
          </span>
        </div>

        <div className="mt-7 grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-fit rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Your files</h2>
              {files.length > 0 && <span className="text-[11px] tabular-nums text-faint">{files.length} loaded</span>}
            </div>
            <div
              data-testid="pdf-dropzone"
              className={cx(
                'mt-3 rounded-[14px] border border-dashed px-3 py-5 text-center transition-colors',
                dragging ? 'border-accent bg-accent-soft/40' : 'border-line-strong bg-surface-2/30',
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void addFiles(event.dataTransfer.files)
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                data-testid="pdf-file-input"
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
              <Upload className="mx-auto size-4 text-faint" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busyNow}
                className="mt-2 block w-full text-[12.5px] font-medium text-fg disabled:opacity-50"
              >
                Choose files
              </button>
              <p className="mt-1 text-[10.5px] leading-relaxed text-faint">or drop them here · PDF, Word, text, Excel</p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5" aria-label="Loaded files">
                {files.map((file) => {
                  const FileIcon = KIND_ICON[file.kind]
                  const active = file.id === selected?.id
                  return (
                    <li
                      key={file.id}
                      className={cx(
                        'group flex items-center rounded-tile border transition-colors',
                        active ? 'border-line-strong bg-surface-2/60' : 'border-transparent hover:bg-surface-2/45',
                      )}
                    >
                      <button type="button" onClick={() => setSelectedId(file.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left">
                        <span className={cx('grid size-7 shrink-0 place-items-center rounded-[8px]', active ? 'bg-surface text-fg' : 'bg-surface-2 text-faint')}>
                          <FileIcon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-fg">{file.file.name}</span>
                          <span className="mt-0.5 block text-[10.5px] text-faint">
                            {formatBytes(file.file.size)}
                            {file.pages ? ` · ${file.pages} page${file.pages === 1 ? '' : 's'}` : ''}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${file.file.name}`}
                        title={`Remove ${file.file.name}`}
                        onClick={() => removeFile(file.id)}
                        className="mr-1 grid size-6 shrink-0 place-items-center rounded-[7px] text-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100 focus:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-4 flex gap-1.5 border-t border-line pt-3 text-[10.5px] leading-relaxed text-faint">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-success" />
              Files are processed in this browser. Saved results stay on this device.
            </p>
          </aside>

          <section className="min-w-0 rounded-card border border-line bg-surface shadow-card">
            <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  disabled={busyNow}
                  aria-pressed={tab === item.id}
                  className={cx(
                    'h-8 shrink-0 rounded-tile px-3 text-[12px] font-medium transition-colors disabled:opacity-50',
                    tab === item.id ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="p-4 md:p-5">
              {!files.length ? (
                <div className="py-8 text-center md:py-14">
                  <span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-accent-soft text-accent">
                    <Sparkles className="size-5" />
                  </span>
                  <h2 className="mt-4 text-[18px] font-semibold">One PDF tool, many jobs.</h2>
                  <p className="mx-auto mt-1 max-w-[430px] text-[12.5px] leading-relaxed text-muted">
                    Add a document to start. The Studio keeps your files local and puts the finished result one click away.
                  </p>
                  <div className="mx-auto mt-6 grid max-w-[500px] gap-2 text-left sm:grid-cols-3">
                    {[
                      { icon: Scissors, title: 'Edit pages', copy: 'Merge, split and rotate.' },
                      { icon: PenLine, title: 'Make it yours', copy: 'Redact, sign and fill forms.' },
                      { icon: FileText, title: 'Change format', copy: 'Text, Word, Excel and OCR.' },
                    ].map((feature) => {
                      const FeatureIcon = feature.icon
                      return (
                        <div key={feature.title} className="rounded-tile border border-line bg-surface-2/35 p-3">
                          <FeatureIcon className="size-4 text-muted" />
                          <p className="mt-2 text-[11.5px] font-medium">{feature.title}</p>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">{feature.copy}</p>
                        </div>
                      )
                    })}
                  </div>
                  <Button variant="primary" className="mt-6" onClick={() => inputRef.current?.click()}>
                    <Upload />
                    Choose a file
                  </Button>
                </div>
              ) : (
                <>
                  {busy && (
                    <div className="mb-4 flex items-center gap-2 rounded-tile border border-line bg-surface-2/45 px-3 py-2 text-[12px] text-muted">
                      <Loader2 className="size-3.5 animate-spin text-accent" />
                      <span className="font-medium text-fg">{busy}</span>
                      {progress && <span className="ml-auto truncate text-[11px] text-faint">{progress}</span>}
                    </div>
                  )}

                  <div className="mb-4 flex items-center gap-2 text-[11.5px] text-faint">
                    <Icon className="size-3.5" />
                    <span className="truncate">{selected?.file.name}</span>
                    {selected?.pages ? <span>· {selected.pages} pages</span> : null}
                  </div>

                  {tab === 'organize' && (
                    <div className="space-y-3">
                      <div className="rounded-tile border border-line p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><Scissors className="size-4" /></span>
                          <div className="min-w-0">
                            <h2 className="text-[13px] font-semibold">Merge PDFs</h2>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Combine every loaded PDF in the list order.</p>
                          </div>
                        </div>
                        <Button variant="primary" size="sm" className="mt-3" disabled={pdfFiles.length < 2 || busyNow} loading={busy === 'Merging PDFs'} onClick={() => void merge()}>
                          Merge {pdfFiles.length > 1 ? `${pdfFiles.length} PDFs` : 'PDFs'}
                        </Button>
                      </div>

                      <div className="rounded-tile border border-line p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><FileText className="size-4" /></span>
                          <div className="min-w-0">
                            <h2 className="text-[13px] font-semibold">Split / extract pages</h2>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Keep only the pages you name. Leave blank for all pages.</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="min-w-[150px] flex-1 text-[10.5px] font-medium text-muted">
                            Pages
                            <input value={splitPages} onChange={(event) => setSplitPages(event.target.value)} placeholder="1-3, 5" className="mt-1 h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none" />
                          </label>
                          <Button size="sm" disabled={!selectedPdf || busyNow} loading={busy === 'Splitting PDF'} onClick={() => void split()}>
                            Extract
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-tile border border-line p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><RotateCw className="size-4" /></span>
                          <div className="min-w-0">
                            <h2 className="text-[13px] font-semibold">Rotate pages</h2>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Turn upright pages that were scanned sideways.</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="min-w-[150px] flex-1 text-[10.5px] font-medium text-muted">
                            Pages
                            <input value={rotatePages} onChange={(event) => setRotatePages(event.target.value)} placeholder="All pages" className="mt-1 h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none" />
                          </label>
                          <label className="w-[104px] text-[10.5px] font-medium text-muted">
                            Angle
                            <select value={rotateAngle} onChange={(event) => setRotateAngle(event.target.value)} className={cx(selectClass, 'mt-1')}>
                              <option value="90">90°</option>
                              <option value="180">180°</option>
                              <option value="270">270°</option>
                            </select>
                          </label>
                          <Button size="sm" disabled={!selectedPdf || busyNow} loading={busy === 'Rotating pages'} onClick={() => void rotate()}>
                            Rotate
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === 'compress' && (
                    <div>
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><Minimize2 className="size-4" /></span>
                        <div>
                          <h2 className="text-[13px] font-semibold">Make the file lighter</h2>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Pages are flattened into images to remove extra weight. Selectable text is lost.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {([
                          { id: 'balanced', title: 'Balanced', copy: 'Good quality, smaller file' },
                          { id: 'strong', title: 'Smallest', copy: 'Strong compression, softer text' },
                        ] as const).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setCompression(option.id)}
                            aria-pressed={compression === option.id}
                            className={cx(
                              'rounded-tile border p-3 text-left transition-colors',
                              compression === option.id ? 'border-accent bg-accent-soft/35' : 'border-line hover:border-line-strong',
                            )}
                          >
                            <span className="text-[12px] font-semibold">{option.title}</span>
                            <span className="mt-0.5 block text-[10.5px] text-muted">{option.copy}</span>
                          </button>
                        ))}
                      </div>
                      <Button variant="primary" size="sm" className="mt-4" disabled={!selectedPdf || busyNow} loading={busy === 'Compressing PDF'} onClick={() => void compress()}>
                        Compress PDF
                      </Button>
                    </div>
                  )}

                  {tab === 'edit' && (
                    <div className="space-y-5">
                      <section>
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><ShieldCheck className="size-4" /></span>
                          <div>
                            <h2 className="text-[13px] font-semibold">Redact text</h2>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Black out matching words across the document. This flattens every page, so text underneath cannot be selected or copied.</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="min-w-[220px] flex-1 text-[10.5px] font-medium text-muted">
                            Words or phrases
                            <input value={redactTerms} onChange={(event) => setRedactTerms(event.target.value)} placeholder="e.g. account number, Jordan Lee" className="mt-1 h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none" />
                          </label>
                          <Button size="sm" disabled={!selectedPdf || !redactTerms.trim() || busyNow} loading={busy === 'Redacting text'} onClick={() => void redact()}>
                            Redact
                          </Button>
                        </div>
                        <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-warning"><Info className="mt-0.5 size-3 shrink-0" />Check the result yourself before sharing a sensitive document.</p>
                      </section>

                      <section className="border-t border-line pt-5">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><PenLine className="size-4" /></span>
                          <div>
                            <h2 className="text-[13px] font-semibold">Add a signature</h2>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Draw or type a signature, then place it near the bottom of a page.</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <SignaturePad onChange={setSignature} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="w-[112px] text-[10.5px] font-medium text-muted">
                            Page
                            <input type="number" min="1" max={selected?.pages ?? 1} value={signPage} onChange={(event) => setSignPage(event.target.value)} className="mt-1 h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none" />
                          </label>
                          <Button size="sm" disabled={!selectedPdf || !signature || busyNow} loading={busy === 'Adding signature'} onClick={() => void sign()}>
                            Sign PDF
                          </Button>
                        </div>
                      </section>
                    </div>
                  )}

                  {tab === 'forms' && (
                    <div>
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><FileText className="size-4" /></span>
                        <div>
                          <h2 className="text-[13px] font-semibold">Fill a PDF form</h2>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Edit the document’s AcroForm fields, then keep it editable or flatten it.</p>
                        </div>
                      </div>
                      {formLoading ? (
                        <div className="grid min-h-[160px] place-items-center"><Spinner /></div>
                      ) : formError ? (
                        <p className="mt-4 rounded-tile border border-danger/20 bg-danger-soft px-3 py-2.5 text-[12px] text-danger">{formError}</p>
                      ) : !formFields?.length ? (
                        <p className="mt-4 rounded-tile border border-line bg-surface-2/40 px-3 py-4 text-[12px] leading-relaxed text-muted">This PDF does not contain fillable form fields. You can still add text with the signature tool, or use a PDF editor to add fields first.</p>
                      ) : (
                        <>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {formFields.map((field) => (
                              <label key={field.name} className="block min-w-0 text-[10.5px] font-medium text-muted">
                                <span className="block truncate" title={field.name}>{field.name}</span>
                                {field.kind === 'checkbox' ? (
                                  <span className="mt-1 flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px]">
                                    <input type="checkbox" checked={(formValues[field.name] ?? field.value) === 'true'} disabled={field.readOnly} onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.checked ? 'true' : 'false' }))} />
                                    Checked
                                  </span>
                                ) : field.kind === 'text' ? (
                                  <input value={formValues[field.name] ?? field.value} disabled={field.readOnly} onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.value }))} className="mt-1 h-9 w-full rounded-control border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-fg/40 focus:outline-none disabled:opacity-50" />
                                ) : (
                                  <select
                                    value={formValues[field.name] ?? field.value}
                                    disabled={field.readOnly}
                                    onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.value }))}
                                    className={cx(selectClass, 'mt-1')}
                                  >
                                    <option value="">Choose…</option>
                                    {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                )}
                              </label>
                            ))}
                          </div>
                          <label className="mt-4 flex items-center gap-2 text-[11.5px] text-muted">
                            <input type="checkbox" checked={flattenForm} onChange={(event) => setFlattenForm(event.target.checked)} />
                            Flatten fields into the page after filling
                          </label>
                          <Button variant="primary" size="sm" className="mt-3" disabled={busyNow} loading={busy === 'Filling form'} onClick={() => void fillForm()}>
                            Apply to PDF
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {tab === 'convert' && (
                    <div>
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><FileText className="size-4" /></span>
                        <div>
                          <h2 className="text-[13px] font-semibold">Change format</h2>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Conversions are text-first and preserve content, not complex layout. Use the result as a starting point.</p>
                        </div>
                      </div>
                      {selectedPdf ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <Button size="sm" disabled={busyNow} loading={busy === 'Extracting text'} onClick={() => void convertText()}><FileText /> Text (.txt)</Button>
                          <Button size="sm" disabled={busyNow} loading={busy === 'Making Word file'} onClick={() => void convertDocx()}><FileText /> Word (.docx)</Button>
                          <Button size="sm" disabled={busyNow} loading={busy === 'Making spreadsheet'} onClick={() => void convertWorkbook()}><FileSpreadsheet /> Excel (.xlsx)</Button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-tile border border-line bg-surface-2/40 p-3.5">
                          <p className="text-[12px] font-medium">This file → PDF</p>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">Word, text and spreadsheet files are converted to a simple, readable PDF.</p>
                          <Button variant="primary" size="sm" className="mt-3" disabled={!selected || busyNow} loading={busy === 'Making PDF'} onClick={() => void convertToPdf()}>
                            Convert to PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'ocr' && (
                    <div>
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-fg"><ScanText className="size-4" /></span>
                        <div>
                          <h2 className="text-[13px] font-semibold">Read a scanned PDF</h2>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">English OCR turns page images into a downloadable text file. Longer documents take longer and use more memory.</p>
                        </div>
                      </div>
                      <Button variant="primary" size="sm" className="mt-4" disabled={!selectedPdf || busyNow} loading={busy === 'Running OCR'} onClick={() => void runOcr()}>
                        <ScanText />
                        Extract text with OCR
                      </Button>
                      <p className="mt-2 text-[10.5px] leading-relaxed text-faint">OCR is not perfect. Review names, numbers and punctuation before relying on the output.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {result && (
              <div data-testid="pdf-result" className="border-t border-line bg-surface-2/25 p-4 md:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="grid h-[112px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-tile border border-line bg-surface">
                    {result.preview ? (
                      <img src={result.preview} alt={`Preview of ${result.name}`} className="h-full w-full object-contain" />
                    ) : (
                      <FileText className="size-7 text-faint" />
                    )}
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">Ready</p>
                      {result.pages ? <span className="text-[10.5px] text-faint">{result.pages} page{result.pages === 1 ? '' : 's'}</span> : null}
                      <span className="text-[10.5px] text-faint">{formatBytes(result.blob.size)}</span>
                    </div>
                    <h3 className="mt-1 truncate text-[13px] font-semibold">{result.name}</h3>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{result.note}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button variant="primary" size="sm" onClick={download}><Download /> Download</Button>
                      <Button size="sm" onClick={() => void saveToLibrary()} disabled={saved}>{saved ? <Check /> : <Save />}{saved ? 'Saved' : 'Save to Library'}</Button>
                      <Link to="/library" className="inline-flex h-8 items-center gap-1 rounded-tile px-2 text-[11.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
                        Library <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                  <button type="button" aria-label="Dismiss result" onClick={() => setResult(null)} className="grid size-7 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-faint">
          <span>Nothing leaves this browser unless you download or save it.</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /> PDF Studio</span>
        </div>
      </div>
    </div>
  )
}
