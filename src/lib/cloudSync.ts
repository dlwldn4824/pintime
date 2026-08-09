import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import {
  loadRoomSession,
  saveRoomSession,
  type RoomSession,
} from './session'
import {
  loadCalendar,
  loadMyName,
  loadMyRooms,
  loadRoom,
  saveCalendar,
  saveMyName,
  replaceMyRooms,
  saveRoom,
  setBoundUserId,
  type CalendarState,
  type MyRoomRef,
} from './storage'
import { loadTodos, saveTodos, type TodoState } from './todos'
import type { ShareRoom } from '../types'
import { normalizeRoom } from '../types'

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

export type CloudRoomsDoc = {
  refs: MyRoomRef[]
  rooms: ShareRoom[]
  sessions: Record<string, RoomSession>
  updatedAt: number
}

export type CloudProfileDoc = {
  displayName?: string
  email?: string | null
  updatedAt?: number
  createdAt?: number
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
  return Boolean(state && (state.schedules.length > 0 || state.allDay.length > 0))
}

function hasTodoData(state: TodoState | null | undefined) {
  return Boolean(state && state.items.length > 0)
}

function hasRoomsData(doc: CloudRoomsDoc | null | undefined) {
  return Boolean(doc && (doc.rooms.length > 0 || doc.refs.length > 0))
}

function collectLocalRooms(): CloudRoomsDoc {
  const refs = loadMyRooms()
  const rooms: ShareRoom[] = []
  const sessions: Record<string, RoomSession> = {}
  for (const ref of refs) {
    const room = loadRoom(ref.id)
    if (room) rooms.push(room)
    const session = loadRoomSession(ref.id)
    if (session) sessions[ref.id] = session
  }
  return { refs, rooms, sessions, updatedAt: Date.now() }
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

/** 캘린더/할 일 전체 삭제 시 — 빈 상태도 클라우드에 반영 */
let forceEmptyCalendarPush = false
let forceEmptyTodosPush = false

export function allowNextEmptyCalendarPush() {
  forceEmptyCalendarPush = true
}

export function allowNextEmptyTodosPush() {
  forceEmptyTodosPush = true
}

export async function pushCalendar(uid: string, state: CalendarState) {
  const ref = calendarRef(uid)
  if (!ref) return

  // 빈 데이터로 클라우드에 이미 있는 일정을 지우지 않음 (기기 초기화·레이스 방지)
  if (!hasCalendarData(state) && !forceEmptyCalendarPush) {
    const snap = await getDoc(ref)
    if (snap.exists() && hasCalendarData(snap.data() as CloudCalendarDoc)) {
      return
    }
  }
  forceEmptyCalendarPush = false

  await setDoc(ref, { ...state, updatedAt: Date.now() })
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

  await setDoc(ref, { ...state, updatedAt: Date.now() })
}

export async function pushRooms(uid: string, docData?: CloudRoomsDoc) {
  const ref = roomsRef(uid)
  if (!ref) return
  const payload = docData ?? collectLocalRooms()
  await setDoc(ref, { ...payload, updatedAt: Date.now() })
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

function applyCalendarLocal(state: CalendarState) {
  APPLYING_REMOTE.calendar = true
  try {
    saveCalendar(state)
    window.dispatchEvent(new CustomEvent(CAL_EVENT, { detail: state }))
  } finally {
    window.setTimeout(() => {
      APPLYING_REMOTE.calendar = false
    }, 1200)
  }
}

function applyTodosLocal(state: TodoState) {
  APPLYING_REMOTE.todos = true
  try {
    saveTodos(state)
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
    const sessions =
      data.sessions && typeof data.sessions === 'object' ? data.sessions : {}

    for (const raw of rooms) {
      try {
        const room = normalizeRoom(raw)
        saveRoom(room)
      } catch {
        /* skip bad room */
      }
    }

    replaceMyRooms(refs.filter((r) => r?.id))

    for (const [roomId, session] of Object.entries(sessions)) {
      if (session?.name) saveRoomSession(roomId, session)
    }

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
export async function bootstrapCloudSync(uid: string): Promise<{
  unsub: () => void
}> {
  if (!isFirebaseConfigured()) {
    return { unsub: () => undefined }
  }

  bootstrapping = true
  setCloudSyncUid(uid)
  setBoundUserId(uid)

  const cRef = calendarRef(uid)
  const tRef = todosRef(uid)
  const rRef = roomsRef(uid)
  const pRef = profileRef(uid)
  if (!cRef || !tRef || !rRef) {
    bootstrapping = false
    return { unsub: () => undefined }
  }

  try {
    const localCal = loadCalendar() ?? { schedules: [], allDay: [] }
    const localTodos = loadTodos()
    const localRooms = collectLocalRooms()
    const localRoomsAt = Math.max(
      0,
      ...localRooms.refs.map((r) => r.updatedAt || 0),
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

    // 이름: 클라우드 또는 로컬 → 양방향
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
      0,
    )
    if (calSide === 'local') {
      await pushCalendar(uid, localCal)
    } else if (calSide === 'remote' && remoteCal) {
      applyCalendarLocal({
        schedules: Array.isArray(remoteCal.schedules) ? remoteCal.schedules : [],
        allDay: Array.isArray(remoteCal.allDay) ? remoteCal.allDay : [],
      })
    }

    const todoSide = pickSide(
      hasTodoData(remoteTodos ?? undefined),
      hasTodoData(localTodos),
      remoteTodos?.updatedAt ?? 0,
      0,
    )
    if (todoSide === 'local') {
      await pushTodos(uid, localTodos)
    } else if (todoSide === 'remote' && remoteTodos) {
      applyTodosLocal({
        items: Array.isArray(remoteTodos.items) ? remoteTodos.items : [],
      })
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
        sessions:
          remoteRooms.sessions && typeof remoteRooms.sessions === 'object'
            ? remoteRooms.sessions
            : {},
        updatedAt: remoteRooms.updatedAt ?? Date.now(),
      })
    }
  } finally {
    // React state 반영 여유
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
      applyCalendarLocal(next)
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
      applyTodosLocal(next)
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
        sessions:
          data.sessions && typeof data.sessions === 'object'
            ? data.sessions
            : {},
        updatedAt: data.updatedAt ?? 0,
      }
      const local = collectLocalRooms()
      if (
        JSON.stringify(local.refs) === JSON.stringify(next.refs) &&
        JSON.stringify(local.rooms) === JSON.stringify(next.rooms)
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
