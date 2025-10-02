# RND Form - 동적 양식 관리 시스템

## 📋 프로젝트 개요
- **목적**: 연구소 내부용 동적 양식 관리 시스템
- **규모**: 소규모 팀 협업 최적화 (공유드라이브 지원)
- **환경**: Hybrid Web/Desktop (Alpine.js + Electron)
- **상태**: ✅ **v2.3.0 MVP - 프로덕션 준비 완료**

## 🎯 핵심 특징
- **동적 양식 시스템**: Google Drive 폴더 기반 양식 자동 로딩
- **이중 저장소 구조**: Workspace(편집) + Cache(클라우드 동기화)
- **공유드라이브 완전 지원**: 멀티 계정 협업 가능
- **작업중 문서 보호**: 데이터 손실 방지 경고 시스템
- **Google Drive 통합**: OAuth2 인증, 자동 백업, 배경 업로드
- **3컬럼 레이아웃**: 문서목록 | 미리보기 | 입력필드
- **한국 공문서 양식**: 결재란, 문서번호, 한글금액 자동변환
- **오프라인 지원**: IndexedDB 로컬 저장
- **Desktop 앱**: Electron으로 독립 실행 앱 제공

## 🏗️ 기술 스택
- **Frontend**: Alpine.js 3.13 (경량 반응형 프레임워크)
- **저장소**: IndexedDB (Dexie.js) - Workspace/Cache 이중 구조
- **클라우드**: Google Drive API v3 (공유드라이브 지원)
- **Desktop**: Electron + 자동 업데이트
- **빌드**: Vite + vite-plugin-singlefile
- **스타일**: CSS Grid, 인쇄 최적화 (A4 용지)

## 📁 프로젝트 구조
```
rnd-form/
├── src/
│   ├── index.html                     # 메인 앱
│   ├── js/
│   │   ├── app.js                    # Alpine.js 메인 로직
│   │   ├── form-storage-service.js   # Workspace/Cache 이중 저장소 (v2.2.5)
│   │   ├── form-registry-service.js  # 동적 양식 관리 (v2.3.0)
│   │   ├── storage-manager.js        # 클라우드 동기화
│   │   ├── doc-state-manager.js      # 양식별 문서 상태 관리
│   │   ├── cloud-db.js               # Google Drive 연동
│   │   ├── attachment-manager.js     # 첨부파일 관리
│   │   ├── background-uploader.js    # 백그라운드 업로드 큐
│   │   ├── print-stamp-manager.js    # 인쇄용 전자서명/도장
│   │   └── utils.js                  # 유틸리티
│   ├── forms/
│   │   ├── form-config.json          # 양식 중앙 설정
│   │   ├── folder-mapping.json       # Drive 폴더 매핑
│   │   ├── forms-registry.json       # 양식 레지스트리
│   │   ├── common/                   # 공통 템플릿
│   │   ├── expense-report/           # 지출결의서 (완성)
│   │   └── coming-soon/              # 준비중 양식
│   └── css/
│       ├── main.css                  # 전역 스타일
│       └── print.css                 # 인쇄 스타일
├── electron/
│   ├── main.js                       # Electron 메인 프로세스
│   ├── preload.js                    # IPC 브리지
│   └── google-drive.js               # OAuth2 & Drive API
├── docs/                             # 프로젝트 문서
│   ├── ARCHITECTURE.md               # 시스템 아키텍처
│   ├── CURRENT_STATUS.md             # 현재 상태 (세션 관리)
│   ├── PRD.md                        # 제품 요구사항
│   └── roadmap.md                    # 개발 로드맵
├── build/                            # Vite 빌드 결과물
├── dist/                             # Electron 앱 배포
└── .git.backup/                      # Git 히스토리 백업
```

## 🚀 시작하기

### 설치
```bash
npm install
```

### 개발 서버
```bash
# Web 개발 (Vite)
npm run dev

# Desktop 개발 (Electron + Vite)
npm run electron:dev
```

### 빌드
```bash
# 단일 HTML 파일
npm run build

# Windows 실행 파일 (.exe)
npm run build:win
```

## 📊 구현 기능

### ✅ 완료된 핵심 기능 (v2.3.0 MVP)

#### 1. 동적 양식 시스템
- [x] Google Drive 폴더 기반 양식 자동 로딩
- [x] 지출결의서 완전 구현
- [x] 준비중 양식 처리 (Coming Soon)
- [x] 양식별 독립적 상태 관리 (DocStateManager)
- [x] 중앙 설정 시스템 (form-config.json)

#### 2. 이중 저장소 아키텍처 (v2.2.5)
- [x] Workspace: 편집 중인 로컬 문서
- [x] Cache: 클라우드 동기화된 읽기 전용 문서
- [x] 트랜잭션 원자성 보장
- [x] 자동 마이그레이션

#### 3. Google Drive 통합
- [x] OAuth2 인증
- [x] 공유드라이브 완전 지원 (멀티 계정 협업)
- [x] 자동 동기화 (중복 실행 방지)
- [x] 배경 업로드 큐 (재시도 메커니즘)
- [x] 첨부파일 직접 저장

