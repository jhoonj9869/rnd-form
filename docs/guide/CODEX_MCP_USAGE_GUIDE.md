# Codex MCP 사용 가이드

## 도구별 사용 예시

### 1. codex_query - 일반 질문 및 분석
```javascript
// 코드 분석
mcp__codex__codex_query({
  prompt: "이 프로젝트의 calculator.js 파일에서 power 함수의 문제점을 분석해줘",
  model: "gpt-5-codex"  // 기본값, 생략 가능
})

// 일반 프로그래밍 질문
mcp__codex__codex_query({
  prompt: "JavaScript에서 비동기 처리를 위한 최선의 방법은?"
})

// 복잡한 문제 해결
mcp__codex__codex_query({
  prompt: "메모리 누수가 발생하는 것 같은데 원인을 찾는 방법을 알려줘",
  model: "o3"  // 복잡한 추론이 필요한 경우
})
```

### 2. codex_review - 코드 리뷰
```javascript
// 보안, 성능, 가독성 전체 리뷰
mcp__codex__codex_review({
  code: `
    class APIService {
      async authenticate(username, password) {
        console.log(\`Authenticating: \${username} password: \${password}\`);
        // ... 코드
      }
    }
  `,
  language: "javascript",
  focus: "all"  // security, performance, readability, all 중 선택
})

// 보안 중점 리뷰
mcp__codex__codex_review({
  code: "// 실제 코드 내용",
  language: "python",
  focus: "security"
})
```

### 3. codex_debug - 에러 디버깅
```javascript
// 기본 에러 분석
mcp__codex__codex_debug({
  error_message: "TypeError: Cannot read property 'name' of undefined"
})

// 컨텍스트 포함 디버깅
mcp__codex__codex_debug({
  error_message: "TypeError: Cannot read property 'name' of undefined",
  context_code: `
    function processUserData(users) {
      users.forEach(user => {
        const name = user.profile.name.first;
      });
    }
  `,
  language: "javascript",
  stack_trace: "at processUserData (test.js:3:29)"
})
```

### 4. codex_architect - 시스템 설계
```javascript
// 웹 애플리케이션 설계
mcp__codex__codex_architect({
  requirements: "할일 관리 웹앱: 사용자 인증, CRUD, 카테고리 관리 필요",
  type: "web",        // web, mobile, distributed, embedded, general
  scale: "medium"     // small, medium, enterprise
})

// 마이크로서비스 아키텍처
mcp__codex__codex_architect({
  requirements: "이커머스 플랫폼: 상품, 주문, 결제, 배송 관리",
  type: "distributed",
  scale: "enterprise"
})
```

### 5. codex_test - 테스트 생성
```javascript
// Jest 테스트 생성
mcp__codex__codex_test({
  code: `
    class Calculator {
      add(a, b) { return a + b; }
      divide(a, b) {
        if (b === 0) throw new Error("Cannot divide by zero");
        return a / b;
      }
    }
  `,
  framework: "jest",      // jest, pytest, junit, mocha, vitest, auto
  coverage_target: 80     // 목표 커버리지 %
})

// Python pytest
mcp__codex__codex_test({
  code: "def fibonacci(n): ...",
  framework: "pytest",
  coverage_target: 90
})
```

### 6. codex_refactor - 코드 개선
```javascript
// 복잡한 코드 단순화
mcp__codex__codex_refactor({
  code: `
    // 중첩된 if문과 for문
    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].active) {
          // ...
        }
      }
    }
  `,
  goal: "simplify",           // simplify, optimize, modernize, testable
  preserve_behavior: true     // 동작 유지 여부
})

// 성능 최적화
mcp__codex__codex_refactor({
  code: "// 느린 코드",
  goal: "optimize",
  preserve_behavior: true
})
```

### 7. codex_instructions - 지침 관리
```javascript
// 프로젝트 지침 읽기
mcp__codex__codex_instructions({
  action: "read",
  scope: "project"    // global, project, both
})

// 지침 작성
mcp__codex__codex_instructions({
  action: "write",
  scope: "project",
  content: "# 프로젝트 코딩 규칙\n- 함수형 프로그래밍 선호\n- 타입스크립트 strict 모드"
})

// 지침 추가
mcp__codex__codex_instructions({
  action: "append",
  scope: "global",
  content: "\n## 추가 규칙\n- 테스트 커버리지 80% 이상"
})

// 스마트 지침 생성
mcp__codex__codex_instructions({
  action: "generate",
  task: "React 컴포넌트 개발",
  template: "react",    // architect, debugger, reviewer, nodejs, python, react, custom
  scope: "project"
})

// 지침 검증
mcp__codex__codex_instructions({
  action: "validate",
  scope: "both"
})
```

### 8. codex_help - 도움말
```javascript
// 전체 도움말
mcp__codex__codex_help({
  topic: "all"
})

// 특정 주제
mcp__codex__codex_help({
  topic: "commands"    // commands, models, config, patterns, troubleshooting,
                       // best_practices, templates, all
})

// 특정 에러 해결
mcp__codex__codex_help({
  query: "spawn EINVAL error when running codex",
  topic: "troubleshooting"
})
```

## 실제 사용 시나리오

### 시나리오 1: 새 기능 개발
```javascript
// 1. 아키텍처 설계
codex_architect({
  requirements: "실시간 채팅 기능 추가",
  type: "web",
  scale: "medium"
})

// 2. 코드 작성 후 리뷰
codex_review({
  code: "// 작성한 코드",
  focus: "all"
})

// 3. 테스트 생성
codex_test({
  code: "// 채팅 로직 코드",
  framework: "jest"
})
```

### 시나리오 2: 버그 수정
```javascript
// 1. 에러 분석
codex_debug({
  error_message: "실제 에러 메시지",
  context_code: "// 에러 발생 코드",
  stack_trace: "// 스택 트레이스"
})

// 2. 수정된 코드 리뷰
codex_review({
  code: "// 수정한 코드",
  focus: "security"
})
```

### 시나리오 3: 코드 품질 개선
```javascript
// 1. 현재 코드 리뷰
codex_review({
  code: "// 레거시 코드",
  focus: "all"
})

// 2. 리팩토링
codex_refactor({
  code: "// 복잡한 코드",
  goal: "simplify"
})

// 3. 테스트 추가
codex_test({
  code: "// 리팩토링된 코드",
  coverage_target: 90
})
```

## 모델 선택 가이드

- **gpt-5-codex** (기본값): 코딩 특화, 빠른 응답
- **gpt-5**: 범용, 일반 질문
- **o1**: 중간 수준 추론, 디버깅
- **o3**: 최고 수준 추론, 복잡한 아키텍처
- **gpt-4o**: 안정적, 레거시 호환

## 팁과 주의사항

1. **프로젝트 컨텍스트**: 도구들은 현재 작업 디렉토리를 자동 인식
2. **한글 지원**: 모든 도구에서 한글 프롬프트 사용 가능
3. **Windows 호환**: 인코딩 문제 자동 처리
4. **성능**: 복잡한 작업은 o3 모델 사용 권장
5. **지침 활용**: codex_instructions로 프로젝트별 규칙 설정

## 문제 해결

에러 발생 시:
```javascript
// 1. 도움말 확인
codex_help({
  query: "발생한 에러 메시지",
  topic: "troubleshooting"
})

// 2. Codex CLI 로그인 상태 확인
// 터미널에서: codex login

// 3. Claude Code 재시작
// 터미널에서: claude restart
```