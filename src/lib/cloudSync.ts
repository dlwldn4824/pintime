import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ShareRoom } from '../types'
import { normalizeRoom } from '../types'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import {
  loadCalendar,
  loadCalendarLocalAt,
  loadMyName,
  loadMyRooms,
  loadRoom,
  prepareAccountSwitch,
  replaceMyRooms,
  saveCalendar,
  saveMyName,
  saveRoom,
  setBoundUserId,
  setCalendarLocalAt,
  type CalendarState,
  type MyRoomRef,
} from './storage'
import {
  loadTodos,
  loadTodosLocalAt,
  saveTodos,
  setTodosLocalAt,
  type TodoState,
} from './todos'

const CAL_EVENT = 'pintime:calendar'
const ROOMS_EVENT = 'pintime:rooms'
const APPLYING_REMOTE = {
  calendar: false,
  todos: false,
  rooms: false,
}

/** 로그인 직후 이관 중 — 빈 로컬이 클라우드를 덮지 않게 */
let bootstrapping = false

export type CloudDocMeta = { updatedAt: number }

export type CloudCalendarDoc = CalendarState & CloudDocMeta
export type CloudTodosDoc = TodoState & CloudDocMeta

/** sessions는 로컬 전용 — 클라우드에는 비밀번호를 올리지 않음 */
export type CloudRoomsDoc = {
  refs: MyRoomRef[]
  rooms: ShareRoom[]
  sessions?: Record<string, never>
  updatedAt: number
}

export type CloudProfileDoc = {
  displayName?: string
  email?: string | null
  updatedAt?: number
  createdAt?: number
}

export type BootstrapSyncResult = {
  unsub: () => void
  restored: {
    calendar: boolean
    todos: boolean
    rooms: boolean
  }
  hadRemoteData: boolean
  accountSwitched: boolean
}

function calendarRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid, 'data', 'calendar')
}

function todosRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid, 'data', 'todos')
}

function roomsRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid, 'data', 'rooms')
}

function profileRef(uid: string) {
  const db = getFirestoreDb()
  if (!db) return null
  return doc(db, 'users', uid)
}

function hasCalendarData(state: CalendarState | null | undefined) {
  return Boolean(
    state && (state.schedules.length > 0 || state.allDay.length > 0),
  )
}

function hasTodoData(state: TodoState | null | undefined) {
  return Boolean(state && state.items.length > 0)
}

function hasRoomsData(docData: CloudRoomsDoc | null | undefined) {
  return Boolean(
    docData && (docData.rooms.length > 0 || docData.refs.length > 0),
  )
}

/** 참가자 비밀번호 제거 후 클라우드용 방 문서 구성 */
function redactRoomForCloud(room: ShareRoom): ShareRoom {
  return {
    ...room,
    participants: (room.participants ?? []).map((p) => ({
      ...p,
      password: '',
    })),
  }
}

function collectLocalRoomsForCloud(): CloudRoomsDoc {
  const refs = loadMyRooms()
  const rooms: ShareRoom[] = []
  for (const ref of refs) {
    const room = loadRoom(ref.id)
    if (room) rooms.push(redactRoomForCloud(room))
  }
  return { refs, rooms, updatedAt: Date.now() }
}

export function isApplyingRemoteCalendar() {
  return APPLYING_REMOTE.calendar || bootstrapping
}

export function isApplyingRemoteTodos() {
  return APPLYING_REMOTE.todos || bootstrapping
}

export function isApplyingRemoteRooms() {
  return APPLYING_REMOTE.rooms || bootstrapping
}

/** 캘린더/할 일/방 전체 삭제 시 — 빈 상태도 클라우드에 반영 */
let forceEmptyCalendarPush = false
let forceEmptyTodosPush = false
let forceEmptyRoomsPush = false

export function allowNextEmptyCalendarPush() {
  forceEmptyCalendarPush = true
}

export function allowNextEmptyTodosPush() {
  forceEmptyTodosPush = true
}

export function allowNextEmptyRoomsPush() {
  forceEmptyRoomsPush = true
}

export async function pushCalendar(uid: string, state: CalendarState) {
  const ref = calendarRef(uid)
  if (!ref) return

  if (!hasCalendarData(state) && !forceEmptyCalendarPush) {
    const snap = await getDoc(ref)
    if (snap.exists() && hasCalendarData(snap.data() as CloudCalendarDoc)) {
      return
    }
  }
  forceEmptyCalendarPush = false

  const updatedAt = Date.now()
  await setDoc(ref, { ...state, updatedAt })
  setCalendarLocalAt(updatedAt)
}

