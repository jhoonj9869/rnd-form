# RND Form - 지출결의서 관리 시스템

## 📋 프로젝트 개요
- **목적**: 연구소 내부용 지출결의서 관리 도구
- **규모**: 소규모 팀 사용 최적화
- **환경**: Hybrid Web/Desktop (Alpine.js + Electron)
- **상태**: ✅ v2.2.5 (이중 저장소 구조 완성)

## 🎯 핵심 특징
- **이중 저장소 구조**: Workspace(편집) + Cache(클라우드 동기화)
- **Google Drive 통합**: OAuth2 인증, 자동 백업
- **3컬럼 레이아웃**: 문서목록 | 미리보기 | 입력필드
- **한국 공문서 양식**: 결재란, 문서번호, 한글금액 자동변환
- **오프라인 지원**: IndexedDB 로컬 저장
- **단일 HTML 배포**: Vite 빌드로 하나의 파일 생성
- **Desktop 앱**: Electron으로 독립 실행 앱 제공

## 🏗️ 기술 스택
- **Frontend**: Alpine.js 3.x (경량 반응형)
- **저장소**: IndexedDB v2 (Workspace/Cache 이중 구조)
- **클라우드**: Google Drive API
- **Desktop**: Electron + 자동 업데이트
- **빌드**: Vite + vite-plugin-singlefile
- **스타일**: CSS Grid, 인쇄 최적화

## 📁 프로젝트 구조
```
rnd-form/
├── src/
│   ├── index.html                   # 메인 앱
│   ├── js/
│   │   ├── app.js                  # Alpine.js 메인 로직
│   │   ├── form-storage-service.js # Workspace/Cache 이중 저장소
│   │   ├── storage-manager.js      # 클라우드 동기화
│   │   ├── cloud-db.js             # Google Drive 연동
│   │   ├── attachment-manager.js   # 첨부파일 관리
│   │   ├── background-uploader.js  # 백그라운드 업로드
│   │   ├── print-stamp-manager.js  # 인쇄용 도장
│   │   └── utils.js                # 유틸리티
│   ├── forms/
│   │   ├── forms-registry.json     # 양식 등록
│   │   └── expense-report/         # 지출결의서 양식
│   │       ├── template.html       # 양식 템플릿
│   │       └── style.css           # 양식 스타일
│   └── css/
│       ├── main.css                # 전역 스타일
│       └── print.css               # 인쇄 스타일
├── electron/
│   ├── main.js                     # Electron 메인
│   ├── preload.js                  # IPC 브리지
│   └── google-drive.js             # OAuth2 & API
├── build/                          # 빌드 결과물
└── dist/                           # Electron 앱 배포

```

## 🚀 시작하기

### 설치
```bash
npm install
```

### 개발 서버
```bash
# Web 개발
npm run dev

# Desktop 개발
npm run electron:dev
```

### 빌드
```bash
# 단일 HTML 파일
npm run build

# Windows 실행 파일
npm run build:win
```

## 📊 구현 기능

### ✅ 완료된 기능
- [x] **이중 저장소 구조** (v2.2.5)
  - Workspace: 편집 중인 로컬 문서
  - Cache: 클라우드 동기화된 읽기 전용
- [x] **Google Drive 통합**
  - OAuth2 인증
  - 자동 동기화
  - 첨부파일 직접 저장
- [x] **문서 관리**
  - 자동 문서번호 생성 (YYYY-MM-DD-NNN)
  - 실시간 자동저장 (3초)
  - 한글 금액 자동변환
- [x] **보안 강화**
  - 도장 인쇄 시점만 임시 적용
  - 트랜잭션 원자성 보장
- [x] **성능 최적화**
  - 백그라운드 업로드 큐
  - 메모리 효율적 count() API
  - Codex 코드 리뷰 반영

## 💾 데이터 구조

### 이중 저장소 아키텍처
```javascript
// Workspace Document (편집 가능)
{
  id: "uuid",
  docNumber: "2025-09-17-001",
  title: "연구 장비 구매",
  status: "draft",
  isDraft: true,
  isFromWorkspace: true,
  lastModified: "2025-09-17T10:00:00Z"
  // ... 양식별 필드
}

// Cache Document (읽기 전용)
{
  id: "uuid",
  docNumber: "2025-09-16-001",
  title: "실험 재료 구매",
  status: "approved",
  isReadOnly: true,
  isFromCache: true,
  cloudSyncedAt: "2025-09-16T15:30:00Z"
  // ... 양식별 필드
}
```

## 🎨 아키텍처 특징

### 트랜잭션 원자성
- moveToCache/moveToWorkspace 단일 트랜잭션 처리
- 중간 실패 시 자동 롤백

### 에러 핸들링
- 모든 주요 작업에 에러 처리
- 마이그레이션 실패 복구
- 클라우드 연결 실패 대응

### 메모리 최적화
- 대량 문서 시 count() API 활용
- 필요 시에만 문서 로드

## 📌 기술 선택 이유
- **IndexedDB v2**: 이중 저장소 구조로 안정성 향상
- **Alpine.js**: React/Vue 대비 경량, 빠른 로딩
- **Electron**: 데스크톱 앱으로 보안 강화
- **Google Drive**: 자동 백업 및 협업 지원

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

## 📚 참고 문서
- [아키텍처 문서](ARCHITECTURE.md)
- [현재 상태](CURRENT_STATUS.md)
- [제품 요구사항](docs/PRD.md)
- [로드맵](docs/roadmap.md)

## 🔄 버전 히스토리
- **v2.2.5** (2025-09-17): 이중 저장소 구조, Codex 리뷰 반영
- **v2.2.1** (2025-09-17): 자동 업데이트 구현
- **v2.2.0** (2025-09-16): Google Drive 통합
- **v1.0.0** (2025-09-16): 초기 릴리즈

## 🔒 라이선스
내부 사용 전용 (Private)

---
*최종 업데이트: 2025-09-17*