# NEW_TECH

새로운 추론 기술을 날짜별·개념별로 축적하는 정적 기술 공유 사이트입니다.

- 진입 페이지: `new_tech.html`
- 날짜별 목차: `content/manifest.json`
- 개념별 본문: `content/YYYY-MM-DD/*.html`
- 공통 표현/상호작용: `assets/`

## 로컬 실행

```bash
uv run --no-project python -m http.server 8000 --bind 0.0.0.0
```

브라우저에서 `http://localhost:8000/new_tech.html`을 엽니다. 정적 호스팅에서는 루트 `index.html`이 `new_tech.html`로 연결됩니다.

## 새 날짜 추가

1. `content/YYYY-MM-DD/` 아래에 개념별 HTML fragment를 추가합니다.
2. `content/manifest.json`에 날짜와 페이지 항목을 추가합니다.
3. 본문 수치에는 측정 조건과 1차 출처를 함께 기록합니다.

## 원칙

- 발표 수치와 자체 추정치를 분리합니다.
- "실행 가능"과 "실용적인 속도"를 구분합니다.
- 모델 내부 n-gram embedding과 prompt-lookup speculation처럼 이름이 비슷한 다른 기능을 분리합니다.