export async function pushTodos(uid: string, state: TodoState) {
  const ref = todosRef(uid)
  if (!ref) return

  if (!hasTodoData(state) && !forceEmptyTodosPush) {
    const snap = await getDoc(ref)
    if (snap.exists() && hasTodoData(snap.data() as CloudTodosDoc)) {
      return
    }
  }
  forceEmptyTodosPush = false

  const updatedAt = Date.now()
  await setDoc(ref, { ...state, updatedAt })
  setTodosLocalAt(updatedAt)
}

export async function pushRooms(uid: string, docData?: CloudRoomsDoc) {
  const ref = roomsRef(uid)
  if (!ref) return
  const payload = docData ?? collectLocalRoomsForCloud()
  const redacted: CloudRoomsDoc = {
    refs: payload.refs,
    rooms: payload.rooms.map(redactRoomForCloud),
    updatedAt: Date.now(),
  }

  if (!hasRoomsData(redacted) && !forceEmptyRoomsPush) {
    const snap = await getDoc(ref)
    if (snap.exists() && hasRoomsData(snap.data() as CloudRoomsDoc)) {
      return
    }
  }
  forceEmptyRoomsPush = false

  await setDoc(ref, redacted)
}

export async function pushProfile(
  uid: string,
  data: {
    displayName?: string
    email?: string | null
    createdAt?: number
  },
) {
  const ref = profileRef(uid)
  if (!ref) return
  const payload: Record<string, string | number | null> = {
    displayName: data.displayName ?? '',
    email: data.email ?? null,
    updatedAt: Date.now(),
  }
  if (typeof data.createdAt === 'number') {
    payload.createdAt = data.createdAt
  }
  await setDoc(ref, payload, { merge: true })
}

let calTimer: ReturnType<typeof setTimeout> | null = null
let todoTimer: ReturnType<typeof setTimeout> | null = null
let roomsTimer: ReturnType<typeof setTimeout> | null = null
let activeUid: string | null = null

export function setCloudSyncUid(uid: string | null) {
  activeUid = uid
}

export function schedulePushCalendar(state: CalendarState) {
  if (!activeUid || !isFirebaseConfigured()) return
  if (APPLYING_REMOTE.calendar || bootstrapping) return
  if (calTimer) clearTimeout(calTimer)
  const uid = activeUid
  calTimer = setTimeout(() => {
    void pushCalendar(uid, state).catch(() => undefined)
  }, 500)
}

export function schedulePushTodos(state: TodoState) {
  if (!activeUid || !isFirebaseConfigured()) return
  if (APPLYING_REMOTE.todos || bootstrapping) return
  if (todoTimer) clearTimeout(todoTimer)
  const uid = activeUid
  todoTimer = setTimeout(() => {
    void pushTodos(uid, state).catch(() => undefined)
  }, 500)
}

export function schedulePushRooms() {
  if (!activeUid || !isFirebaseConfigured()) return
  if (APPLYING_REMOTE.rooms || bootstrapping) return
  if (roomsTimer) clearTimeout(roomsTimer)
  const uid = activeUid
  roomsTimer = setTimeout(() => {
    void pushRooms(uid).catch(() => undefined)
  }, 500)
}

function applyCalendarLocal(state: CalendarState, remoteAt?: number) {
  APPLYING_REMOTE.calendar = true
  try {
    saveCalendar(state)
    if (typeof remoteAt === 'number') setCalendarLocalAt(remoteAt)
    window.dispatchEvent(new CustomEvent(CAL_EVENT, { detail: state }))
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.calendar = false
    }, 1200)
  }
}

function applyTodosLocal(state: TodoState, remoteAt?: number) {
  APPLYING_REMOTE.todos = true
  try {
    saveTodos(state)
    if (typeof remoteAt === 'number') setTodosLocalAt(remoteAt)
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.todos = false
    }, 1200)
  }
}

