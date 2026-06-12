import { Link } from 'react-router-dom'
import type { CommitfestTag } from '../lib/types'

function getCommitfestTagStyle(color: string | null): React.CSSProperties {
  if (!color) {
    return { backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }
  }
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  const textColor = brightness > 128 ? '#000000' : '#ffffff'
  const borderColor = brightness > 128 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'
  return { backgroundColor: color, color: textColor, borderColor }
}

// Deterministic color per AI tag name so the same tag always renders the same.
const AI_TAG_PALETTE = [
  'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30',
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',
]

function aiTagClasses(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AI_TAG_PALETTE[Math.abs(hash) % AI_TAG_PALETTE.length]
}

interface TagChipProps {
  tag: string | CommitfestTag
  source: 'commitfest' | 'ai'
  clickable?: boolean
}

export function TagChip({ tag, source, clickable = true }: TagChipProps) {
  const name = typeof tag === 'string' ? tag : tag.name
  const color = typeof tag === 'string' ? null : tag.color

  const className =
    source === 'commitfest' ? 'tag-chip' : `tag-chip ${aiTagClasses(name)}`
  const style = source === 'commitfest' ? getCommitfestTagStyle(color) : undefined
  const title = source === 'commitfest' ? 'Commitfest tag' : 'AI-generated tag'

  if (clickable) {
    return (
      <Link
        to={`/archive?tag=${encodeURIComponent(name)}`}
        className={`${className} hover:opacity-80 transition-opacity`}
        style={style}
        title={title}
      >
        {name}
      </Link>
    )
  }

  return (
    <span className={className} style={style} title={title}>
      {name}
    </span>
  )
}
