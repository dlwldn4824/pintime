# PinTime (핀타임)

**조율 · 확정 · 캘린더 등록까지 한곳에서**

> “야 When2Meet에 된다고 해놓고, 갑자기 안 된다고?”  
> 다른 톡방에서 이미 잡혀 있었습니다.

표만 예쁜 조율 툴이 아닙니다.  
**끊기는 흐름을 한 번에 잇고, 확정하는 순간 캘린더까지 끝내는** 일정 앱입니다.

| | |
|---|---|
| 앱 (웹) | [Netlify](https://zesty-clafoutis-473edf.netlify.app) · [Vercel](https://pintime.vercel.app) |
| **노트북 설치** | [GitHub Releases](https://github.com/dlwldn4824/PinTime/releases) — Windows `.exe` · macOS `.dmg` |
| **휴대폰 설치** | 브라우저에서 홈 화면에 추가 (PWA) |
| 사업 소개서 (피치) | [Netlify `/pitch.html`](https://zesty-clafoutis-473edf.netlify.app/pitch.html) · [Vercel](https://pintime.vercel.app/pitch.html) |
| 코드 | [github.com/dlwldn4824/PinTime](https://github.com/dlwldn4824/PinTime) |

```bash
npm install
npm run dev                 # 웹 http://localhost:5173
npm run electron:dev        # 노트북 로컬 앱 (Electron)
npm run electron:build      # Windows .exe (release/)
npm run electron:build:mac  # macOS .dmg (release/) — Apple Silicon + Intel universal
npm run build && npm run preview
```

### 로컬 앱 로드맵

| 환경 | 지금 | 다음 |
|---|---|---|
| 노트북 | Electron 앱 + **배경 고정 달력** (Windows · macOS) | 자동 업데이트 · 트레이 · Apple 공증 |
| 휴대폰 | PWA 홈 화면 설치 | Capacitor + OS 홈 위젯 (Android/iOS) |

태그 `v*` 를 push 하면 GitHub Actions가 Windows `.exe`와 macOS `.dmg`를 Release에 올립니다.

### 클라우드 계정 (Firebase · 선택)

마이페이지에서 **Google / 이메일**로 로그인하면 캘린더·할 일·공유 방이 Firestore에 동기화됩니다. env가 없으면 로컬 전용으로 동작합니다.

1. Firebase Console에서 프로젝트 생성 → Authentication: Google + Email/Password  
2. Firestore 생성 후 [`firestore.rules`](./firestore.rules) 배포  
3. 웹 앱 SDK config를 `.env` / Netlify·Vercel에 설정 (`.env.example` 참고)  
4. 승인된 도메인에 `localhost`, **`127.0.0.1`**(데스크톱 앱), `pintime.vercel.app` 추가  

방 입장용 비밀번호·세션은 클라우드에 올리지 않습니다(기기 로컬). 공유 링크 자체는 기존처럼 기기 로컬·링크 방식입니다.

### macOS 처음 열기 (Gatekeeper)

Apple 개발자 서명·공증 전이라, 처음 실행 시 *“‘PinTime’을(를) 열지 않음”* 이 뜰 수 있습니다. **완료**만 누르지 말고 아래로 허용하세요.

1. **우클릭으로 열기**  
   Applications에서 PinTime을 **우클릭(Control+클릭) → 열기** → 다시 뜨면 **열기**
2. **시스템 설정에서 허용** (위가 안 될 때)  
   **시스템 설정 → 개인정보 보호 및 보안** → 아래로 스크롤 → PinTime 차단 안내에서 **그래도 열기**

한 번만 허용하면 다음부터는 그냥 열립니다.

### 사용 통계 · 다운로드

| | |
|---|---|
| 웹 | 마이페이지에서 **익명 사용 통계** 동의(기본 OFF). 화면/이벤트 이름만. `VITE_ANALYTICS_URL` 설정 시에만 서버로 전송 |
| `.exe` 다운로드 수 | [GitHub Releases](https://github.com/dlwldn4824/PinTime/releases) 자산별 Downloads 카운트 (앱 내부 로그 없음) |

```bash
# 선택: 웹 이벤트 수신 URL
cp .env.example .env   # VITE_ANALYTICS_URL=https://...
```

---

## 왜 필요한가

일정 앱을 켜도, When2Meet·TimePick을 켜도 — 끝나는 게 아닙니다.

| 반복되는 고통 | 실제로 일어나는 일 |
|---|---|
| 방마다 다시 칠하기 | 동아리방 · 팀플방 · 친구방마다 표를 새로 만듦 |
| 확정인 줄 알았는데 깨짐 | 다른 톡에서 같은 시간이 이미 잡혀 있음 |
| 캘린더는 손으로 또 등록 | 조율 툴과 캘린더가 따로 놀아 이중 입력 |
| 가능 시간이 안 이어짐 | 한 번 입력한 일정이 다음 조율에 자동으로 안 감 |

문제는 **한 번의 입력**이 아니라, **방마다 반복되는 흐름**입니다.  
필요한 것은 더 예쁜 빈 표가 아니라 — **이 흐름을 한 번에 이어 주는 원터치**입니다.

---

## 무엇을 만들었는가

PinTime은 흩어진 일정의 맥락을 이어 줍니다.

```
캘린더에 일정 → 조율 방에 바쁨 반영 → 링크 공유 → 겹치는 시간 → 확정 → 캘린더
```

| 기능 | 역할 |
|---|---|
| **내 캘린더** | 주간·월간, 종일/시간 일정, 반복·장소·링크·메모 |
| **할 일** | 날짜별 할 일, 캘린더 일정과 연동 |
| **내 캘린더 자동 반영** | 바쁜 시간을 뒤집어 조율 방 가능 시간에 마스킹 |
| **링크 공유 조율** | When2Meet식 참여 · 친구 가능 시간 등록 · **겹치는 시간** 히트맵 |
| **공통 가능 시간** | 모두 / 가장 많이 겹치는 구간을 목록으로 바로 고르기 |
| **방 ↔ 캘린더 동기화** | 캘린더에 잡힌 일정은 다른 활성 조율 방에도 반영 (수동 수정 방은 확인 후) |
| **계정 동기화** | 로그인하면 일정·할 일·공유 방이 기기 간에 이어짐 |
| **데스크톱 앱** | Windows · macOS 설치 파일, 배경 고정 달력 |
| **사업 소개서** | 표지 + 4장 HTML 피치 (`/pitch.html`) |

---

## 누구를 위한 앱인가

| 사용자 | 왜 PinTime인가 |
|---|---|
| **대학생 · 동아리** | 톡방이 여러 개라 같은 시간이 세 번 겹침 |
| **팀플 · 스터디** | 매번 When2Meet를 새로 만들고 표만 채우다 끝남 |
| **친구 · 소규모 모임** | 되는 시간 맞추고도 캘린더에 다시 옮기는 귀찮음 |
| **일정이 많은 사람** | 한 번 잡은 약속이 다음 조율에 자동으로 가려지길 원함 |

---

## 피치 스토리 (표지 + 4장)

| 장 | 메시지 |
|---|---|
| **표지** | 흩어진 톡 · 일정 조율 · PinTime |
| **1/4 문제** | 방마다 반복되는 조율 — 예쁜 표가 아니라 원터치가 필요 |
| **2/4 구조** | 입력 → 연결 → 충돌 제거 → 추천 |
| **3/4 프로토** | 방 생성 · 마스킹 · 링크 · 겹침 |
| **4/4 결과** | 확정 한 번이면, 캘린더까지 |

로컬: [`public/pitch.html`](./public/pitch.html)  
캡처: [`public/pitch-export/`](./public/pitch-export/)

<p align="center">
  <img src="./public/pitch-export/00-cover.png" width="48%" alt="표지" />
  <img src="./public/pitch-export/02-needs.png" width="48%" alt="문제" />
</p>
<p align="center">
  <img src="./public/pitch-export/03-concept.png" width="48%" alt="구조" />
  <img src="./public/pitch-export/05-impact.png" width="48%" alt="결과" />
</p>

---

## 이렇게 써 보세요

1. **캘린더** `/` — 일정을 등록하거나 월간에서 날짜를 눌러 하루 일정을 확인  
2. **할 일** `/todo` — 날짜별 할 일 추가, 캘린더 일정과 함께 보기  
3. **공유** `/share` — 조율 방 생성 → 내 바쁨 자동 마스킹 → 초대 링크 복사  
4. **참여** `/join/...` — 친구가 가능 시간 등록 → 겹침 · 공통 시간 확인 → 확정  
5. 친구가 **「호스트에게 전달」** 링크를 보내면 호스트 화면에도 겹침이 합쳐집니다  
   (기기 간에는 링크로 스냅샷을 넘깁니다. 로그인하면 일정·방은 클라우드에도 동기화됩니다)

---

## 배포

| 환경 | URL | 용도 |
|---|---|---|
| **Netlify** | https://zesty-clafoutis-473edf.netlify.app | 체험 · 시연 |
| **Vercel** | https://pintime.vercel.app | 동일 빌드 미러 |
| **피치** | `/pitch.html` | 소개 스토리보드 |

설정: [`netlify.toml`](./netlify.toml) — `npm run build` → `dist/` · SPA 리다이렉트

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist   # 또는 Git 연동 자동 배포
```

---

## 기술 · 범위

**스택:** Vite · React 19 · TypeScript · Tailwind 4 · Electron · Firebase(선택) · `localStorage`

| 되어 있음 | 한계 |
|---|---|
| 주간/월간 캘린더 · 할 일 · 조율 방 · 겹침 | Google·Apple 캘린더 API 없음 |
| 캘린더 ↔ 방 가능시간 동기화 | 비로그인 시 기기 간은 URL/JSON 스냅샷 |
| 계정 로그인 시 Firestore 동기화 | 푸시 알림·실예약 없음 |
| Windows · macOS 데스크톱 빌드 | Apple 공증·자동 설치형 업데이트는 미완 |
| 정적 피치 · Netlify/Vercel 배포 | — |

---

## 한 줄로

표 채우다 밤 새지 마세요.  
**확정 한 번이면, 캘린더까지 끝납니다.**  
PinTime.
