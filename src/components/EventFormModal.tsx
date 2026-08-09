import { Pin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { DateSelect } from './DateSelect'
import { EventExtrasBar, type EventExtras } from './EventExtrasBar'
import { HourSelect } from './HourSelect'
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_IDS,
  toneOf,
  type EventColorId,
} from '../lib/eventColors'
import { addDays } from '../types'

export type EventFormValues = {
  title: string
  color: EventColorId
  allDay: boolean
  startDate: string
  endDate: string
  startHour: number
  endHour: number
  extras: EventExtras
}

type EventFormModalProps = {
  open: boolean
  mode?: 'create' | 'edit'
  /** 드래그 → true, 하루 클릭 → false */
  defaultAllDay: boolean
  initialStartDate: string
  initialEndDate: string
  initialTitle?: string
  initialColor?: string
  initialStartHour?: number
  initialEndHour?: number
  initialExtras?: EventExtras
  onCancel: () => void
  onConfirm: (payload: EventFormValues) => void
  onDelete?: () => void
}

const TIME_HOURS = Array.from({ length: 24 }, (_, i) => i)

function asColorId(color?: string): EventColorId {
  if (color && (EVENT_COLOR_IDS as readonly string[]).includes(color)) {
    return color as EventColorId
  }
  return DEFAULT_EVENT_COLOR
}

export function EventFormModal({
  open,
  mode = 'create',
  defaultAllDay,
  initialStartDate,
  initialEndDate,
  initialTitle = '',
  initialColor,
  initialStartHour = 10,
  initialEndHour = 11,
  initialExtras,
  onCancel,
  onConfirm,
  onDelete,
}: EventFormModalProps) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<EventColorId>(DEFAULT_EVENT_COLOR)
  const [allDay, setAllDay] = useState(true)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [startHour, setStartHour] = useState(10)
  const [endHour, setEndHour] = useState(11)
  const [extras, setExtras] = useState<EventExtras>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const showExtras = !allDay && startDate === endDate

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setColor(asColorId(initialColor))
    setAllDay(defaultAllDay)
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
    setStartHour(initialStartHour)
    setEndHour(initialEndHour)
    setExtras(initialExtras ?? {})
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [
    open,
    mode,
    defaultAllDay,
    initialStartDate,
    initialEndDate,
    initialTitle,
    initialColor,
    initialStartHour,
    initialEndHour,
    initialExtras,
  ])

  useEffect(() => {
    if (!open || showExtras) return
    setExtras((prev) => {
      if (
        !prev.repeat &&
        !prev.repeatUntil &&
        !prev.location &&
        !prev.link &&
        !prev.memo
      ) {
        return prev
      }
      return {}
    })
  }, [open, showExtras])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (endDate < startDate) return false
    if (allDay) return true
    if (startDate < endDate) return true
    return endHour > startHour
  }, [title, allDay, startDate, endDate, startHour, endHour])

  if (!open) return null

  const accent = toneOf(color)

  const submit = () => {
    if (!canSubmit) return
    let nextEnd = endDate < startDate ? startDate : endDate
    let nextEndHour = endHour
    if (!allDay && startDate === nextEnd && nextEndHour <= startHour) {
      nextEnd = addDays(startDate, 1)
      nextEndHour = startHour === 23 ? 0 : nextEndHour
    }
    onConfirm({
      title: title.trim(),
      color,
      allDay,
      startDate,
      endDate: nextEnd,
      startHour,
      endHour: nextEndHour,
      extras: showExtras ? extras : {},
    })
  }

  const endHourOptions =
    startDate === endDate
      ? TIME_HOURS.filter((h) => h > startHour)
      : TIME_HOURS

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--ink)]/20 px-3 pb-3 backdrop-blur-[3px] sm:items-center sm:pb-0"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl shadow-[var(--ink)]/15"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* PinTime: 상단 핀 스트립 (타임트리형 흰 카드와 차별) */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            background: `linear-gradient(135deg, ${accent.soft} 0%, var(--bg) 70%)`,
          }}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm"
            style={{ background: accent.solid, color: '#fff' }}
          >
            <Pin size={15} strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-[var(--muted)]">
              PinTime
            </p>
            <h2 className="text-sm font-bold text-[var(--ink)]">
              {mode === 'edit' ? '일정 수정' : '새 일정'}
            </h2>
          </div>
        </div>

        <div className="space-y-4 px-4 pt-4 pb-4">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="일정 제목"
            className="w-full border-0 border-b-2 border-[var(--line)] bg-transparent px-0.5 py-2 text-base font-semibold text-[var(--ink)] outline-none transition placeholder:font-medium placeholder:text-[var(--muted)] focus:border-[var(--tomato)]"
          />

          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--ink)]">종일</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              onClick={() => setAllDay((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                allDay ? '' : 'bg-slate-200'
              }`}
              style={allDay ? { background: 'var(--tomato)' } : undefined}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  allDay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-[3rem_1fr] items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5">
              <span className="text-xs font-bold text-[var(--tomato)]">시작</span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <DateSelect
                  aria-label="시작 날짜"
                  value={startDate}
                  onChange={(v) => {
                    setStartDate(v)
                    if (endDate < v) setEndDate(v)
                  }}
                />
                {!allDay && (
                  <HourSelect
                    aria-label="시작 시간"
                    value={startHour}
                    options={TIME_HOURS}
                    onChange={(v) => {
                      setStartHour(v)
                      if (startDate === endDate && endHour <= v) {
                        if (v < 23) setEndHour(v + 1)
                        else setEndDate(addDays(startDate, 1))
                      }
                    }}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-[3rem_1fr] items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5">
              <span className="text-xs font-bold text-[var(--pin-text)]">종료</span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <DateSelect
                  aria-label="종료 날짜"
                  value={endDate}
                  min={startDate}
                  onChange={(v) => setEndDate(v < startDate ? startDate : v)}
                />
                {!allDay && (
                  <HourSelect
                    aria-label="종료 시간"
                    value={endHour}
                    options={endHourOptions.length > 0 ? endHourOptions : [0]}
                    onChange={setEndHour}
                  />
                )}
              </div>
            </div>
          </div>

          <ColorPicker value={color} onChange={setColor} />

          {showExtras && (
            <EventExtrasBar
              value={extras}
              onChange={setExtras}
              repeatAnchorDate={startDate}
              accentColor={color}
            />
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
              >
                삭제
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--bg)]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="rounded-xl bg-[var(--tomato)] px-4 py-2 text-sm font-bold text-white shadow-sm shadow-[var(--tomato)]/25 transition hover:bg-[var(--tomato-deep)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {mode === 'edit' ? '저장' : '등록'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