function applyRoomsLocal(data: CloudRoomsDoc) {
  APPLYING_REMOTE.rooms = true
  try {
    const refs = Array.isArray(data.refs) ? data.refs : []
    const rooms = Array.isArray(data.rooms) ? data.rooms : []

    for (const raw of rooms) {
      try {
        const room = normalizeRoom(raw)
        // 클라우드에 비밀번호가 있어도 쓰지 않음
        saveRoom({
          ...room,
          participants: room.participants.map((p) => ({ ...p, password: '' })),
        })
      } catch {
        /* skip bad room */
      }
    }

    replaceMyRooms(refs.filter((r) => r?.id))
    // sessions는 클라우드에서 복원하지 않음 (기기에서 다시 입장)
    window.dispatchEvent(new CustomEvent(ROOMS_EVENT))
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.rooms = false
    }, 1200)
  }
}

function pickSide(
  remoteHas: boolean,
  localHas: boolean,
  remoteAt: number,
  localAt: number,
): 'remote' | 'local' | 'none' {
  if (remoteHas && !localHas) return 'remote'
  if (!remoteHas && localHas) return 'local'
  if (remoteHas && localHas) {
    return remoteAt >= localAt ? 'remote' : 'local'
  }
  return 'none'
}

/** 로그인 직후: 클라우드 → 이 기기 복원(또는 첫 업로드) 후 실시간 구독 */
export async function bootstrapCloudSync(
  uid: string,
): Promise<BootstrapSyncResult> {
  const empty: BootstrapSyncResult = {
    unsub: () => undefined,
    restored: { calendar: false, todos: false, rooms: false },
    hadRemoteData: false,
    accountSwitched: false,
  }

  if (!isFirebaseConfigured()) {
    return empty
  }

  bootstrapping = true
  const accountSwitched = prepareAccountSwitch(uid)
  setCloudSyncUid(uid)
  setBoundUserId(uid)

  const cRef = calendarRef(uid)
  const tRef = todosRef(uid)
  const rRef = roomsRef(uid)
  const pRef = profileRef(uid)
  if (!cRef || !tRef || !rRef) {
    bootstrapping = false
    return { ...empty, accountSwitched }
  }

  const restored = { calendar: false, todos: false, rooms: false }
  let hadRemoteData = false

  try {
    const localCal = loadCalendar() ?? { schedules: [], allDay: [] }
    const localTodos = loadTodos()
    const localRooms = collectLocalRoomsForCloud()
    const localRoomsAt = Math.max(
      0,
      ...localRooms.refs.map((r) => r.updatedAt || 0),
      localRooms.updatedAt || 0,
    )

    const [remoteCalSnap, remoteTodoSnap, remoteRoomsSnap, remoteProfileSnap] =
      await Promise.all([
        getDoc(cRef),
        getDoc(tRef),
        getDoc(rRef),
        pRef ? getDoc(pRef) : Promise.resolve(null),
      ])

    const remoteCal = remoteCalSnap.exists()
      ? (remoteCalSnap.data() as CloudCalendarDoc)
      : null
    const remoteTodos = remoteTodoSnap.exists()
      ? (remoteTodoSnap.data() as CloudTodosDoc)
      : null
    const remoteRooms = remoteRoomsSnap.exists()
      ? (remoteRoomsSnap.data() as CloudRoomsDoc)
      : null
    const remoteProfile =
      remoteProfileSnap && remoteProfileSnap.exists()
        ? (remoteProfileSnap.data() as CloudProfileDoc)
        : null

    hadRemoteData = Boolean(
      hasCalendarData(remoteCal ?? undefined) ||
        hasTodoData(remoteTodos ?? undefined) ||
        hasRoomsData(remoteRooms ?? undefined),
    )

    const cloudName = remoteProfile?.displayName?.trim() || ''
    const localName = loadMyName().trim()
    if (cloudName && !localName) {
      saveMyName(cloudName)
    } else if (localName && !cloudName) {
      await pushProfile(uid, { displayName: localName }).catch(() => undefined)
    } else if (cloudName) {
      saveMyName(cloudName)
    }

    const calSide = pickSide(
      hasCalendarData(remoteCal ?? undefined),
      hasCalendarData(localCal),
      remoteCal?.updatedAt ?? 0,
      loadCalendarLocalAt(),
    )
    if (calSide === 'local') {
      await pushCalendar(uid, localCal)
    } else if (calSide === 'remote' && remoteCal) {
      applyCalendarLocal(
        {
          schedules: Array.isArray(remoteCal.schedules)
            ? remoteCal.schedules
            : [],
          allDay: Array.isArray(remoteCal.allDay) ? remoteCal.allDay : [],
        },
        remoteCal.updatedAt,
      )
      restored.calendar = true
    }

    const todoSide = pickSide(
      hasTodoData(remoteTodos ?? undefined),
      hasTodoData(localTodos),
      remoteTodos?.updatedAt ?? 0,
      loadTodosLocalAt(),
    )
    if (todoSide === 'local') {
      await pushTodos(uid, localTodos)
    } else if (todoSide === 'remote' && remoteTodos) {
      applyTodosLocal(
        {
          items: Array.isArray(remoteTodos.items) ? remoteTodos.items : [],
        },
        remoteTodos.updatedAt,
      )
      restored.todos = true
    }

    const roomsSide = pickSide(
      hasRoomsData(remoteRooms ?? undefined),
      hasRoomsData(localRooms),
      remoteRooms?.updatedAt ?? 0,
      localRoomsAt,
    )
    if (roomsSide === 'local') {
      await pushRooms(uid, localRooms)
    } else if (roomsSide === 'remote' && remoteRooms) {
      applyRoomsLocal({
        refs: Array.isArray(remoteRooms.refs) ? remoteRooms.refs : [],
        rooms: Array.isArray(remoteRooms.rooms) ? remoteRooms.rooms : [],
        updatedAt: remoteRooms.updatedAt ?? Date.now(),
      })
      restored.rooms = true
    }
  } finally {
    window.setTimeout(() => {
      bootstrapping = false
    }, 1500)
  }

  const unsubs: Unsubscribe[] = []

  unsubs.push(
    onSnapshot(cRef, (snap) => {
      if (bootstrapping) return
      if (!snap.exists()) return
      const data = snap.data() as CloudCalendarDoc
      const next: CalendarState = {
        schedules: Array.isArray(data.schedules) ? data.schedules : [],
        allDay: Array.isArray(data.allDay) ? data.allDay : [],
      }
      const local = loadCalendar() ?? { schedules: [], allDay: [] }
      if (
        JSON.stringify(local.schedules) === JSON.stringify(next.schedules) &&
        JSON.stringify(local.allDay) === JSON.stringify(next.allDay)
      ) {
        return
      }
      applyCalendarLocal(next, data.updatedAt)
    }),
  )

  unsubs.push(
    onSnapshot(tRef, (snap) => {
      if (bootstrapping) return
      if (!snap.exists()) return
      const data = snap.data() as CloudTodosDoc
      const next: TodoState = {
        items: Array.isArray(data.items) ? data.items : [],
      }
      const local = loadTodos()
      if (JSON.stringify(local.items) === JSON.stringify(next.items)) return
      applyTodosLocal(next, data.updatedAt)
    }),
  )

  unsubs.push(
    onSnapshot(rRef, (snap) => {
      if (bootstrapping) return
      if (!snap.exists()) return
      const data = snap.data() as CloudRoomsDoc
      const next: CloudRoomsDoc = {
        refs: Array.isArray(data.refs) ? data.refs : [],
        rooms: Array.isArray(data.rooms) ? data.rooms : [],
        updatedAt: data.updatedAt ?? 0,
      }
      const local = collectLocalRoomsForCloud()
      if (
        JSON.stringify(local.refs) === JSON.stringify(next.refs) &&
        JSON.stringify(
          local.rooms.map((r) => ({
            ...r,
            participants: r.participants.map((p) => ({ ...p, password: '' })),
          })),
        ) ===
          JSON.stringify(
            next.rooms.map((r) => ({
              ...r,
              participants: (r.participants ?? []).map((p) => ({
                ...p,
                password: '',
              })),
            })),
          )
      ) {
        return
      }
      applyRoomsLocal(next)
    }),
  )

  return {
    unsub: () => {
      for (const u of unsubs) u()
      setCloudSyncUid(null)
      bootstrapping = false
      if (calTimer) clearTimeout(calTimer)
      if (todoTimer) clearTimeout(todoTimer)
      if (roomsTimer) clearTimeout(roomsTimer)
    },
    restored,
    hadRemoteData,
    accountSwitched,
  }
}

export function onCalendarRemote(
  cb: (state: CalendarState) => void,
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<CalendarState>).detail
    if (detail) cb(detail)
  }
  window.addEventListener(CAL_EVENT, handler)
  return () => window.removeEventListener(CAL_EVENT, handler)
}

export function onRoomsRemote(cb: () => void): () => void {
  const handler = () => cb()
  window.addEventListener(ROOMS_EVENT, handler)
  return () => window.removeEventListener(ROOMS_EVENT, handler)
}
