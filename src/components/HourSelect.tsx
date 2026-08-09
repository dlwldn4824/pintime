import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  claimExclusivePicker,
  onExclusivePickerClaim,
} from '../lib/exclusivePicker'

export function formatHourKorean(hour: number): string {
  if (hour === 0) return '오전 12:00'
  if (hour === 12) return '오후 12:00'
  if (hour < 12) return `오전 ${hour}:00`
  return `오후 ${hour - 12}:00`
}

type HourSelectProps = {
  value: number
  options: number[]
  onChange: (hour: number) => void
  className?: string
  'aria-label'?: string
}

/** 네이티브 select 대신 PinTime 톤의 시간 드롭다운 */
export function HourSelect({
  value,
  options,
  onChange,
  className = '',
  'aria-label': ariaLabel = '시간 선택',
}: HourSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  useEffect(() => {
    return onExclusivePickerClaim(listId, () => setOpen(false))
  }, [listId])

  useEffect(() => {
    if (!open) return
    claimExclusivePicker(listId)
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, listId])

  useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>(
      '[data-active="true"]',
    )
    active?.scrollIntoView({ block: 'nearest' })
  }, [open, value])

  const label = formatHourKorean(value)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[7.5rem] items-center justify-between gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--pin)]/40 hover:bg-white"
      >
        <span>{label}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full right-0 z-50 mt-1.5 max-h-56 w-[9.5rem] overflow-y-auto rounded-xl border border-[var(--line)] bg-white py-1 shadow-lg shadow-slate-900/10"
        >
          {options.map((h) => {
            const selected = h === value
            return (
              <li key={h} role="option" aria-selected={selected}>
                <button
                  type="button"
                  data-active={selected ? 'true' : undefined}
                  onClick={() => {
                    onChange(h)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-xs font-semibold transition ${
                    selected
                      ? 'bg-[var(--main-soft)] text-[var(--tomato)]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatHourKorean(h)}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
