# JavaScript 모듈 구조 가이드

> 📅 작성일: 2025-09-23
> 🎯 대상: 개발자 및 시스템 관리자
> 📝 목적: RND Form 시스템의 JavaScript 모듈 구조 이해

## 📋 모듈 개요

RND Form 시스템은 **12개의 독립적인 JavaScript 모듈**로 구성되어 있으며, 각 모듈은 특정 기능을 담당합니다.

### 🏗️ 아키텍처 계층 구조

```
┌─────────────────────────────────────────┐
│               UI Layer                  │
│            app.js (메인)                │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            Business Logic               │
│  doc-state-manager.js  form-registry.js │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│             Data Layer                  │
│ form-storage-service.js  storage-mgr.js │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│          Infrastructure                 │
│ db.js  cloud-db.js  electron-bridge.js  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            Utilities                    │
│ utils.js  print-stamp.js  attachment.js │
│        background-uploader.js           │
└─────────────────────────────────────────┘
```

---

## 📁 모듈별 상세 가이드

### 1. 🎮 **app.js** - 메인 애플리케이션
> **역할**: Alpine.js 기반 UI 컨트롤러 및 메인 애플리케이션 로직

```javascript
// 주요 기능
- Alpine.js 반응형 상태 관리
- 사용자 이벤트 처리 (클릭, 입력, 저장 등)
- 양식 전환 및 문서 관리 UI 로직
- 다른 모듈들과의 통합 관리

// 핵심 메서드
- newDocument()      // 새 문서 생성
- saveDocument()     // 문서 저장
- loadDocument()     // 문서 로드
- switchFormType()   // 양식 전환
- printDocument()    // 문서 인쇄
```

**의존성**: 모든 다른 모듈들을 import하여 사용
**크기**: ~1,600라인 (가장 큰 모듈)
**업데이트 빈도**: 높음 (UI 변경 시마다)

---

### 2. 🧠 **doc-state-manager.js** - 문서 상태 관리자
> **역할**: 양식별 독립적인 문서 상태 관리 (v2.4.9+에서 추가)

```javascript
// 주요 기능
- 양식별 문서 상태 격리 관리
- workspace/cache 상태 분리
- 컨텍스트 전환 시 상태 보존
- 메모리 효율적 상태 관리

// 핵심 메서드
- registerFormType()     // 양식 타입 등록
- switchContext()        // 컨텍스트 전환
- saveCurrentState()     // 현재 상태 저장
- getCurrentDoc()        // 현재 문서 반환
```

**의존성**: 없음 (독립 모듈)
**크기**: ~220라인
**업데이트 빈도**: 낮음 (안정화된 코어 로직)

---

### 3. 📋 **form-registry-service.js** - 양식 레지스트리
> **역할**: 동적 양식 관리 및 템플릿 로딩

```javascript
// 주요 기능
- Google Drive 폴더 기반 양식 탐지
- 로컬/클라우드 템플릿 로딩
- 한글 폴더명 ↔ 영문 ID 매핑
- 양식 메타데이터 관리

// 핵심 메서드
- fetchAvailableForms()  // 사용 가능한 양식 목록
- loadFormTemplate()     // 양식 템플릿 로드
- switchForm()           // 양식 전환
- updateFormMetadata()   // 메타데이터 업데이트
```

**의존성**: electron-bridge.js (Google Drive API)
**크기**: ~400라인
**업데이트 빈도**: 중간 (새 양식 추가 시)

---

### 4. 💾 **form-storage-service.js** - 이중 저장소 관리
> **역할**: Workspace/Cache 이중 저장소 구조 관리

```javascript
// 주요 기능
- Workspace: 편집 가능한 로컬 문서 (1개)
- Cache: 읽기 전용 클라우드 동기화 문서 (여러 개)
- 양식별 독립 저장소 관리
- 트랜잭션 기반 원자성 보장

// 핵심 메서드
- saveToWorkspace()      // 작업 공간에 저장
- saveToCache()          // 캐시에 저장
- getWorkspaceDocument() // 작업 문서 조회
- getCacheDocuments()    // 캐시 문서 목록
- moveToCache()          // 워크스페이스 → 캐시 이동
```

**의존성**: db.js (IndexedDB 접근)
**크기**: ~300라인
**업데이트 빈도**: 낮음 (안정화된 저장소 로직)

---

### 5. ☁️ **storage-manager.js** - 클라우드 동기화 관리자
> **역할**: 로컬 ↔ 클라우드 동기화 및 백그라운드 업로드 관리

