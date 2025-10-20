# 양식 시스템 설계 문서

> 📅 작성일: 2025-10-21
> 🎯 목적: 재사용 가능한 양식 시스템 설계 및 구현 가이드

## 📋 목차

1. [개요](#개요)
2. [설계 원칙](#설계-원칙)
3. [양식 구조](#양식-구조)
4. [컴포넌트 시스템](#컴포넌트-시스템)
5. [새 양식 만들기](#새-양식-만들기)
6. [스타일 관리](#스타일-관리)

---

## 개요

### 문제 정의

**현재 상황:**
- 지출결의서 양식이 하드코딩되어 있음
- 새 양식 추가 시 많은 코드 중복 발생
- 양식별 필드가 `app.js`에 직접 작성됨

**목표:**
- 양식 추가 시 재사용 가능한 컴포넌트 활용
- 데이터 구조와 UI 구조 분리
- 일관된 디자인 유지

---

## 설계 원칙

### 1. 데이터와 UI 분리

```
양식 = 데이터 구조 + UI 구조

[데이터 영역] - 독립적
  ├─ config.json: 필드 정의
  └─ 어떤 데이터를 저장할지

[UI 영역] - 독립적
  ├─ template.html: 화면 구성
  ├─ style.css: 스타일
  └─ 어떻게 보여줄지
```

**독립성:**
- 데이터 구조 변경 시 UI 영향 없음
- UI 디자인 변경 시 데이터 구조 영향 없음

---

### 2. 컴포넌트 재사용

```
재사용 가능한 UI 블록 라이브러리
  ├─ 문서 헤더 (문서번호, 날짜)
  ├─ 결재란 (2명/3명/4명)
  ├─ 기본정보 테이블
  ├─ 품목 테이블
  └─ 서명란

새 양식 = 컴포넌트 복사 + 약간 수정
```

**장점:**
- 개발 시간 단축 (복사 후 수정)
- 일관된 디자인
- AI/개발자가 조합 가능

---

### 3. 수동 조립 (자동화 ✗)

```
❌ 자동 생성: 복잡하고 오버엔지니어링
✅ 수동 조립: 간단하고 명확

1. 컴포넌트 라이브러리에서 필요한 것 복사
2. 필드명/레이블만 수정
3. 완성
```

---

## 양식 구조

### 파일 구성

```
src/forms/{form-id}/
├── config.json       # 필드 정의 (데이터 구조)
├── template.html     # 미리보기 화면 (UI)
├── style.css         # 양식 전용 스타일 (선택)
└── form-logic.js     # 양식별 로직 (선택)
```

---

### 1. config.json (필드 정의)

> **역할:** 문서의 데이터 구조 정의

```json
{
  "id": "expense-report",
  "name": "지출결의서",
  "version": "1.0.0",
  "description": "연구비 지출결의서 양식",
  "category": "financial",

  "fields": {
    "title": {
      "type": "text",
      "label": "제목",
      "required": true,
      "placeholder": "지출 내역을 입력하세요"
    },
    "department": {
      "type": "text",
      "label": "사용처",
      "required": true
    },
    "category": {
      "type": "select",
      "label": "지출과목",
      "required": true,
      "options": [
        { "value": "research-materials", "label": "연구재료비" },
        { "value": "research-equipment", "label": "연구장비비" }
      ]
    },
    "items": {
      "type": "array",
      "label": "품목 상세",
      "itemSchema": {
        "description": { "type": "text", "label": "품목명" },
        "quantity": { "type": "number", "label": "수량", "default": 1 },
        "unitPrice": { "type": "number", "label": "단가", "default": 0 }
      }
    }
  }
}
```

**사용처:**
- 우측 입력 패널 생성 (현재는 수동, 나중에 자동화 가능)
- 문서 데이터 저장 구조
- 필드 검증

---

### 2. template.html (미리보기 화면)

> **역할:** 중앙 미리보기 영역의 디자인 (A4 용지)

```html
<!-- 문서 헤더 -->
<div class="doc-header">
    <span class="doc-number" x-text="currentDoc.docNumber"></span>
    <span class="doc-date" x-text="formatDate(getField('date'))"></span>
</div>

<!-- 제목 + 결재란 -->
<div class="title-approval-container">
    <h1 class="doc-title">지출결의서</h1>

    <!-- 결재란 컴포넌트 -->
    <div class="approval-box">
        <table>
            <thead>
                <tr>
                    <th rowspan="2">결재</th>
                    <th>지출담당자</th>
                    <th>결재권자</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="sign-area"></td>
                    <td class="sign-area"></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<!-- 기본정보 테이블 -->
<table class="info-table">
    <tbody>
        <tr>
            <th>제목</th>
            <td colspan="3" x-text="getField('title')"></td>
        </tr>
        <tr>
            <th>사용처</th>
            <td x-text="getField('department')"></td>
            <th>사용자</th>
            <td x-text="getField('requester')"></td>
        </tr>
    </tbody>
</table>

<!-- 품목 테이블 -->
<table class="items-table">
    <thead>
        <tr>
            <th>번호</th>
            <th>품목명</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
        </tr>
    </thead>
    <tbody>
        <template x-for="(item, index) in getField('items')" :key="index">
            <tr>
                <td x-text="index + 1"></td>
                <td x-text="item.description"></td>
                <td x-text="item.quantity"></td>
                <td x-text="formatCurrency(item.unitPrice)"></td>
                <td x-text="formatCurrency(item.quantity * item.unitPrice)"></td>
            </tr>
        </template>
    </tbody>
</table>
```

**특징:**
- 개발자가 직접 디자인 (수동)
- `getField()` 함수로 데이터 바인딩
- Alpine.js 디렉티브 사용 (`x-text`, `x-for` 등)

---

### 3. style.css (양식 전용 스타일)

> **역할:** 양식만의 특별한 스타일 (선택사항)

```css
/* 공통 스타일 상속 */
@import '../../css/form-base.css';

/* 지출결의서만의 특별한 스타일 (있으면) */
.expense-specific-element {
    background: #fee2e2;
    border-left: 4px solid #dc2626;
    padding: 10px;
}
```

---

### 4. form-logic.js (양식별 로직)

> **역할:** 양식별 헬퍼 함수, 계산 로직 (선택사항)

```javascript
export default {
    /**
     * 지출과목 레이블 변환
     */
    getCategoryLabel(value) {
        const options = this.currentFormPlugin.config.fields.category.options;
        return options.find(o => o.value === value)?.label || value;
    },

    /**
     * 품목 합계 계산
     */
    calculateTotal() {
        const items = this.getField('items') || [];
        return items.reduce((sum, item) =>
            sum + (item.quantity || 0) * (item.unitPrice || 0), 0
        );
    },

    /**
     * 커스텀 검증
     */
    validate(doc) {
        const errors = [];

        const total = this.calculateTotal.call({
            getField: (name) => doc.fields[name]
        });

        if (total <= 0) {
            errors.push({
                field: 'amount',
                message: '품목을 최소 1개 이상 추가하세요'
            });
        }

        return errors;
    }
};
```

---

## 컴포넌트 시스템

### 컴포넌트 라이브러리 구조

```
src/forms/components/
├── README.md                    # 사용 가이드
├── doc-header.html             # 문서 헤더 (번호, 날짜)
├── approval-box-2col.html      # 결재란 2명
├── approval-box-3col.html      # 결재란 3명
├── approval-box-4col.html      # 결재란 4명
├── info-table-1col.html        # 기본정보 1열
├── info-table-2col.html        # 기본정보 2열
├── items-table-basic.html      # 품목 테이블 기본
├── items-table-with-total.html # 품목 테이블 + 합계
├── signature.html              # 서명란
└── notes-section.html          # 비고란
```

---

### 컴포넌트 작성 규칙

#### 1. 주석으로 사용법 명시

```html
<!-- components/approval-box-2col.html -->
<!--
사용법:
  1. 복사해서 template.html에 붙여넣기
  2. 역할명만 수정

수정 필요 항목:
  - <th>지출담당자</th> → 원하는 역할명
  - <th>결재권자</th> → 원하는 역할명
-->
<div class="approval-box">
    <table>
        <thead>
            <tr>
                <th rowspan="2">결재</th>
                <th>지출담당자</th>  <!-- 수정: 역할명 -->
                <th>결재권자</th>      <!-- 수정: 역할명 -->
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="sign-area"></td>
                <td class="sign-area"></td>
            </tr>
        </tbody>
    </table>
</div>
```

---

#### 2. 수정 지점 표시

```html
<!-- components/items-table-basic.html -->
<!--
수정 필요 항목:
  - 컬럼 헤더 (th): 품목명, 수량 등
  - 필드명: item.description, item.quantity 등
  - 불필요한 컬럼 삭제 가능
-->
<table class="items-table">
    <thead>
        <tr>
            <th>번호</th>
            <th>품목명</th>              <!-- 수정: 컬럼명 -->
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
        </tr>
    </thead>
    <tbody>
        <template x-for="(item, index) in getField('items')" :key="index">
            <tr>
                <td x-text="index + 1"></td>
                <td x-text="item.description"></td>  <!-- 수정: 필드명 -->
                <td x-text="item.quantity"></td>
                <td x-text="formatCurrency(item.unitPrice)"></td>
                <td x-text="formatCurrency(item.quantity * item.unitPrice)"></td>
            </tr>
        </template>
    </tbody>
</table>
```

---

#### 3. 변형 버전 제공

```
components/
├── approval-box-2col.html      # 결재자 2명
├── approval-box-3col.html      # 결재자 3명
├── approval-box-4col.html      # 결재자 4명
├── info-table-1col.html        # 1열 (전체 너비)
├── info-table-2col.html        # 2열 (좌/우)
└── items-table-basic.html      # 기본
    items-table-with-total.html # 합계 포함
```

---

## 새 양식 만들기

### 워크플로우 (10-30분 작업)

```bash
# 1. 폴더 생성
mkdir src/forms/purchase-order

# 2. 기존 양식에서 복사
cp src/forms/expense-report/template.html src/forms/purchase-order/
cp src/forms/expense-report/style.css src/forms/purchase-order/

# 3. config.json 새로 작성
# (JSON 편집)

# 4. template.html 수정
#   - 제목 변경
#   - 컴포넌트 교체/수정
#   - 필드명 변경

# 5. style.css 간소화
#   - @import '../common/style.css'
#   - 필요한 스타일만 추가

# 완료!
```

---

### 단계별 가이드

#### Step 1: config.json 작성

```json
{
  "id": "purchase-order",
  "name": "구매요청서",
  "version": "1.0.0",
  "category": "administrative",

  "fields": {
    "title": { "type": "text", "label": "제목", "required": true },
    "requester": { "type": "text", "label": "요청자", "required": true },
    "urgency": {
      "type": "select",
      "label": "긴급도",
      "options": [
        { "value": "normal", "label": "보통" },
        { "value": "urgent", "label": "긴급" }
      ]
    },
    "items": {
      "type": "array",
      "itemSchema": {
        "name": { "type": "text", "label": "품명" },
        "quantity": { "type": "number", "label": "수량" },
        "estimatedPrice": { "type": "number", "label": "예상 가격" }
      }
    }
  }
}
```

---

#### Step 2: template.html 조립

```html
<!-- 1. 문서 헤더 (components/doc-header.html 복사) -->
<div class="doc-header">
    <span class="doc-number" x-text="currentDoc.docNumber"></span>
</div>

<!-- 2. 제목 수정 -->
<h1 class="doc-title">구매요청서</h1>  <!-- 지출결의서 → 구매요청서 -->

<!-- 3. 결재란 (components/approval-box-3col.html 복사 후 수정) -->
<div class="approval-box">
    <table>
        <thead>
            <tr>
                <th rowspan="2">결재</th>
                <th>요청자</th>      <!-- 수정됨 -->
                <th>부서장</th>      <!-- 수정됨 -->
                <th>대표이사</th>    <!-- 수정됨 -->
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="sign-area"></td>
                <td class="sign-area"></td>
                <td class="sign-area"></td>
            </tr>
        </tbody>
    </table>
</div>

<!-- 4. 기본정보 (components/info-table-2col.html 복사 후 수정) -->
<table class="info-table">
    <tbody>
        <tr>
            <th>제목</th>
            <td colspan="3" x-text="getField('title')"></td>
        </tr>
        <tr>
            <th>요청자</th>  <!-- department → requester -->
            <td x-text="getField('requester')"></td>
            <th>긴급도</th>  <!-- 추가됨 -->
            <td x-text="getField('urgency')"></td>
        </tr>
    </tbody>
</table>

<!-- 5. 품목 테이블 (components/items-table-basic.html 복사 후 수정) -->
<table class="items-table">
    <thead>
        <tr>
            <th>번호</th>
            <th>품명</th>        <!-- description → name -->
            <th>수량</th>
            <th>예상 가격</th>  <!-- unitPrice → estimatedPrice -->
        </tr>
    </thead>
    <tbody>
        <template x-for="(item, index) in getField('items')" :key="index">
            <tr>
                <td x-text="index + 1"></td>
                <td x-text="item.name"></td>  <!-- 수정됨 -->
                <td x-text="item.quantity"></td>
                <td x-text="formatCurrency(item.estimatedPrice)"></td>  <!-- 수정됨 -->
            </tr>
        </template>
    </tbody>
</table>
```

---

#### Step 3: form-logic.js 작성 (선택)

```javascript
export default {
    getUrgencyLabel(value) {
        const labels = { normal: '보통', urgent: '긴급' };
        return labels[value] || value;
    },

    calculateTotal() {
        const items = this.getField('items') || [];
        return items.reduce((sum, item) =>
            sum + (item.quantity || 0) * (item.estimatedPrice || 0), 0
        );
    }
};
```

---

## 스타일 관리

### CSS 파일 구조

```
src/css/
├── form-base.css          # 모든 양식 공통 (필수)
└── main.css               # 앱 전역 스타일

src/forms/{form-id}/
└── style.css              # 양식 전용 (선택)
```

---

### form-base.css (공통 스타일)

```css
/* A4 용지 */
.preview-paper {
    width: 210mm;
    min-height: 297mm;
    background: white;
    padding: 15mm 20mm;
}

/* 문서 헤더 */
.doc-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    font-size: 12px;
    color: #666;
}

/* 문서 제목 */
.doc-title {
    font-size: 28px;
    font-weight: bold;
    text-align: center;
    margin: 20px 0;
}

/* 결재란 */
.approval-box table {
    border: 2px solid #000;
    border-collapse: collapse;
}

.approval-box th,
.approval-box td {
    border: 1px solid #000;
    padding: 8px;
    text-align: center;
}

.approval-box .sign-area {
    height: 60px;
    width: 80px;
}

/* 기본정보 테이블 */
.info-table {
    width: 100%;
    border: 2px solid #000;
    border-collapse: collapse;
    margin-bottom: 20px;
}

.info-table th {
    background: #f5f5f5;
    width: 15%;
    padding: 10px;
    text-align: center;
    border: 1px solid #000;
}

.info-table td {
    padding: 10px;
    border: 1px solid #000;
}

/* 품목 테이블 */
.items-table {
    width: 100%;
    border: 2px solid #000;
    border-collapse: collapse;
    margin-bottom: 20px;
}

.items-table th {
    background: #f5f5f5;
    padding: 8px;
    text-align: center;
    border: 1px solid #000;
}

.items-table td {
    padding: 8px;
    text-align: center;
    border: 1px solid #000;
}
```

---

### 양식별 스타일 (선택사항)

```css
/* src/forms/expense-report/style.css */

/* 공통 스타일 상속 */
@import '../../css/form-base.css';

/* 지출결의서만의 스타일 (있으면) */
.expense-specific-badge {
    background: #fee2e2;
    color: #dc2626;
    padding: 2px 6px;
    border-radius: 4px;
}
```

---

### 스타일 일괄 변경

**모든 양식 변경:**
```css
/* src/css/form-base.css 수정 */
.info-table {
    border: 1px solid #000;  /* 2px → 1px */
}
```

**특정 양식만 변경:**
```css
/* src/forms/expense-report/style.css 수정 */
.info-table {
    border: 3px solid #dc2626;  /* 빨간색 굵은 테두리 */
}
```

---

## 베스트 프랙티스

### ✅ 권장사항

1. **컴포넌트 우선**
   - 새 요소 만들기 전에 컴포넌트 라이브러리 확인
   - 비슷한 컴포넌트 복사 후 수정

2. **명확한 주석**
   - 수정 필요 항목 표시
   - 사용 예시 포함

3. **일관된 네이밍**
   - CSS 클래스: kebab-case (`.doc-header`)
   - 필드명: camelCase (`requester`)
   - 파일명: kebab-case (`purchase-order`)

4. **최소한의 커스텀**
   - 공통 스타일 최대한 활용
   - 양식별 CSS는 정말 필요할 때만

---

### ❌ 피해야 할 것

1. **중복 코드**
   - 컴포넌트를 복사하되, 라이브러리 업데이트는 반영

2. **과도한 커스터마이징**
   - 모든 양식이 다른 디자인이면 일관성 저하

3. **하드코딩**
   - 필드값을 HTML에 직접 작성
   - 항상 `getField()` 사용

---

## 체크리스트

### 새 양식 추가 시

```markdown
[ ] 1. config.json 작성
    - 필드 정의 완료
    - 필수 항목 표시
    - select 옵션 정의

[ ] 2. template.html 조립
    - 컴포넌트 라이브러리에서 선택
    - 필드명 수정
    - 레이블 수정

[ ] 3. style.css (선택)
    - 공통 스타일 import
    - 특별한 스타일만 추가

[ ] 4. form-logic.js (선택)
    - 헬퍼 함수 작성
    - 계산 로직 작성
    - 검증 로직 작성

[ ] 5. 테스트
    - 입력 패널 동작 확인
    - 미리보기 화면 확인
    - 인쇄 확인
    - 저장/불러오기 확인
```

---

## 참고 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 전체 시스템 아키텍처
- [PRD.md](./PRD.md) - 제품 요구사항
- [components/README.md](../src/forms/components/README.md) - 컴포넌트 사용 가이드
