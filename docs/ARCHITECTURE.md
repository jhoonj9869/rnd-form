# RND Form 시스템 아키텍처

## 🏛️ 시스템 개요

### v2.5.0-pre: 중앙 초기화 지점 아키텍처 ⚠️ **문제 발생 중**

#### 🎯 핵심 설계 원칙 (2025-09-25 수정)
**"초기화 지점(`currentDoc = null`)은 안전한 대기 상태"**

#### ✅ **안정성 원칙**
1. **`currentDoc`은 항상 `currentFormType`의 목록에서만 올 수 있다**
2. **컨텍스트가 바뀌면 사용자가 다시 선택할 때까지 대기**
3. **모든 상태 전환은 중앙 초기화 지점(`setCurrentDocument`)을 경유**

#### ⚡ **`currentDoc = null` 발동 조건**
- 양식 전환 시 (`switchFormType`)
- 문서 목록 새로고침 후 (`loadDocuments`)
- 앱 시작 시 (`init`)
- 문서 삭제 후 (`deleteDocument`)
- 오류 발생 시 (안전 복구)
- **계층적 상태 관리**: 상위 작업 시 하위 상태 자동 리셋
- **메인화면 초기화**: A4 백지 + 사용 가이드로 명확한 시작점 제공

#### 🔄 계층별 초기화 패턴
```
시스템 전체 초기화 (앱 시작/새로고침)
        ↓
양식 전체 초기화 (새로고침)
        ↓
양식 단위 초기화 (양식 전환)
        ↓
문서 단위 초기화 (문서 변경) ← 중앙 초기화 지점
```

#### 🏠 메인화면 설계
- **중앙 미리보기**: 흰색 A4 용지 배경 (회색 X)
- **우측 패널**: 사용 방법 가이드 표시
- **초기 상태**: `currentDoc = null` 시 가이드 모드

### 기술 스택
- **Frontend**: Alpine.js 3.x + Vanilla JS
- **Desktop**: Electron 33.x
- **Storage**: IndexedDB (Dexie.js) + Google Drive API v3
- **Build**: Vite + vite-plugin-singlefile
- **Auth**: Google OAuth2 (PKCE flow)

## 📂 프로젝트 구조

### 🏗️ 공통 시스템
모든 양식에서 공통으로 사용하는 핵심 기능

#### 파일 구조
```
src/
├── js/
│   ├── app.js                    # Alpine.js 메인 앱 (공통시스템)
│   ├── form-storage-service.js   # Workspace/Cache 이중 저장소 (v2.2.5+)
│   ├── storage-manager.js        # 클라우드 동기화 체계
│   ├── cloud-db.js               # Google Drive 연동
│   ├── attachment-manager.js     # 첨부파일 관리
│   ├── background-uploader.js    # 백그라운드 업로드 큐
│   ├── loading-overlay.js        # 로딩 오버레이 (v2.3.1+)
│   ├── db.js                     # IndexedDB 기본 관리 (Legacy)
│   └── utils.js                  # 공통 유틸리티
├── css/
│   ├── main.css                  # 전역 스타일
│   └── print.css                 # 인쇄 스타일 (@media print)
└── index.html                     # 메인 앱 컨테이너

electron/
├── main.js                        # Electron 메인 프로세스
├── preload.js                     # IPC 브리지
└── google-drive.js                # OAuth2 및 Drive API
```

### 핵심 기능
- **이중 저장소 구조**:
  - Workspace (편집 중인 로컬 문서)
  - Cache (클라우드 동기화된 읽기 전용)
  - 단일 트랜잭션으로 원자성 보장
- **클라우드 통합**: Google Drive OAuth2
- **첨부파일 관리**: Drive 직접 저장
- **백그라운드 업로드**: 재시도 큐 시스템
- **문서 관리**: 저장, 불러오기, 삭제
- **UI 레이아웃**: 3컬럼 구조
- **인쇄 시스템** (v2.4.0+):
  - WYSIWYG 방식 (미리보기 화면 그대로 출력)
  - 도장/워터마크는 양식별 UI에서 선택적 추가
  - `window.print()` / `electronAPI.print()` 직접 호출
- **수동저장**: 사용자 제어, 저장 상태 표시 (v2.4.1+)
- **단축키**: Ctrl+S, Ctrl+N, Ctrl+P

### 📋 양식별 코드
특정 양식에만 해당하는 템플릿과 스타일

