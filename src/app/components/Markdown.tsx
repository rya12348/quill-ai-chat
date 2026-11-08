import { Check, Copy } from 'lucide-react'
import { memo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Assistant replies are Markdown. Links open in a new tab and never carry a
// referrer; raw HTML is not rendered (react-markdown's default), so model
// output cannot inject markup; images are shown as their alt text rather than
// fetched from wherever the model pointed.

type Node = { type?: string; value?: string; children?: Node[] }

function textOf(node: Node | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function CodeBlock({ node, children, ...rest }: ComponentPropsWithoutRef<'pre'> & { node?: Node }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(node).replace(/\n$/, ''))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="group relative">
      <pre {...rest}>{children}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-[8px] bg-white/10 text-white/70 opacity-0 transition-[opacity,background-color] hover:bg-white/20 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 [&_svg]:size-3.5"
      >
        {copied ? <Check /> : <Copy />}
      </button>
    </div>
  )
}

const components: Components = {
  pre: CodeBlock as Components['pre'],
  img: ({ alt }: { alt?: string }) => <span className="text-muted">{alt ? `[${alt}]` : '[image]'}</span>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    const safe = href && /^(https?:|mailto:)/i.test(href) ? href : undefined
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    )
  },
}

export const Markdown = memo(function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
