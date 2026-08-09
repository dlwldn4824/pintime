const EVENT = 'pintime:picker-open'

/** 다른 피커가 열리면 현재 피커를 닫기 위한 단일 채널 */
export function claimExclusivePicker(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id } }))
}

export function onExclusivePickerClaim(
  id: string,
  onForeignOpen: () => void,
): () => void {
  const handler = (e: Event) => {
    const other = (e as CustomEvent<{ id?: string }>).detail?.id
    if (other && other !== id) onForeignOpen()
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