#### 파일 구조
```
src/forms/
├── common/                  # 공통 템플릿 (v2.3.0+)
│   ├── template.html       # 새 양식 기본 템플릿
│   ├── style.css          # 공통 스타일
│   └── README.md          # 사용 가이드
├── expense-report/         # 지출결의서 양식
│   ├── template.html      # 양식 템플릿
│   ├── style.css         # 양식 전용 스타일
│   └── config.json       # 양식 설정
├── purchase-order/         # 구매요청서 양식 (v2.3.1+)
│   ├── template.html      # 양식 템플릿
│   └── style.css         # 양식 전용 스타일
└── templates/             # 설정 파일
    ├── form-config.json   # 모든 양식 설정
    └── folder-mapping.json # 한글-영문 매핑
```

### 양식 구성요소
- **템플릿 구조**: 결재란, 품목 테이블
- **필드 정의**: 제목, 부서, 신청자 등
- **검증 규칙**: 필수 항목, 금액 계산
- **스타일**: 테두리, 여백, 폰트 크기

## 🎯 중앙 초기화 지점 아키텍처 (v2.5.0-pre)

### 🔄 초기화 함수 설계

#### 중앙 초기화 지점 (Central Initialization Point)
```javascript
// app.js - 모든 currentDoc 변경의 단일 진입점
function initializeCurrentDoc(newDoc, context = {}) {
    // 1. 이전 상태 정리
    if (this.currentDoc) {
        this.saveDocumentState(this.currentDoc);
    }

    // 2. 새 문서 설정
    this.currentDoc = newDoc ? { ...newDoc } : null;

    // 3. UI 상태 동기화
    this.updateUIState(context);

    // 4. 이벤트 발생
    this.$dispatch('docInitialized', { doc: newDoc, context });
}
```

#### 계층별 초기화 전략

##### 1️⃣ 문서 단위 초기화 (Document Level)
```javascript
// 문서 전환 시나리오
function switchDocument(docId) {
    const doc = await formStorage.getFromCache(docId);
    this.initializeCurrentDoc(doc, {
        type: 'document-switch',
        previousDoc: this.currentDoc?.id
    });
}

// 새 문서 생성
function createNewDocument() {
    const newDoc = this.createEmptyDocument();
    this.initializeCurrentDoc(newDoc, {
        type: 'new-document',
        formType: this.currentFormType
    });
}
```

##### 2️⃣ 양식 단위 초기화 (Form Level)
```javascript
// 양식 전환 시나리오
function switchForm(formType) {
    // 현재 문서 상태 저장
    docStateManager.saveCurrentState(this.currentFormType, this.currentDoc);

    // 양식 전환
    this.currentFormType = formType;

    // 해당 양식의 마지막 문서 복원 또는 null
    const lastDoc = docStateManager.getLastDocument(formType);
    this.initializeCurrentDoc(lastDoc, {
        type: 'form-switch',
        formType: formType
    });
}
```

##### 3️⃣ 양식 전체 초기화 (All Forms Level)
```javascript
// 전체 새로고침
function refreshAllForms() {
    // 모든 양식 상태 저장
    docStateManager.saveAllStates();

    // 양식 레지스트리 새로고침
    await formRegistry.refreshCache();

    // 기본 상태로 초기화
    this.currentFormType = 'expense-report';
    this.initializeCurrentDoc(null, {
        type: 'full-refresh'
    });
}
```

### 🎨 UI 상태 관리 패턴

#### 메인화면 초기화 상태
```javascript
// currentDoc = null 시 메인화면 가이드 모드
function updateUIState(context) {
    if (!this.currentDoc) {
        // A4 백지 표시
        this.showBlankPaper = true;

        // 사용 가이드 표시
        this.showUsageGuide = true;
        this.guideContent = this.getUsageGuide(context);

        // 입력 필드 비활성화
        this.isEditable = false;
    } else {
        // 문서 미리보기 모드
        this.showBlankPaper = false;
        this.showUsageGuide = false;
        this.isEditable = true;

        // 문서 데이터 바인딩
        this.bindDocumentData();
    }
}
```

#### 사용 가이드 콘텐츠
```javascript
function getUsageGuide(context) {
    const guides = {
        'initial': '새 문서를 작성하거나 기존 문서를 선택하세요.',
        'form-switch': `${this.currentFormType} 양식이 선택되었습니다.`,
        'full-refresh': '모든 양식이 새로고침되었습니다.'
    };

    return guides[context?.type] || guides['initial'];
}
```

