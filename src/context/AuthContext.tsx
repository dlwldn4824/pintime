import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { bootstrapCloudSync, pushProfile } from '../lib/cloudSync'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import {
  clearAllPinTimeData,
  clearLastAuthUid,
  saveMyName,
} from '../lib/storage'

const AUTH_REDIRECT_KEY = 'pintime:auth-redirect'

type AuthContextValue = {
  configured: boolean
  user: User | null
  loading: boolean
  syncing: boolean
  syncError: string | null
  syncBanner: string | null
  googleRedirectPending: boolean
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>
  signOut: (opts?: { clearLocal?: boolean }) => Promise<void>
  dismissSyncBanner: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Firebase Auth 에러 → 사용자용 한글 메시지 */
export function firebaseAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : ''
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (/Database is closing|closing\/hidden|IDBDatabase/i.test(msg)) {
    return '구글 로그인 창 때문에 잠시 끊겼어요. 다시 한 번 눌러 주세요.'
  }
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요. 로그인 해 보세요.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않아요.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 맞지 않아요.'
    case 'auth/too-many-requests':
      return '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
    case 'auth/popup-closed-by-user':
      return '구글 로그인 창이 닫혔어요.'
    case 'auth/operation-not-allowed':
      return '이메일 가입 또는 Google 로그인이 아직 켜지지 않았어요.'
    case 'auth/unauthorized-domain':
      return '이 앱 주소가 아직 허용되지 않았어요. Firebase 승인 도메인에 localhost와 127.0.0.1을 추가해 주세요.'
    default:
      return err instanceof Error ? err.message : '인증에 실패했어요'
  }
}

function syncErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (/permission-denied|Missing or insufficient/i.test(msg)) {
    return '클라우드 저장 권한이 없어요. 잠시 후 다시 로그인해 보세요.'
  }
  if (/unavailable|network|Failed to fetch/i.test(msg)) {
    return '네트워크 오류로 동기화하지 못했어요.'
  }
  return msg || '클라우드 동기화에 실패했어요'
}

function buildRestoreBanner(boot: {
  restored: { calendar: boolean; todos: boolean; rooms: boolean }
  hadRemoteData: boolean
}): string {
  const parts: string[] = []
  if (boot.restored.calendar) parts.push('일정')
  if (boot.restored.todos) parts.push('할 일')
  if (boot.restored.rooms) parts.push('공유 방')
  if (parts.length > 0) {
    return `복원 완료 · ${parts.join(' · ')}`
  }
  if (!boot.hadRemoteData) {
    return '로그인됨 · 아직 클라우드에 저장된 일정이 없어요. 여기서 만든 내용이 계정에 저장돼요.'
  }
  return '로그인됨 · 계정과 동기화됐어요'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncBanner, setSyncBanner] = useState<string | null>(null)
  const [googleRedirectPending, setGoogleRedirectPending] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_REDIRECT_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismissSyncBanner = useCallback(() => setSyncBanner(null), [])

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }

    let unsubCloud: (() => void) | undefined
    let bannerTimer: ReturnType<typeof setTimeout> | undefined

    void getRedirectResult(auth)
      .then(() => {
        try {
          sessionStorage.removeItem(AUTH_REDIRECT_KEY)
        } catch {
          /* ignore */
        }
        setGoogleRedirectPending(false)
      })
      .catch((err: unknown) => {
        try {
          sessionStorage.removeItem(AUTH_REDIRECT_KEY)
        } catch {
          /* ignore */
        }
        setGoogleRedirectPending(false)
        setSyncError(firebaseAuthErrorMessage(err))
        setSyncBanner(firebaseAuthErrorMessage(err))
      })

    const unsubAuth = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
      unsubCloud?.()
      unsubCloud = undefined
      setSyncError(null)

      if (!next) {
        setSyncing(false)
        return
      }

      if (next.displayName) saveMyName(next.displayName)

      setSyncing(true)
      setSyncBanner('계정 데이터 불러오는 중…')
      void bootstrapCloudSync(next.uid)
        .then(async (boot) => {
          unsubCloud = boot.unsub
          await pushProfile(next.uid, {
            displayName: next.displayName ?? '',
            email: next.email,
          }).catch(() => undefined)
          const banner = buildRestoreBanner(boot)
          setSyncBanner(banner)
          if (bannerTimer) clearTimeout(bannerTimer)
          bannerTimer = setTimeout(() => setSyncBanner(null), 5000)
        })
        .catch((err: unknown) => {
          const message = syncErrorMessage(err)
          setSyncError(message)
          setSyncBanner(message)
        })
        .finally(() => setSyncing(false))
    })

    return () => {
      unsubAuth()
      unsubCloud?.()
      if (bannerTimer) clearTimeout(bannerTimer)
    }
  }, [configured])

  const signInGoogle = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('계정 서버가 연결되지 않았어요')
    try {
      sessionStorage.setItem(AUTH_REDIRECT_KEY, '1')
    } catch {
      /* ignore */
    }
    setGoogleRedirectPending(true)
    setSyncBanner('Google로 이동 중… 돌아오면 데이터를 불러와요.')
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
  }, [])

  const signInEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('계정 서버가 연결되지 않았어요')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signUpEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('계정 서버가 연결되지 않았어요')

      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )

      const name = displayName?.trim() || ''
      if (name) {
        await updateProfile(cred.user, { displayName: name })
        saveMyName(name)
        await cred.user.reload()
      }

      await pushProfile(cred.user.uid, {
        displayName: name || cred.user.displayName || '',
        email: cred.user.email,
        createdAt: Date.now(),
      })

      setUser(auth.currentUser)
    },
    [],
  )

  const signOut = useCallback(async (opts?: { clearLocal?: boolean }) => {
    const auth = getFirebaseAuth()
    if (!auth) return
    await firebaseSignOut(auth)
    if (opts?.clearLocal) {
      clearAllPinTimeData()
      clearLastAuthUid()
    }
  }, [])

  const value = useMemo(
    () => ({
      configured,
      user,
      loading,
      syncing,
      syncError,
      syncBanner,
      googleRedirectPending,
      signInGoogle,
      signInEmail,
      signUpEmail,
      signOut,
      dismissSyncBanner,
    }),
    [
      configured,
      user,
      loading,
      syncing,
      syncError,
      syncBanner,
      googleRedirectPending,
      signInGoogle,
      signInEmail,
      signUpEmail,
      signOut,
      dismissSyncBanner,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