#### 4. 사용자 경험
- [x] 작업중 문서 보호 (데이터 손실 경고)
- [x] 편집 필드 자동 활성화 (다이얼로그 패턴)
- [x] 저장 후 편집 상태 유지
- [x] 클라우드 문서 복사 UX
- [x] 동기화 중복 실행 방지

#### 5. 문서 관리
- [x] 자동 문서번호 생성 (YYYY-MM-DD-NNN)
- [x] 한글 금액 자동변환
- [x] 문서 미리보기
- [x] 첨부파일 관리

#### 6. 보안 및 인쇄
- [x] 전자서명/도장 인쇄 시점만 임시 적용
- [x] 저장 시 민감정보 제외
- [x] A4 용지 최적화

### 🔜 향후 계획

#### 우선순위 높음
- [ ] 구매요청서 양식 구현
- [ ] 출장보고서 양식 구현
- [ ] 사용자 설정 (기본 서명/도장)
- [ ] 성능 최적화 (대용량 문서)

#### 우선순위 중간
- [ ] 검색 기능 (문서 번호, 제목)
- [ ] 문서 필터링 (날짜, 상태)
- [ ] 버전 관리 (변경 이력)

#### 우선순위 낮음
- [ ] 다크 모드
- [ ] 다국어 지원
- [ ] 모바일 반응형

## 💾 데이터 구조

### 이중 저장소 아키텍처
```javascript
// Workspace Document (편집 가능)
{
  id: "uuid",
  docNumber: "2025-10-02-001",
  title: "연구 장비 구매",
  status: "draft",
  isDraft: true,
  isFromWorkspace: true,
  isReadOnly: false,
  lastModified: "2025-10-02T00:00:00Z"
  // ... 양식별 필드
}

// Cache Document (읽기 전용)
{
  id: "uuid",
  docNumber: "2025-10-01-001",
  title: "실험 재료 구매",
  status: "approved",
  isReadOnly: true,
  isFromCache: true,
  cloudSyncedAt: "2025-10-01T15:30:00Z"
  // ... 양식별 필드
}
```

## 🎨 아키텍처 특징

### 1. 트랜잭션 원자성
- moveToCache/moveToWorkspace 단일 트랜잭션
- 중간 실패 시 자동 롤백

### 2. 공유드라이브 지원
- OAuth2 스코프: `https://www.googleapis.com/auth/drive`
- API 옵션: `supportsAllDrives`, `includeItemsFromAllDrives`
- 멀티 계정 협업 가능

### 3. 에러 핸들링
- 모든 주요 작업에 에러 처리
- 마이그레이션 실패 복구
- 클라우드 연결 실패 대응

### 4. 메모리 최적화
- 대량 문서 시 count() API 활용
- 필요 시에만 문서 로드
- 배경 업로드 큐 시스템

## 📌 기술 선택 이유
- **IndexedDB v2**: 이중 저장소 구조로 안정성 향상
- **Alpine.js**: React/Vue 대비 경량, 빠른 로딩
- **Electron**: 데스크톱 앱으로 보안 강화, OAuth2 인증
- **Google Drive**: 자동 백업 및 협업 지원
- **Vite**: 빠른 빌드, 단일 HTML 배포

## 🚀 배포 방법

### Web 버전
```bash
npm run build
# build/index.html 파일 배포
```

### Desktop 앱
```bash
npm run build:win
# dist/RND Form Setup x.x.x.exe 배포
```

### 자동 업데이트
- GitHub Releases 통한 자동 업데이트
- 앱 실행 시 자동 확인

## 📝 Git 관리

### 현재 상태
- **브랜치**: `master` (단일 브랜치)
- **커밋**: 깨끗한 초기 커밋 (민감정보 제거 완료)
- **원격**: https://github.com/jhoonj9869/rnd-form
- **백업**: `.git.backup/` (이전 히스토리 로컬 보관)

### 다음 작업 시
```bash
# 새 기능 브랜치 생성
git checkout -b feature/[기능명]

# 작업 후 커밋
git add .
git commit -m "feat: 기능 설명"

# master 병합
git checkout master
git merge feature/[기능명]
git push origin master
```

## 📚 참고 문서
- [아키텍처 문서](docs/ARCHITECTURE.md) - 시스템 설계 및 구조
- [현재 상태](docs/CURRENT_STATUS.md) - 세션 상태 및 작업 이력
- [제품 요구사항](docs/PRD.md) - 기능 명세
- [로드맵](docs/roadmap.md) - 개발 계획

## 🔄 버전 히스토리
- **v2.3.0** (2025-10-02): MVP 완성, Git 저장소 초기화
  - 작업중 문서 경고 통일
  - 클라우드 문서 복사 UX 개선
  - package-lock.json 추가 (빌드 일관성)
  - 민감정보 제거 (OAuth 키)
- **v2.2.5** (2025-09-27): 이중 저장소 구조 완성
- **v2.2.1** (2025-09-17): 자동 업데이트 구현
- **v2.2.0** (2025-09-16): Google Drive 통합
- **v1.0.0** (2025-09-16): 초기 릴리즈

## 🔒 라이선스
내부 사용 전용 (Private)

## 🙏 Credits
Built with Claude Code (Anthropic)

---
*최종 업데이트: 2025-10-02*
*상태: ✅ MVP 완성, 프로덕션 준비 완료*