### 🔄 상태 전환 다이어그램

```
┌─────────────────────────────────────────┐
│               메인화면                   │
│         (currentDoc = null)             │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  A4 백지    │  │   사용 가이드    │  │
│  │   미리보기   │  │                 │  │
│  │            │  │ • 새 문서 작성   │  │
│  │            │  │ • 기존 문서 선택 │  │
│  │            │  │ • 양식 전환     │  │
│  └─────────────┘  └─────────────────┘  │
└─────────────────┬───────────────────────┘
                  │ initializeCurrentDoc(doc)
                  ▼
┌─────────────────────────────────────────┐
│              문서 모드                   │
│            (currentDoc ≠ null)          │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ 문서 미리보기│  │   입력 필드     │  │
│  │  (실시간)   │  │   (편집 가능)   │  │
│  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘
```

## 🔄 데이터 흐름 및 상호작용

### 공통시스템 → 양식 템플릿
```javascript
// app.js (공통시스템)
currentDoc: {
    // 공통 필드
    id: null,
    docNumber: '',
    status: 'draft',
    createdAt: null,
    updatedAt: null,

    // 양식별 필드 (동적)
    title: '',
    department: '',
    items: [],
    free: { entries: [] }
}
```

### 양식 템플릿 → 공통시스템
```html
<!-- template.html (양식) -->
<div x-data="expenseApp">  <!-- 공통시스템 앱 접근 -->
    <span x-text="currentDoc.title"></span>  <!-- 데이터 바인딩 -->
    <button @click="saveDocument()"></button>  <!-- 공통시스템 함수 호출 -->
</div>
```

## 🎯 개발 가이드라인

### 공통시스템 수정 시
- 모든 양식에 영향
- db.js, app.js 핵심 로직 변경 주의
- print.css는 최소한만 (UI 숨김)

### 양식 수정 시
- 해당 양식만 영향
- template.html, style.css 자유롭게 수정
- 다른 양식 추가 시 복사 가능

### 문서 관리 원칙 (v2.4.0+)
- **Workspace**: 단일 문서만 유지 (편집 공간)
  - 별도 섹션에 표시 (작업중 문서)
  - 항상 편집 가능 상태
  - 각 양식별로 1개 문서만 유지
  - 클라우드 저장 후 자동 삭제
- **Cache**: 클라우드 동기화된 읽기 전용 문서
  - 클라우드 문서 섹션에 표시
  - 클릭 시 읽기 전용 모드로 열림
  - 더블클릭/수정하기로 Workspace로 이동 (동일 ID)
  - Google Drive와 완전 동기화
- **데이터 흐름**:
  - Drive → Cache (동기화)
  - Workspace → Drive → Cache (저장)
- **Cache 액션**: 수정(동일ID)/복사(새ID)/삭제(Drive+Cache)

## 📊 시스템 아키텍처 다이어그램

### 저장소 아키텍처 (v2.2.5+)
```
┌─────────────────────────────────────────┐
│           Application Layer              │
│         (Alpine.js + app.js)            │
│   - 단일 Workspace 문서 (ID 유지)      │
│   - Cache 문서 액션 (수정/복사/삭제)    │
└────────────┬───────────────┬────────────┘
             │               │
    ┌────────▼────────┐  ┌──▼──────────┐
    │ Form Storage    │  │ Attachment  │
    │   Service       │  │  Manager    │
    │ (Dual Storage)  │  │ (Drive API) │
    └────────┬────────┘  └──┬──────────┘
             │               │
    ┌────────▼────────┐  ┌──▼──────────┐
    │   IndexedDB     │  │Google Drive │
    │ - Workspace     │  │  Storage    │
    │ - Cache         │  │             │
    └─────────────────┘  └─────────────┘
```

### 인증 플로우
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Electron │────▶│  OAuth2  │────▶│  Google  │
│   App    │     │   PKCE   │     │  Drive   │
└──────────┘     └──────────┘     └──────────┘
     │                                  │
     └──────────── Token ───────────────┘
