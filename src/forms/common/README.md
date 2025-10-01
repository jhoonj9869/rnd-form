# Common Template (공통 템플릿)

## 📁 파일 구조

모든 양식 폴더와 동일한 파일명 규칙:
- `template.html` - 템플릿 파일 (새 양식 만들 때 복사)
- `style.css` - 공통 스타일
- `config.json` - (필요시) 공통 설정

## 🎯 용어 정리

### 템플릿 (Template)
- **양식 템플릿**: 각 양식별 HTML 구조 (`expense-report/template.html`)
- **공통 템플릿**: 새 양식 생성용 기본 구조 (`common/template.html`)

### 파일명 규칙
모든 양식 폴더에서 동일:
```
forms/
├── expense-report/
│   ├── template.html    # 지출결의서 템플릿
│   ├── style.css        # 지출결의서 스타일
│   └── config.json      # 지출결의서 설정
├── purchase-order/
│   ├── template.html    # 구매요청서 템플릿
│   ├── style.css        # 구매요청서 스타일
│   └── config.json      # 구매요청서 설정
└── common/
    ├── template.html    # 새 양식용 기본 템플릿
    ├── style.css        # 공통 스타일
    └── template-reference.html  # 참조용 구조 설명
```

## 🔧 새 양식 만들기

1. `common/template.html` 복사
2. 새 폴더 생성 (예: `forms/travel-report/`)
3. 파일명은 그대로 `template.html` 유지
4. doc-content 영역만 수정
5. 필요시 `style.css` 추가 (공통 스타일 import)

## 💡 앱이 인식하는 방법

앱은 항상 각 양식 폴더에서:
- `template.html` 파일을 찾아서 로드
- `style.css` 파일이 있으면 추가 로드
- `config.json` 파일이 있으면 설정 적용

파일명이 동일하므로 양식 전환이 간단합니다.