```javascript
// 주요 기능
- Google Drive와 로컬 DB 동기화
- 백그라운드 파일 업로드 큐 관리
- 오프라인/온라인 상태 처리
- 충돌 해결 및 병합 로직

// 핵심 메서드
- syncWithCloud()        // 클라우드 동기화
- uploadToCloud()        // 클라우드 업로드
- downloadFromCloud()    // 클라우드 다운로드
- mergeWithLocal()       // 로컬과 병합
```

**의존성**: form-storage-service.js, background-uploader.js, electron-bridge.js
**크기**: ~250라인
**업데이트 빈도**: 중간 (동기화 로직 개선 시)

---

### 6. 🗄️ **db.js** - IndexedDB 관리자
> **역할**: 브라우저 로컬 데이터베이스 관리 (Dexie.js 기반)

```javascript
// 주요 기능
- IndexedDB 스키마 정의 및 관리
- 양식별 독립 테이블 생성
- 트랜잭션 및 인덱스 관리
- 데이터베이스 마이그레이션

// 핵심 테이블
- workspace_[formType]   // 각 양식별 작업 공간
- cache_[formType]       // 각 양식별 캐시
- attachments           // 첨부파일 메타데이터
```

**의존성**: Dexie.js 라이브러리
**크기**: ~100라인
**업데이트 빈도**: 낮음 (스키마 변경 시에만)

---

### 7. ☁️ **cloud-db.js** - 레거시 클라우드 DB (deprecated)
> **역할**: 이전 버전 호환성 유지용 (v2.3+ 이후 form-storage-service로 대체)

```javascript
// 상태: 사용 중단 예정
// 이유: 이중 저장소 구조로 대체됨
// 제거 예정: v2.5.0
```

**의존성**: db.js
**크기**: ~150라인
**업데이트 빈도**: 없음 (deprecated)

---

### 8. 🌐 **electron-bridge.js** - Electron 브리지
> **역할**: 렌더러 ↔ 메인 프로세스 IPC 통신 관리

```javascript
// 주요 기능
- Google Drive API 호출 (OAuth2, 파일 업로드/다운로드)
- 파일 시스템 접근
- 네이티브 다이얼로그 호출
- 프린터 접근

// 핵심 API
- drive.authenticate()   // Google 인증
- drive.uploadFile()     // 파일 업로드
- drive.downloadFile()   // 파일 다운로드
- fs.readFile()         // 파일 읽기
- dialog.showSaveDialog() // 저장 다이얼로그
```

**의존성**: Electron preload script
**크기**: ~80라인
**업데이트 빈도**: 낮음 (API 변경 시에만)

---

### 9. 📤 **background-uploader.js** - 백그라운드 업로더
> **역할**: 파일 업로드 큐 관리 및 실패 시 재시도 처리

```javascript
// 주요 기능
- 파일 업로드 큐 관리
- 실패 시 자동 재시도 (최대 3회)
- 네트워크 상태 모니터링
- 업로드 진행률 추적

// 핵심 메서드
- addToQueue()          // 큐에 업로드 작업 추가
- processQueue()        // 큐 처리 시작
- retryFailedUploads()  // 실패한 업로드 재시도
```

**의존성**: electron-bridge.js
**크기**: ~200라인
**업데이트 빈도**: 낮음 (안정화된 큐 시스템)

---

### 10. 📎 **attachment-manager.js** - 첨부파일 관리자
> **역할**: 첨부파일 업로드, 다운로드, 미리보기 관리

```javascript
// 주요 기능
- 파일 업로드 및 Google Drive 저장
- 이미지 미리보기 생성
- 파일 타입별 아이콘 표시
- 첨부파일 메타데이터 관리

// 핵심 메서드
- uploadFile()          // 파일 업로드
- deleteFile()          // 파일 삭제
- generatePreview()     // 미리보기 생성
- getFileIcon()         // 파일 아이콘 반환
```

**의존성**: electron-bridge.js, background-uploader.js
**크기**: ~180라인
**업데이트 빈도**: 낮음 (기능 완성도 높음)

---

### 11. 🖨️ **print-stamp-manager.js** - 인쇄 도장 관리자
> **역할**: 인쇄 시에만 임시로 도장 이미지 추가 (보안상 저장하지 않음)

```javascript
// 주요 기능
- 인쇄 시 임시 도장 오버레이
- 도장 위치 및 크기 조정
- 인쇄 후 자동 제거 (보안)
- 사용자별 도장 설정 관리

// 핵심 메서드
- addStampsForPrint()   // 인쇄용 도장 추가
- removeStamps()        // 도장 제거
- loadStampSettings()   // 도장 설정 로드
```

**의존성**: utils.js
**크기**: ~120라인
**업데이트 빈도**: 낮음 (기능 완성됨)

