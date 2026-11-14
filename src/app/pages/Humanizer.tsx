import { AlertCircle, ArrowRight, Check, ChevronDown, Copy, Info, Loader2, PenLine, RotateCw, Sparkles, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'

import { HUMANIZER_MAX_CHARS, HUMANIZER_MIN_CHARS, HUMANIZER_VOICE_MAX_CHARS, HUMANIZER_VOICE_MIN_CHARS } from '../../shared/config'
import type { HumanizerLength, HumanizerPurpose, HumanizerStrength, HumanizerTone } from '../../shared/types'
import { Button, useToast } from '../components/ui'
import { useHumanize } from '../lib/api'
import { cx } from '../lib/cx'

const TONES: { id: HumanizerTone; label: string; hint: string }[] = [
  { id: 'natural', label: 'Natural', hint: 'Clear and like you' },
  { id: 'casual', label: 'Casual', hint: 'Relaxed and conversational' },
  { id: 'professional', label: 'Professional', hint: 'Polished, not corporate' },
  { id: 'warm', label: 'Warm', hint: 'Friendly and approachable' },
]

const STRENGTHS: { id: HumanizerStrength; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Small edits, keep most wording' },
  { id: 'balanced', label: 'Balanced', hint: 'Rewrite the stiff sentences' },
  { id: 'full', label: 'Full', hint: 'Rewrite from scratch, same facts' },
]

const PURPOSES: { id: HumanizerPurpose; label: string }[] = [
  { id: 'auto', label: 'Anything' },
  { id: 'email', label: 'Email' },
  { id: 'social', label: 'Social post' },
  { id: 'essay', label: 'Essay' },
  { id: 'note', label: 'Message' },
]

const LENGTHS: { id: HumanizerLength; label: string }[] = [
  { id: 'same', label: 'Same' },
  { id: 'tighter', label: 'Tighter' },
]

const EXAMPLE = `Our team recently completed a comprehensive review of the new checkout flow. Over the course of three weeks, we tested five variants and analyzed more than 1,200 sessions. The data clearly demonstrates that the streamlined three-step flow reduces friction and improves conversion. However, it is important to note that the current implementation does not surface shipping costs until the final screen. Two customers abandoned their carts during the pilot, and one described the experience as a bait-and-switch. Ultimately, we need to decide by Friday whether to ship the shorter flow or retain the existing flow and improve the cost display.`

const selectClass =
  'h-9 rounded-control border border-line-strong bg-surface px-2.5 text-[13.5px] text-fg focus:border-accent/60 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:opacity-50'

function wordsIn(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function Humanizer() {
  const [text, setText] = useState('')
  const [tone, setTone] = useState<HumanizerTone>('natural')
  const [strength, setStrength] = useState<HumanizerStrength>('balanced')
  const [purpose, setPurpose] = useState<HumanizerPurpose>('auto')
  const [length, setLength] = useState<HumanizerLength>('same')
  const [voice, setVoice] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [output, setOutput] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const humanize = useHumanize()
  const toast = useToast()
  const pending = humanize.isPending
  const draft = text.trim()
  const voiceSample = voice.trim()
  const voiceTooShort = voiceSample.length > 0 && voiceSample.length < HUMANIZER_VOICE_MIN_CHARS
  const usingVoice = voiceSample.length >= HUMANIZER_VOICE_MIN_CHARS
  const tooShort = draft.length > 0 && draft.length < HUMANIZER_MIN_CHARS
  const canRun = draft.length >= HUMANIZER_MIN_CHARS && !voiceTooShort && !pending

  const clearFeedback = () => {
    setOutput('')
    setNotice('')
    setError('')
    setCopied(false)
    humanize.reset()
  }

  const changeText = (value: string) => {
    setText(value)
    clearFeedback()
  }

  const changeTone = (next: HumanizerTone) => {
    if (next === tone) return
    setTone(next)
    clearFeedback()
  }

  const changeStrength = (next: HumanizerStrength) => {
    if (next === strength) return
    setStrength(next)
    clearFeedback()
  }

  const changePurpose = (next: HumanizerPurpose) => {
    if (next === purpose) return
    setPurpose(next)
    clearFeedback()
  }

  const changeLength = (next: HumanizerLength) => {
    if (next === length) return
    setLength(next)
    clearFeedback()
  }

  const changeVoice = (value: string) => {
    setVoice(value)
    clearFeedback()
  }

  const run = async () => {
    if (!canRun) return
    setError('')
    setNotice('')
    setCopied(false)
    setOutput('')
    try {
      const result = await humanize.mutateAsync({
        text: draft,
        tone,
        strength,
        purpose,
        length,
        voice: voiceSample || undefined,
      })
      setOutput(result.text)
      setNotice(result.notice ?? '')
    } catch (cause) {
      const message =
        cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')
          ? 'The rewrite is taking longer than expected. Your draft is safe — try again or shorten it a little.'
          : cause instanceof Error && /failed to fetch|networkerror|load failed/i.test(cause.message)
            ? 'Ink could not be reached. Check your connection and try again.'
            : cause instanceof Error
              ? cause.message
              : 'The rewrite could not be finished. Try again.'
      setError(message)
      toast(message, 'danger')
    }
  }

  const copy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      toast('Rewrite copied')
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      toast('Could not copy the rewrite', 'danger')
    }
  }

  const useAsDraft = () => {
    if (!output) return
    setText(output)
    clearFeedback()
    window.requestAnimationFrame(() => draftRef.current?.focus())
  }

  const loadExample = () => {
    setText(EXAMPLE)
    clearFeedback()
    window.requestAnimationFrame(() => draftRef.current?.focus())
  }

  const clearAll = () => {
    setText('')
    clearFeedback()
    draftRef.current?.focus()
  }

  const clearVoice = () => {
    setVoice('')
    clearFeedback()
  }

  const toneLabel = TONES.find((option) => option.id === tone)?.label ?? 'Natural'
  const strengthLabel = STRENGTHS.find((option) => option.id === strength)?.label ?? 'Balanced'
  const purposeLabel = PURPOSES.find((option) => option.id === purpose)?.label ?? 'Anything'
  const draftWords = wordsIn(text)
  const outputWords = wordsIn(output)
  const voiceWords = wordsIn(voice)

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1160px] px-4 pb-12 pt-5 md:px-8 md:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mt-1 font-display text-[40px] font-medium leading-tight tracking-[-0.03em] md:text-[44px]">Humanizer</h1>
            <p className="mt-2 max-w-[560px] text-[14.5px] leading-relaxed text-muted">
              Paste a draft. Keep your point, names and numbers. Cut the repeated, stiff rhythm.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadExample} disabled={pending}>
            <Sparkles />
            Try an example
          </Button>
        </header>

        <div className="mt-6 rounded-card border border-line bg-surface px-3 py-2.5 shadow-card">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-faint">Tone</span>
              <div role="group" aria-label="Tone" className="flex flex-wrap gap-0.5 rounded-control bg-surface-2 p-0.5">
                {TONES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    aria-pressed={tone === option.id}
                    disabled={pending}
                    onClick={() => changeTone(option.id)}
                    className={cx(
                      'h-8 rounded-[7px] px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] disabled:opacity-50',
                      tone === option.id ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-faint">Rewrite</span>
              <div role="group" aria-label="Rewrite strength" className="flex flex-wrap gap-0.5 rounded-control bg-surface-2 p-0.5">
                {STRENGTHS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    aria-pressed={strength === option.id}
                    disabled={pending}
                    onClick={() => changeStrength(option.id)}
                    className={cx(
                      'h-8 rounded-[7px] px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] disabled:opacity-50',
                      strength === option.id ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="humanizer-purpose" className="text-[12px] font-medium uppercase tracking-[0.1em] text-faint">
                For
              </label>
              <select
                id="humanizer-purpose"
                value={purpose}
                onChange={(event) => changePurpose(event.target.value as HumanizerPurpose)}
                disabled={pending}
                className={selectClass}
              >
                {PURPOSES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="humanizer-length" className="text-[12px] font-medium uppercase tracking-[0.1em] text-faint">
                Length
              </label>
              <select
                id="humanizer-length"
                value={length}
                onChange={(event) => changeLength(event.target.value as HumanizerLength)}
                disabled={pending}
                className={selectClass}
              >
                {LENGTHS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <button
            type="button"
            aria-expanded={voiceOpen}
            aria-controls="humanizer-voice"
            disabled={pending}
            onClick={() => setVoiceOpen((open) => !open)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-surface-2 text-muted">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                Sound like me
                {usingVoice ? (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-medium text-success">Using sample</span>
                ) : voiceTooShort ? (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11.5px] font-medium text-warning">Too short</span>
                ) : (
                  <span className="text-[11.5px] font-normal text-faint">Optional</span>
                )}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-faint">
                Paste something you actually wrote. The rewrite borrows its rhythm and vocabulary.
              </span>
            </span>
            <ChevronDown className={cx('size-4 shrink-0 text-faint transition-transform', voiceOpen && 'rotate-180')} />
          </button>
          {voiceOpen ? (
            <div id="humanizer-voice" className="border-t border-line px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="humanizer-voice-text" className="text-[12px] font-medium">
                  Your writing sample
                </label>
                <span className="text-[11px] text-faint">
                  {voiceWords} {voiceWords === 1 ? 'word' : 'words'} · {voice.length.toLocaleString()} / {HUMANIZER_VOICE_MAX_CHARS.toLocaleString()}
                </span>
              </div>
              <textarea
                id="humanizer-voice-text"
                value={voice}
                onChange={(event) => changeVoice(event.target.value)}
                maxLength={HUMANIZER_VOICE_MAX_CHARS}
                rows={4}
                placeholder="Paste a few paragraphs of your own writing—an email, a post, anything in your natural voice…"
                className="mt-2 w-full resize-y rounded-control border border-line-strong bg-surface-2/40 px-3 py-2 text-[13px] leading-6 text-fg outline-none placeholder:text-faint focus:border-fg/40 focus:ring-[3px] focus:ring-fg/8 disabled:opacity-60"
              />
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                <p className="text-[11.5px] leading-relaxed text-faint">
                  About 200 words is plenty. Style reference only; it is sent with this rewrite and is not saved.
                </p>
                {voice ? (
                  <button
                    type="button"
                    onClick={clearVoice}
                    className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
                  >
                    Clear sample
                  </button>
                ) : null}
              </div>
              {voiceTooShort ? <p className="mt-1 text-[11.5px] text-warning">Add a little more, or clear the sample to rewrite.</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.03fr)_minmax(0,0.97fr)]">
          <section className="flex min-h-[360px] flex-col rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="humanizer-draft" className="text-[12.5px] font-medium">
                Your draft
              </label>
              <span className="text-[11.5px] text-faint">
                {draftWords} {draftWords === 1 ? 'word' : 'words'}
              </span>
            </div>
            <textarea
              id="humanizer-draft"
              ref={draftRef}
              value={text}
              onChange={(event) => changeText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              disabled={pending}
              maxLength={HUMANIZER_MAX_CHARS}
              placeholder="Paste the paragraph, email or post you want to make sound more human…"
              spellCheck
              className="mt-3 min-h-[240px] w-full flex-1 resize-none bg-transparent text-[14.5px] leading-7 text-fg outline-none placeholder:text-faint disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div>
                <span className={cx('text-[11.5px]', text.length >= HUMANIZER_MAX_CHARS ? 'text-warning' : 'text-faint')}>
                  {text.length.toLocaleString()} / {HUMANIZER_MAX_CHARS.toLocaleString()}
                </span>
                {tooShort ? <span className="ml-2 text-[11.5px] text-faint">A little more text, please.</span> : null}
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={pending || !text}
                className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </section>

          <section
            aria-live="polite"
            aria-busy={pending}
            className="flex min-h-[360px] flex-col rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-accent text-bg">
                  <PenLine className="size-3.5" />
                </span>
                <div>
                  <p className="text-[12.5px] font-medium">Rewritten</p>
                  <p className="text-[11px] text-faint">
                    {pending ? 'Working on it…' : output ? `${outputWords} words` : 'Ready when you are'}
                  </p>
                </div>
              </div>
              {output ? (
                <Button variant="ghost" size="sm" onClick={() => void copy()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              ) : null}
            </div>

            {pending ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <Loader2 className="size-5 animate-spin text-faint" />
                <p className="mt-3 text-[13px] font-medium">Finding a more human rhythm</p>
                <p className="mt-1 max-w-[250px] text-[12px] leading-relaxed text-faint">
                  This rewrite can take a few seconds. A final check catches stock phrasing.
                </p>
              </div>
            ) : output ? (
              <>
                <div className="mt-4 flex-1">
                  <p className="whitespace-pre-wrap text-[14px] leading-7 text-fg">{output}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[11.5px] text-faint">
                    {toneLabel} · {strengthLabel} · {purposeLabel}
                    {length === 'tighter' ? ' · tighter' : ''}
                    {usingVoice ? ' · your voice' : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void run()}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
                    >
                      <RotateCw className="size-3.5" />
                      Another take
                    </button>
                    <button
                      type="button"
                      onClick={useAsDraft}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
                    >
                      Use as draft
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-faint">
                  <PenLine className="size-5" />
                </span>
                <p className="mt-3 text-[13px] font-medium">Your rewrite lands here</p>
                <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-faint">
                  Same meaning, new sentences. You can copy it or use it as a new draft.
                </p>
              </div>
            )}
          </section>
        </div>

        {notice ? (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-control border border-warning/25 bg-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-warning">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={cx('text-[11.5px]', voiceTooShort ? 'text-warning' : 'text-faint')}>
            {voiceTooShort ? 'Finish the writing sample or clear it first.' : 'Ctrl + Enter to rewrite'}
          </p>
          <Button variant="primary" onClick={() => void run()} disabled={!canRun} className="h-10 px-5">
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                Humanizing…
              </>
            ) : (
              <>
                <Sparkles />
                Humanize
                <ArrowRight />
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-faint">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Style only. Check names, numbers, quotes and links before you use it. Your draft and writing sample are sent with this request and are not
            saved.
          </p>
        </div>
      </div>
    </div>
  )
}
