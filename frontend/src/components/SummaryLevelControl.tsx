export type SummaryLevel = 'brief' | 'detailed' | 'deep'

interface SummaryLevelControlProps {
  level: SummaryLevel
  onChange: (level: SummaryLevel) => void
  hasDetailed: boolean
  hasDeep: boolean
}

export function SummaryLevelControl({ level, onChange, hasDetailed, hasDeep }: SummaryLevelControlProps) {
  const levels: { key: SummaryLevel; label: string; available: boolean }[] = [
    { key: 'brief', label: 'Brief', available: true },
    { key: 'detailed', label: 'Detailed', available: hasDetailed },
    { key: 'deep', label: 'Deep', available: hasDeep },
  ]

  return (
    <div className="segmented-control" role="group" aria-label="Summary depth">
      {levels.map(({ key, label, available }) => (
        <button
          key={key}
          type="button"
          className={level === key ? 'active' : ''}
          disabled={!available}
          onClick={() => available && onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