---

### 12. 🛠️ **utils.js** - 유틸리티 함수
> **역할**: 공통 유틸리티 함수 모음

```javascript
// 주요 기능
- 날짜/시간 포맷팅
- ID 생성 (문서 ID, 첨부파일 ID)
- 문서번호 생성
- 데이터 검증 및 변환

// 핵심 함수
- generateId()          // 고유 ID 생성
- formatDate()          // 날짜 포맷팅
- generateDocNumber()   // 문서번호 생성
- validateDocument()    // 문서 유효성 검사
```

**의존성**: 없음 (순수 함수)
**크기**: ~80라인
**업데이트 빈도**: 낮음 (안정화된 유틸리티)

---

## 🔗 모듈 간 의존성 관계

### 의존성 트리
```
app.js
├── doc-state-manager.js
├── form-registry-service.js
│   └── electron-bridge.js
├── form-storage-service.js
│   └── db.js
├── storage-manager.js
│   ├── form-storage-service.js
│   ├── background-uploader.js
│   └── electron-bridge.js
├── attachment-manager.js
│   ├── electron-bridge.js
│   └── background-uploader.js
├── print-stamp-manager.js
│   └── utils.js
└── utils.js
```

### 의존성 레벨
- **Level 0** (기반): `db.js`, `electron-bridge.js`, `utils.js`
- **Level 1** (핵심): `form-storage-service.js`, `background-uploader.js`
- **Level 2** (비즈니스): `storage-manager.js`, `form-registry-service.js`, `doc-state-manager.js`
- **Level 3** (특화): `attachment-manager.js`, `print-stamp-manager.js`
- **Level 4** (UI): `app.js`

---

## 📊 모듈별 통계

| 모듈 | 라인 수 | 복잡도 | 의존성 | 업데이트 빈도 |
|------|---------|--------|--------|---------------|
| app.js | ~1,600 | 높음 | 높음 | 높음 |
| doc-state-manager.js | ~220 | 중간 | 낮음 | 낮음 |
| form-registry-service.js | ~400 | 중간 | 중간 | 중간 |
| form-storage-service.js | ~300 | 중간 | 낮음 | 낮음 |
| storage-manager.js | ~250 | 높음 | 높음 | 중간 |
| background-uploader.js | ~200 | 중간 | 낮음 | 낮음 |
| attachment-manager.js | ~180 | 낮음 | 중간 | 낮음 |
| cloud-db.js | ~150 | 낮음 | 낮음 | 없음(deprecated) |
| print-stamp-manager.js | ~120 | 낮음 | 낮음 | 낮음 |
| db.js | ~100 | 낮음 | 없음 | 낮음 |
| electron-bridge.js | ~80 | 낮음 | 없음 | 낮음 |
| utils.js | ~80 | 낮음 | 없음 | 낮음 |

---

## 🎯 개발 가이드라인

### 새 기능 추가 시
1. **독립 모듈**: 가능하면 새 파일로 분리
2. **의존성 최소화**: 필요한 모듈만 import
3. **단일 책임**: 하나의 모듈은 하나의 역할만
4. **테스트 가능**: 순수 함수 위주로 설계

### 기존 모듈 수정 시
1. **app.js**: UI 로직만, 비즈니스 로직은 별도 모듈로
2. **doc-state-manager.js**: 문서 상태 관련만
3. **form-storage-service.js**: 저장소 로직만
4. **utils.js**: 순수 함수만 추가

### 모듈 제거 시
1. **의존성 확인**: 다른 모듈에서 사용하는지 체크
2. **점진적 제거**: deprecated 마킹 → 경고 → 제거
3. **마이그레이션**: 기능이 다른 모듈로 이동했다면 가이드 제공

---

## 🔮 향후 모듈 계획

### v2.5.0 계획
- `cloud-db.js` 완전 제거
- `form-validation-service.js` 신규 추가 (양식별 검증 로직)
- `template-engine.js` 신규 추가 (동적 템플릿 렌더링)

### v3.0.0 계획
- `collaboration-service.js` 추가 (다중 사용자 협업)
- `report-generator.js` 추가 (보고서 생성)
- `notification-service.js` 추가 (실시간 알림)

---

## 📚 참고 자료

- [전체 아키텍처 가이드](./ARCHITECTURE.md)
- [코드 구조 설명](./CODE_WALKTHROUGH.md)
- [현재 상태](./CURRENT_STATUS.md)

---

> 💡 **팁**: 각 모듈의 상세 구현은 해당 `.js` 파일의 주석을 참고하세요.
> 🔧 **디버깅**: 문제 발생 시 의존성 트리를 따라 원인을 추적하세요.