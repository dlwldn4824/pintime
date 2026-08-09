import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  claimExclusivePicker,
  onExclusivePickerClaim,
} from '../lib/exclusivePicker'
import { parseDateKey, toDateKey, weekdayOfDateKey } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function formatDateKorean(dateKey: string): string {
  const d = parseDateKey(dateKey)
  const wd = weekdayOfDateKey(dateKey)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number; inMonth: boolean }> = []
  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, 1 - (startPad - i))
    cells.push({ key: toDateKey(d), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day)
    cells.push({ key: toDateKey(d), day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = parseDateKey(cells[cells.length - 1].key)
    last.setDate(last.getDate() + 1)
    cells.push({
      key: toDateKey(last),
      day: last.getDate(),
      inMonth: false,
    })
  }
  return cells
}

type DateSelectProps = {
  value: string
  min?: string
  onChange: (dateKey: string) => void
  'aria-label'?: string
}

/** 커스텀 월간 팝오버 — 날짜 선택 즉시 닫힘 */
export function DateSelect({
  value,
  min,
  onChange,
  'aria-label': ariaLabel = '날짜 선택',
}: DateSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = parseDateKey(value)
  const [cursor, setCursor] = useState({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  })

  useEffect(() => {
    if (!open) return
    const d = parseDateKey(value)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }, [open, value])

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

  const cells = useMemo(
    () => buildCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )
  const todayKey = toDateKey(new Date())
  const monthLabel = `${cursor.year}년 ${cursor.month + 1}월`

  const pick = (key: string) => {
    if (min && key < min) return
    onChange(key)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--pin)]/40 hover:bg-white"
      >
        {formatDateKorean(value)}
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label={ariaLabel}
          className="absolute top-full right-0 z-[60] mt-1.5 w-[17.5rem] rounded-xl border border-[var(--line)] bg-white p-3 shadow-lg shadow-slate-900/12"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <p className="text-xs font-bold text-[var(--ink)]">{monthLabel}</p>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => {
                  const d = new Date(cursor.year, cursor.month - 1, 1)
                  setCursor({ year: d.getFullYear(), month: d.getMonth() })
                }}
                className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="오늘"
                onClick={() => {
                  const n = new Date()
                  setCursor({ year: n.getFullYear(), month: n.getMonth() })
                  if (!min || todayKey >= min) pick(todayKey)
                }}
                className="h-2 w-2 rounded-full bg-[var(--muted)]/50 hover:bg-[var(--tomato)]"
              />
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => {
                  const d = new Date(cursor.year, cursor.month + 1, 1)
                  setCursor({ year: d.getFullYear(), month: d.getMonth() })
                }}
                className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-medium text-[var(--muted)]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const selected = c.key === value
              const isToday = c.key === todayKey
              const disabled = Boolean(min && c.key < min)
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(c.key)}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    selected
                      ? 'bg-[var(--tomato)] text-white'
                      : disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : c.inMonth
                          ? isToday
                            ? 'text-[var(--tomato)] hover:bg-[var(--main-soft)]'
                            : 'text-[var(--ink)] hover:bg-[var(--bg)]'
                          : 'text-slate-300 hover:bg-[var(--bg)]'
                  }`}
                >
                  {c.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
