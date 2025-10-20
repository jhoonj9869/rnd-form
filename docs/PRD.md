# 제품 요구사항 문서 (PRD) - RND Form

## 1. 제품 개요

### 1.1 제품명
RND Form - 지출결의서 관리 시스템

### 1.2 버전 진화
- **v1.0**: 웹 기반 단일 HTML (완료)
- **v2.0**: Electron 데스크톱 앱 + 클라우드 (완료)
- **v2.2.5**: 이중 저장소 구조 (완료)
- **v2.5.0-pre**: 중앙 초기화 지점 아키텍처 (설계 완료)

### 1.3 목적
- 연구소 내부 지출결의서 작성 및 관리
- 팀 협업을 위한 구글드라이브 연동
- 오프라인/온라인 하이브리드 지원

### 1.4 대상 사용자
- 소규모 연구소/팀 구성원
- 회계 담당자
- 결재권자

### 1.5 핵심 가치
- **간단함**: 원클릭 설치, 자동 업데이트
- **협업**: 구글드라이브 실시간 동기화
- **안전함**: 이중 저장소 구조 (Workspace/Cache)
- **효율적**: 반복 작업 자동화, 실시간 미리보기

## 2. 기능 요구사항

### 2.1 완료된 기능 ✅

#### 기본 기능 (v1.0)
- [x] 3컬럼 레이아웃 UI
- [x] 지출결의서 작성/수정
- [x] IndexedDB 저장/불러오기
- [x] 문서번호 자동 생성 (YYYY-MM-DD-NNN)
- [x] 한글 금액 자동 변환
- [x] 실시간 미리보기
- [x] WYSIWYG 인쇄
- [x] 문서 검색/필터링
- [x] 품목 자동 계산
- [x] 자유입력 섹션

#### 클라우드 통합 (v2.0)
- [x] Electron 데스크톱 앱
- [x] Google Drive OAuth2 인증
- [x] 자동 동기화
- [x] 첨부파일 직접 저장
- [x] 자동 업데이트 (GitHub Releases)

#### 이중 저장소 구조 (v2.2.5)
- [x] Workspace (편집 중인 로컬 문서)
- [x] Cache (클라우드 동기화된 읽기 전용)
- [x] 트랜잭션 원자성 보장
- [x] 에러 핸들링 강화
- [x] 메모리 최적화

#### 중앙 초기화 지점 (v2.5.0) ✅
- [x] 계층적 상태 관리 원칙 설계
- [x] UI/기능 계층 구조 설계
- [x] 메인화면 초기화 상태 설계
- [x] 상태 관리 원칙 문서화
- [x] 중앙 초기화 지점 구현 (setCurrentDocument 메서드)
- [x] 메인화면 A4 백지 및 가이드 구현
- [x] 계층별 초기화 함수 구현 (document/form/system level)
- [x] DocStateManager와 완전 통합
- [x] 기존 메서드 리팩토링 완료

### 2.2 개발 중인 기능 🚧
- [x] 다중 양식 지원 (구매요청서, 출장보고서) - 기본 템플릿 완료
- [ ] 결재 워크플로우
- [ ] 통계/리포트

## 3. 기술 요구사항

### 3.1 저장 체계

#### 이중 저장 구조
```
작성/수정 → Workspace(로컬) → [동기화] → Google Drive → Cache(읽기전용)
```

#### 저장소 상태
- **Workspace**: isDraft=true, isFromWorkspace=true
- **Cache**: isReadOnly=true, isFromCache=true

### 3.2 구글드라이브 폴더 구조
```
구글드라이브/
└── RND-Form/
    ├── expense-report/        # 지출결의서
    │   ├── 2025-09-17-001.json
    │   └── attachments/       # 첨부파일
    ├── purchase-order/        # 구매요청서 (향후)
    └── travel-report/         # 출장보고서 (향후)
```

### 3.3 동기화 정책
- **Pull**: 앱 시작 시 자동, 새로고침 버튼
- **Push**: 명시적 저장 버튼 클릭
- **충돌 해결**: 사용자 선택 (로컬/클라우드)

