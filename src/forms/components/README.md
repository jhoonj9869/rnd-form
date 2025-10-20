# 양식 컴포넌트 라이브러리

> 📦 재사용 가능한 UI 블록 모음
> 🎯 복사해서 약간 수정만 하면 바로 사용 가능

## 📋 목차

- [컴포넌트 목록](#컴포넌트-목록)
- [사용 방법](#사용-방법)
- [컴포넌트 상세](#컴포넌트-상세)

---

## 컴포넌트 목록

### 필수 컴포넌트

| 컴포넌트 | 파일명 | 설명 |
|---------|--------|------|
| 문서 헤더 | `doc-header.html` | 문서번호, 날짜 |
| 결재란 (2명) | `approval-box-2col.html` | 결재자 2명 |
| 결재란 (3명) | `approval-box-3col.html` | 결재자 3명 |
| 결재란 (4명) | `approval-box-4col.html` | 결재자 4명 |
| 기본정보 (1열) | `info-table-1col.html` | 전체 너비 |
| 기본정보 (2열) | `info-table-2col.html` | 좌우 분할 |
| 품목 테이블 | `items-table-basic.html` | 기본 품목 목록 |
| 품목 테이블 (합계) | `items-table-with-total.html` | 합계 포함 |
| 서명란 | `signature.html` | 하단 서명 |
| 비고란 | `notes-section.html` | 추가 설명 |

---

## 사용 방법

### 기본 워크플로우

```bash
# 1. 필요한 컴포넌트 파일 열기
cat src/forms/components/doc-header.html

# 2. 내용 복사

# 3. template.html에 붙여넣기

# 4. 수정 필요 항목만 변경
#    - <!-- 수정: 레이블 --> 주석 찾기
#    - 필드명 변경 (department → buyer)
#    - 레이블 변경 (사용처 → 구매자)

# 완성!
```

---

### 수정 지점 표시

모든 컴포넌트는 수정이 필요한 부분을 주석으로 표시합니다:

```html
<!-- 수정: 역할명 -->
<th>지출담당자</th>

<!-- 수정: 필드명 -->
<td x-text="getField('department')"></td>

<!-- 수정: 레이블 -->
<th>사용처</th>
```

---

## 컴포넌트 상세

### 1. 문서 헤더 (doc-header.html)

**용도:** 문서번호와 날짜 표시

**수정 불필요** - 그대로 복사해서 사용

```html
<div class="doc-header">
    <span class="doc-number" x-text="currentDoc.docNumber"></span>
    <span class="doc-date" x-text="formatDate(getField('date'))"></span>
</div>
```

---

### 2. 결재란 (approval-box-{2,3,4}col.html)

**용도:** 결재자 서명 영역

**수정 항목:**
- 역할명 (지출담당자 → 요청자)

**2명 버전:**
```html
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

**3명 버전:**
```html
<div class="approval-box">
    <table>
        <thead>
            <tr>
                <th rowspan="2">결재</th>
                <th>요청자</th>      <!-- 수정: 역할명 -->
                <th>부서장</th>      <!-- 수정: 역할명 -->
                <th>대표이사</th>    <!-- 수정: 역할명 -->
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
```

---

### 3. 기본정보 테이블 (info-table-{1,2}col.html)

**용도:** 문서 기본 정보 표시

**수정 항목:**
- 레이블 (제목, 사용처 등)
- 필드명 (title, department 등)
- 행 추가/삭제

**1열 버전 (전체 너비):**
```html
<table class="info-table">
    <tbody>
        <tr>
            <th>제목</th>              <!-- 수정: 레이블 -->
            <td colspan="3" x-text="getField('title')"></td>  <!-- 수정: 필드명 -->
        </tr>
        <tr>
            <th>내용</th>              <!-- 수정: 레이블 -->
            <td colspan="3" x-text="getField('content')"></td>  <!-- 수정: 필드명 -->
        </tr>
    </tbody>
</table>
```

**2열 버전 (좌우 분할):**
```html
<table class="info-table">
    <tbody>
        <tr>
            <th>제목</th>              <!-- 수정: 레이블 -->
            <td colspan="3" x-text="getField('title')"></td>  <!-- 수정: 필드명 -->
        </tr>
        <tr>
            <th>사용처</th>            <!-- 수정: 레이블 -->
            <td x-text="getField('department')"></td>  <!-- 수정: 필드명 -->
            <th>사용자</th>            <!-- 수정: 레이블 -->
            <td x-text="getField('requester')"></td>  <!-- 수정: 필드명 -->
        </tr>
        <tr>
            <th>지출과목</th>          <!-- 수정: 레이블 -->
            <td x-text="getField('category')"></td>  <!-- 수정: 필드명 -->
            <th>지출방법</th>          <!-- 수정: 레이블 -->
            <td x-text="getField('paymentMethod')"></td>  <!-- 수정: 필드명 -->
        </tr>
    </tbody>
</table>
```

**행 추가/삭제:**
```html
<!-- 행 추가 -->
<tr>
    <th>새 항목</th>
    <td x-text="getField('newField')"></td>
</tr>

<!-- 행 삭제 -->
<!-- 불필요한 <tr>...</tr> 블록 제거 -->
```

---

### 4. 품목 테이블 (items-table-{basic,with-total}.html)

**용도:** 품목 목록 표시

**수정 항목:**
- 컬럼 헤더 (품목명, 수량 등)
- 필드명 (description, quantity 등)
- 컬럼 추가/삭제
- 계산 로직 (quantity * unitPrice)

**기본 버전:**
```html
<table class="items-table">
    <thead>
        <tr>
            <th style="width: 50px;">번호</th>
            <th>품목명</th>              <!-- 수정: 컬럼명 -->
            <th style="width: 80px;">수량</th>
            <th style="width: 120px;">단가</th>
            <th style="width: 120px;">금액</th>
        </tr>
    </thead>
    <tbody>
        <!-- 수정: getField('items') - 필드명 변경 가능 -->
        <template x-for="(item, index) in getField('items')" :key="index">
            <tr>
                <td x-text="index + 1"></td>
                <td x-text="item.description"></td>  <!-- 수정: 필드명 -->
                <td x-text="item.quantity"></td>
                <td x-text="formatCurrency(item.unitPrice)"></td>  <!-- 수정: 필드명 -->
                <td x-text="formatCurrency(item.quantity * item.unitPrice)"></td>  <!-- 수정: 계산식 -->
            </tr>
        </template>
    </tbody>
</table>
```

**합계 포함 버전:**
```html
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
    <tfoot>
        <tr>
            <td colspan="4">합계</td>
            <!-- 수정: 계산 함수명 -->
            <td x-text="formatCurrency(callFormHelper('calculateTotal'))"></td>
        </tr>
    </tfoot>
</table>
```

**컬럼 추가:**
```html
<thead>
    <tr>
        <th>번호</th>
        <th>품목명</th>
        <th>규격</th>  <!-- 추가 -->
        <th>수량</th>
    </tr>
</thead>
<tbody>
    <template x-for="(item, index) in getField('items')">
        <tr>
            <td x-text="index + 1"></td>
            <td x-text="item.description"></td>
            <td x-text="item.spec"></td>  <!-- 추가 -->
            <td x-text="item.quantity"></td>
        </tr>
    </template>
</tbody>
```

**컬럼 삭제:**
```html
<!-- 단가, 금액 컬럼 삭제 -->
<thead>
    <tr>
        <th>번호</th>
        <th>품목명</th>
        <th>수량</th>
        <!-- <th>단가</th> 삭제 -->
        <!-- <th>금액</th> 삭제 -->
    </tr>
</thead>
```

---

### 5. 서명란 (signature.html)

**용도:** 문서 하단 서명 영역

**수정 항목:**
- 서명 문구
- 날짜 필드명
- 서명자 정보 필드명

```html
<div class="doc-footer">
    <p class="submit-text">위 금액을 정히 청구합니다.</p>  <!-- 수정: 문구 -->
    <p class="submit-date" x-text="formatDate(getField('submitDate'))"></p>  <!-- 수정: 필드명 -->
    <p class="submitter">
        <span x-show="getField('submitterTitle')"
              x-text="getField('submitterTitle')"></span>  <!-- 수정: 필드명 -->
        <span x-text="getField('submitterName')"></span>  <!-- 수정: 필드명 -->
        <span class="sign-placeholder">(인)</span>
    </p>
</div>
```

---

### 6. 비고란 (notes-section.html)

**용도:** 추가 설명 영역

**수정 항목:**
- 제목 (비고 → 특이사항)
- 필드명 (notes → remarks)

```html
<div class="notes-section" x-show="getField('notes')">  <!-- 수정: 필드명 -->
    <h3>비고</h3>  <!-- 수정: 제목 -->
    <p x-text="getField('notes')"></p>  <!-- 수정: 필드명 -->
</div>
```

---

## 스타일 적용

모든 컴포넌트는 `src/css/form-base.css`의 스타일을 사용합니다.

**공통 CSS 클래스:**
- `.doc-header` - 문서 헤더
- `.doc-title` - 문서 제목
- `.approval-box` - 결재란
- `.info-table` - 기본정보 테이블
- `.items-table` - 품목 테이블
- `.doc-footer` - 문서 하단
- `.notes-section` - 비고란

**커스텀 스타일이 필요하면:**
```css
/* 양식의 style.css */
@import '../../css/form-base.css';

/* 특별한 스타일 추가 */
.custom-element {
    background: #fee2e2;
}
```

---

## Alpine.js 함수 참조

컴포넌트에서 사용 가능한 함수들:

### 필드 접근
```javascript
getField('title')           // 필드 값 읽기
setField('title', '...')    // 필드 값 쓰기
```

### 포맷팅
```javascript
formatDate(date)            // 날짜 포맷 (YYYY-MM-DD → YYYY년 MM월 DD일)
formatCurrency(amount)      // 금액 포맷 (1000 → 1,000원)
toKoreanAmount(amount)      // 한글 금액 (1000 → 일천원)
```

### 양식별 헬퍼
```javascript
callFormHelper('calculateTotal')           // 합계 계산
callFormHelper('getCategoryLabel', value)  // 레이블 변환
```

---

## 예제

### 예제 1: 구매요청서

```html
<!-- doc-header 컴포넌트 -->
<div class="doc-header">
    <span class="doc-number" x-text="currentDoc.docNumber"></span>
</div>

<!-- 제목 -->
<h1 class="doc-title">구매요청서</h1>

<!-- approval-box-3col 컴포넌트 (수정) -->
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

<!-- info-table-2col 컴포넌트 (수정) -->
<table class="info-table">
    <tbody>
        <tr>
            <th>제목</th>
            <td colspan="3" x-text="getField('title')"></td>
        </tr>
        <tr>
            <th>요청자</th>  <!-- 수정됨 -->
            <td x-text="getField('requester')"></td>
            <th>긴급도</th>  <!-- 수정됨 -->
            <td x-text="getField('urgency')"></td>
        </tr>
    </tbody>
</table>

<!-- items-table-basic 컴포넌트 (수정) -->
<table class="items-table">
    <thead>
        <tr>
            <th>번호</th>
            <th>품명</th>        <!-- 수정됨 -->
            <th>수량</th>
            <th>예상 가격</th>  <!-- 수정됨 -->
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

## 새 컴포넌트 추가 가이드

컴포넌트 라이브러리에 새로운 컴포넌트를 추가하려면:

### 1. 파일 생성

```bash
# components 폴더에 새 HTML 파일 생성
touch src/forms/components/my-component.html
```

### 2. 템플릿 작성

```html
<!--
컴포넌트 이름: 내 컴포넌트
용도: 특별한 기능 수행

사용법:
  1. 복사해서 template.html에 붙여넣기
  2. 필드명 수정

수정 필요 항목:
  - <th>레이블</th> → 원하는 레이블
  - getField('fieldName') → 필드명
-->
<div class="my-component">
    <table>
        <tr>
            <th>레이블</th>  <!-- 수정: 레이블 -->
            <td x-text="getField('fieldName')"></td>  <!-- 수정: 필드명 -->
        </tr>
    </table>
</div>
```

### 3. README 업데이트

이 파일의 "컴포넌트 목록"에 추가

### 4. 스타일 추가 (필요시)

```css
/* src/css/form-base.css */
.my-component {
    /* 스타일 정의 */
}
```

---

## 문제 해결

### Q: 컴포넌트를 복사했는데 데이터가 안 나옵니다

**A:** 필드명 확인
```html
<!-- ❌ 잘못된 예 -->
<td x-text="getField('department')"></td>

<!-- config.json에 department 필드가 없음 -->
```

```html
<!-- ✅ 올바른 예 -->
<td x-text="getField('buyer')"></td>

<!-- config.json에 buyer 필드가 있음 -->
```

---

### Q: 스타일이 적용 안 됩니다

**A:** CSS import 확인
```css
/* style.css */
@import '../../css/form-base.css';  /* 경로 확인 */
```

---

### Q: Alpine.js 에러가 발생합니다

**A:** 함수명 확인
```html
<!-- ❌ 잘못된 함수 -->
<td x-text="formatMoney(amount)"></td>

<!-- ✅ 올바른 함수 -->
<td x-text="formatCurrency(amount)"></td>
```

---

## 관련 문서

- [FORM_SYSTEM_DESIGN.md](../../docs/FORM_SYSTEM_DESIGN.md) - 양식 시스템 전체 설계
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) - 시스템 아키텍처
