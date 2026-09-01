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

## 북마크 HTML CD

`main` 브랜치에 커밋이 push될 때마다 `.github/workflows/deploy-bookmark-site.yml`이 실행됩니다. 워크플로는 `index.html`, `new_tech.html`, `assets/`, `content/`를 하나의 HTML 사이트 revision으로 업로드하고, 업로드 직후 status와 실제 진입 HTML을 다시 확인합니다.

저장소에는 다음 GitHub Actions variables가 필요합니다.

- `BOOKMARK_BASE_URL`: 북마크 서비스 주소
- `BOOKMARK_SITE_ID`: 처음 생성된 `new_tech` 사이트 ID
- `BOOKMARK_ENTRY_PATH`: `new_tech.html`

서비스가 인증을 요구하도록 바뀌면 `BOOKMARK_AUTH_TOKEN` repository secret을 추가합니다. 현재 내부 인증서 체인은 GitHub runner가 신뢰하지 않으므로 워크플로에서 해당 서비스 요청에만 `BOOKMARK_INSECURE_TLS=1`을 적용합니다.

## 새 날짜 추가

1. `content/YYYY-MM-DD/` 아래에 개념별 HTML fragment를 추가합니다.
2. `content/manifest.json`에 날짜와 페이지 항목을 추가합니다.
3. 본문 수치에는 측정 조건과 1차 출처를 함께 기록합니다.

## 원칙

- 발표 수치와 자체 추정치를 분리합니다.
- "실행 가능"과 "실용적인 속도"를 구분합니다.
- 모델 내부 n-gram embedding과 prompt-lookup speculation처럼 이름이 비슷한 다른 기능을 분리합니다.
