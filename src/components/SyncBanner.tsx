import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isDesktopPinMode } from '../lib/platform'

/** 로그인·복원 상태를 캘린더 등 모든 화면에서 보이게 */
export function SyncBanner() {
  const { syncBanner, dismissSyncBanner, syncing, googleRedirectPending } =
    useAuth()

  if (isDesktopPinMode()) return null
  if (!syncBanner && !syncing && !googleRedirectPending) return null

  const text =
    syncBanner ||
    (googleRedirectPending
      ? 'Google로 이동 중… 돌아오면 데이터를 불러와요.'
      : syncing
        ? '계정 데이터 불러오는 중…'
        : null)

  if (!text) return null

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--pin)]/25 bg-[var(--main-soft)] px-4 py-2 text-[12px] font-semibold text-[var(--pin-text)]"
    >
      <p className="min-w-0 flex-1 leading-snug">{text}</p>
      {!syncing && !googleRedirectPending && (
        <button
          type="button"
          onClick={dismissSyncBanner}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/80 hover:text-[var(--ink)]"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
