import type { DiscussionStatus } from '../lib/types'

const STATUS_CONFIG: Record<DiscussionStatus, { label: string; className: string }> = {
  proposal: { label: 'Proposal', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  patch_review: { label: 'Patch Review', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  committed: { label: 'Committed', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  debate: { label: 'Debate', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  unknown: { label: 'Discussion', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

export function StatusBadge({ status }: { status?: DiscussionStatus }) {
  if (!status || status === 'unknown') return null
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
