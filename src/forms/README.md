# 양식 디렉토리 구조

## 📁 디렉토리 구조
```
forms/
├── forms-registry.json     # 전체 양식 목록 및 카테고리 정의
├── expense-report/         # 지출결의서 양식
│   ├── config.json        # 양식 설정 및 필드 정의
│   ├── template.html      # HTML 템플릿
│   └── style.css          # 양식별 스타일
└── [other-forms]/         # 추가 양식들
```

## 🔧 양식 추가 방법

### 1. 새 양식 디렉토리 생성
```bash
mkdir src/forms/[form-id]
```

### 2. 필수 파일 생성
- `config.json`: 양식 설정 및 필드 정의
- `template.html`: HTML 템플릿 (Alpine.js 바인딩 포함)
- `style.css`: 양식별 커스텀 스타일

### 3. forms-registry.json에 등록
```json
{
  "id": "form-id",
  "name": "양식 이름",
  "path": "/forms/form-id",
  "icon": "아이콘",
  "category": "카테고리",
  "description": "설명",
  "version": "1.0.0",
  "enabled": true
}
```

## 📋 양식 설정 (config.json)

### 필드 타입
- `text`: 텍스트 입력
- `number`: 숫자 입력
- `date`: 날짜 선택
- `select`: 드롭다운 선택
- `checkbox`: 체크박스
- `textarea`: 여러 줄 텍스트
- `array`: 반복 가능한 항목 (품목 등)

### 필드 속성
- `required`: 필수 여부
- `readonly`: 읽기 전용
- `autoGenerate`: 자동 생성 (문서번호 등)
- `default`: 기본값
- `placeholder`: 안내 텍스트
- `min/max`: 최소/최대값
- `options`: 선택 옵션 (select 타입)

## 🎨 템플릿 작성 가이드

### Alpine.js 바인딩
```html
<!-- 텍스트 표시 -->
<span x-text="currentDoc.fieldName"></span>

<!-- 조건부 표시 -->
<div x-show="currentDoc.fieldName">...</div>

<!-- 반복 -->
<template x-for="item in currentDoc.items">
  <tr>
    <td x-text="item.name"></td>
  </tr>
</template>
```

### 유틸리티 함수
- `formatDate(date)`: 날짜 형식화
- `formatCurrency(amount)`: 통화 형식화
- `toKoreanAmount(amount)`: 한글 금액 변환
- `formatDateTime(datetime)`: 날짜/시간 형식화

## 🚀 양식 활성화

1. `forms-registry.json`에서 `enabled: true` 설정
2. 개발 서버 재시작
3. 왼쪽 사이드바 "양식 목록"에서 확인

## 📝 예제 양식

### 현재 구현된 양식
- **지출결의서** (`expense-report`): 연구비 지출 신청용

### 추가 가능한 양식 예시
- 휴가신청서
- 출장신청서
- 구매요청서
- 회의록
- 근태신청서