## 4. 비기능 요구사항

### 4.1 성능
- 초기 로딩: < 1초
- 문서 저장: < 100ms
- 검색 응답: < 200ms (1000건 기준)
- 트랜잭션: 단일 트랜잭션으로 원자성 보장

### 4.2 보안
- 인쇄 보안 (v2.4.0+): WYSIWYG 방식 - 민감 정보는 양식 UI에서만 추가
- OAuth2 토큰: electron-store 암호화 저장
- 데이터 무결성: 트랜잭션 롤백 지원

### 4.3 호환성
- Windows 10+
- Chrome 90+, Edge 90+, Firefox 88+
- Node.js 18+

## 5. 데이터 모델

### 5.1 Document Schema
```typescript
interface Document {
  // 기본 필드
  id: string;
  docNumber: string;
  title: string;
  amount: number;
  department: string;
  requester: string;

  // 양식별 필드
  items: Item[];
  free: { entries: FreeEntry[] };

  // 상태 필드
  status: 'draft' | 'approved';
  isDraft?: boolean;
  isReadOnly?: boolean;

  // 저장소 필드
  isFromWorkspace?: boolean;
  isFromCache?: boolean;
  lastModified?: string;
  cloudSyncedAt?: string;

  // 타임스탬프
  createdAt: Date;
  updatedAt: Date;
}
```

## 6. UI/UX 사양

### 6.1 레이아웃
- **3컬럼**: 목록(2) : 미리보기(5) : 입력(3)
- **최소 너비**: 1280px
- **인쇄** (v2.4.0+): WYSIWYG - 미리보기 화면 그대로 출력

### 6.1.1 메인화면 초기화 상태 (v2.5.0-pre)

#### 초기 상태 (currentDoc = null)
- **중앙 미리보기**:
  - 회색 배경 대신 흰색 A4 용지 표시
  - 용지 크기: A4 비율 (210mm × 297mm)
  - 그림자 효과로 실제 종이 느낌 구현

- **우측 입력 패널**:
  - 사용 가이드 표시 영역
  - 컨텍스트별 안내 메시지
  - 주요 기능 단축키 안내

#### 가이드 메시지 종류
```
초기 접속: "새 문서를 작성하거나 기존 문서를 선택하세요."
양식 전환: "{양식명} 양식이 선택되었습니다."
전체 새로고침: "모든 양식이 새로고침되었습니다."
```

#### 상호작용 패턴
- 문서 선택 시: 가이드 모드 → 문서 편집 모드
- 새 문서 생성: 가이드 모드 → 빈 문서 편집 모드
- 양식 전환: 현재 모드 유지하며 컨텍스트 업데이트

### 6.2 단축키
- `Ctrl+S`: 저장
- `Ctrl+P`: 인쇄
- `Ctrl+N`: 새 문서
- `Ctrl+F`: 검색

### 6.3 상태 표시
- 작업중 배지: Workspace 문서
- 클라우드 배지: Cache 문서
- 동기화 인디케이터

## 7. 기술 스택

### 7.1 Frontend
- Alpine.js 3.x
- CSS Grid
- IndexedDB v2 (이중 저장소)

### 7.2 Backend
- Electron 38+
- Google Drive API v3
- OAuth2

### 7.3 빌드/배포
- Vite (웹 빌드)
- electron-builder (데스크톱)
- GitHub Releases (자동 업데이트)

## 8. 성공 지표
- 문서 작성 시간 30% 단축 ✅
- 데이터 손실 0건 ✅
- 동기화 충돌 최소화
- 유지보수 시간 50% 감소

## 9. 제약사항
- 모바일 미지원 (데스크톱 전용)
- 오프라인 시 클라우드 기능 제한
- 실시간 협업 미지원 (순차 동기화)

---
*최초 작성: 2025-09-15*
*최종 수정: 2025-09-23*
*현재 버전: v2.5.0-pre*