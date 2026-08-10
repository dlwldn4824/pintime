# PinTime (핀타임)

캘린더 · 일정 조율 · 할 일. 웹과 노트북 앱.

| | |
|---|---|
| 웹 | [pintime.vercel.app](https://pintime.vercel.app) · [Netlify](https://zesty-clafoutis-473edf.netlify.app) |
| 노트북 | [Releases](https://github.com/dlwldn4824/PinTime/releases) — Windows `.exe` · macOS `.dmg` |
| 휴대폰 | 브라우저에서 홈 화면에 추가 (PWA) |
| 소개서 | [`/pitch.html`](https://pintime.vercel.app/pitch.html) |
| 코드 | [github.com/dlwldn4824/PinTime](https://github.com/dlwldn4824/PinTime) |

## 실행

```bash
npm install
npm run dev                 # http://localhost:5173
npm run electron:dev        # Electron
npm run electron:build      # Windows
npm run electron:build:mac  # macOS universal
npm run build && npm run preview
```

태그 `v*` 를 push하면 GitHub Actions가 Windows·macOS 설치 파일을 Release에 올립니다.

## 기능

- **캘린더** — 주간·월간, 종일/시간 일정, 반복·장소·링크·메모
- **공유 조율** — 방 만들기 → 초대 링크 → 가능 시간 겹침
- **할 일** — 날짜별 할 일, 캘린더 일정과 연동
- **계정** — Google / 이메일 로그인 시 일정·할 일·공유 방 클라우드 동기화
- **데스크톱** — Electron 앱, 배경 고정 달력 (Windows · macOS)

## 클라우드 (Firebase, 선택)

마이페이지에서 로그인하면 Firestore에 동기화됩니다. env가 없으면 로컬만 사용합니다.

1. Firebase Console → Authentication (Google, Email/Password)
2. Firestore 생성 후 [`firestore.rules`](./firestore.rules) 배포
3. `.env.local` 또는 호스팅 env에 `VITE_FIREBASE_*` 설정 ([`.env.example`](./.env.example))
4. Authorized domains에 `localhost`, `127.0.0.1`, `pintime.vercel.app` 추가

방 입장용 세션·비밀번호는 클라우드에 올리지 않습니다.

## macOS 처음 실행

서명·공증 전이면 Gatekeeper가 막을 수 있습니다.

1. Applications에서 PinTime **우클릭 → 열기**
2. 또는 **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기**

## 사용 통계

마이페이지에서 익명 통계 동의(기본 OFF). `VITE_ANALYTICS_URL`이 있을 때만 전송합니다.

## 스택

Vite · React 19 · TypeScript · Tailwind 4 · Electron · Firebase (선택)

## 배포

```bash
npm run build
# dist/ 를 Vercel / Netlify에 배포
```

| | |
|---|---|
| Vercel | https://pintime.vercel.app |
| Netlify | https://zesty-clafoutis-473edf.netlify.app |