```

### 컴포넌트 상호작용
```
┌────────────────────────────────────────┐
│            index.html                   │
├────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │ Sidebar  │  │   Form   │  │Print │ │
│  │   List   │  │ Template │  │Preview│ │
│  └──────────┘  └──────────┘  └──────┘ │
│        ▲             ▲            ▲    │
│        └─────────────┼────────────┘    │
│                Alpine.js State         │
└────────────────────────────────────────┘
```

## 💡 현재 구현 상태 (v2.5.0)

### ✅ 완료된 구현 (v2.5.0)
- **중앙 초기화 지점 아키텍처**: 100% 구현 완료
  - `setCurrentDocument()` 메서드 구현 - 모든 currentDoc 변경의 단일 진입점
  - 계층별 초기화 함수 구현 (document/form/system level)
  - 메인화면 초기화 상태 구현 (A4 백지 + 사용 가이드)
  - DocStateManager와 완전 통합
  - 기존 메서드 리팩토링 (newDocument, loadDocument, switchFormType)

### 🎨 메인화면 UI 시스템 (v2.5.0)
- **A4 백지 미리보기**: 실제 종이 느낌의 빈 문서 표시
- **사용 가이드 패널**: 컨텍스트별 동적 가이드 메시지
- **조건부 렌더링**: 메인화면 ↔ 문서모드 자동 전환
- **CSS 스타일링**: 90+ 줄의 전용 스타일 구현

### 📊 기존 구현 상태
- **공통시스템**: 100% 완성
  - 이중 저장소 구조 구현 완료
  - Workspace/Cache 완전 분리
  - 동적 양식 관리 시스템 구현
  - FormRegistry 로컬 전용 모드 구현
  - 양식 전환 시스템 완전 구현
- **지출결의서**: 100% 완성
- **구매요청서**: 100% 완성 (템플릿 및 필드 구현)
- **출장보고서**: 100% 완성 (기본 템플릿 구현)
- **클라우드 통합**: 100% 완성
- **확장성**: 동적 양식 추가/전환 가능
- **한글 지원**: 로컬 양식 설정 완벽 지원
- **DocStateManager**: 부분 구현 (양식별 상태 격리)

## 🚀 확장 가이드 - 새 양식 추가

### 로컬 개발
1. `forms/common/template.html` 복사
2. 새 폴더 생성 (예: `forms/my-form/`)
3. `template.html`로 저장 (파일명 통일)
4. doc-content 영역만 수정
5. `templates/form-config.json`에 설정 추가

### Google Drive 배포
1. Drive에 한글 폴더 생성 (예: "구매요청서")
2. template.html 업로드
3. form-meta.json 생성 (선택)
4. `folder-mapping.json`에 매핑 추가

### 양식 전환 방식
- 앱은 항상 `{양식폴더}/template.html` 파일을 로드
- 파일명이 동일하므로 경로만 변경하여 전환

## 🔒 보안 및 성능

### 보안 조치
- **Print Security** (v2.4.0+): WYSIWYG approach - sensitive data added via form UI only
- **OAuth2 PKCE**: Secure authentication without client secret
- **Data Isolation**: Workspace/Cache separation
- **Token Storage**: Electron safeStorage API

### 성능 최적화
- **Transaction Atomicity**: Single transaction for moveToCache/moveToWorkspace
- **Memory Optimization**: Efficient count() API usage
- **Background Upload**: Queue system with retry logic
- **Lazy Loading**: Forms loaded on demand
- **Manual Save**: User-controlled with save status indicator (v2.4.1+)

## 🔧 주요 기술 결정사항

### 왜 이중 저장소인가?
- **Workspace**: Local edits, offline support
- **Cache**: Cloud-synced, read-only copies
- **Benefits**: Conflict-free sync, data integrity

### 왜 Alpine.js인가?
- Lightweight (45KB)
- No build step required
- Reactive without virtual DOM
- Perfect for desktop apps

### 왜 단일 HTML인가?
- One-file deployment
- Offline capability
- No server required
- Easy distribution

## 📝 API 레퍼런스

### FormStorageService API
```javascript
// Workspace operations
await formStorage.saveToWorkspace(doc)
await formStorage.getFromWorkspace(id)
await formStorage.deleteFromWorkspace(id)

// Cache operations
await formStorage.moveToCache(id)
await formStorage.moveToWorkspace(id)
await formStorage.getAllFromCache()

// Utility
await formStorage.clearAll()
await formStorage.count()
```

### StorageManager API
```javascript
// Cloud sync
await storageManager.syncWithCloud()
await storageManager.uploadDocument(doc)
await storageManager.downloadDocument(id)
```

### AttachmentManager API
```javascript
// File operations
await attachmentManager.uploadFile(file, docId)
await attachmentManager.downloadFile(fileId)
await attachmentManager.deleteFile(fileId)
```