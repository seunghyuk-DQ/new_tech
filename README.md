# NEW_TECH

새로운 추론 기술을 날짜별·개념별로 축적하는 정적 기술 공유 사이트입니다.

- 진입 페이지: `new_tech.html`
- 날짜별 목차: `content/manifest.json`
- 개념별 본문: `content/YYYY-MM-DD/*.html`
- 화면: React + shadcn/ui (`src/main.jsx`, `src/components/ui/`)
- 본문 표현/상호작용: `src/article.css`, `src/article-interactions.js`
- 이미지: `assets/research/`

## 로컬 실행

```bash
npm ci
npm run dev -- --port 8000
```

브라우저에서 `http://localhost:8000/new_tech.html`을 엽니다. 루트 `index.html`도 같은 화면을 제공합니다. Node.js 22.12 이상을 사용합니다.

`npm run build`는 정적 호스팅용 `dist/`를 만듭니다. 서버에는 저장소 원본 대신 `dist/`의 내용을 배포합니다. `npm run preview -- --port 8000`으로 빌드 결과를 확인할 수 있습니다.

GitHub Pages는 `.github/workflows/deploy-pages.yml`에서 `dist/`를 배포합니다. 이 변경을 처음 배포하기 전에 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 변경해야 합니다. 기존 `main` 루트 직접 배포 방식은 React 소스를 빌드하지 않습니다.

`npm run build:bookmark`는 이미지, 문서, UI를 포함한 독립 실행 HTML을 `output/bookmark-site/new_tech.html`에 만듭니다. 북마크 서비스의 sandbox에서도 외부 스크립트 요청 없이 실행됩니다.

UI는 [shadcn/ui의 Vite 구성](https://ui.shadcn.com/docs/installation/vite)을 사용합니다. `npx shadcn@latest add <component>`로 컴포넌트를 추가할 수 있습니다. 검색은 제목·부제·날짜를 대상으로 하며 `Ctrl/⌘ K`로 열 수 있습니다. 기존 `#페이지-id` 링크를 유지하고, 문서 내 목차 링크는 `#페이지-id/섹션-id`를 사용합니다.

## 북마크 HTML CD

`main` 브랜치에 커밋이 push될 때마다 `.github/workflows/deploy-bookmark-site.yml`이 실행됩니다. 북마크 서버는 내부망에 있으므로 GitHub hosted runner가 아니라 이 네트워크의 repo 전용 self-hosted runner `new-tech-cd-local`이 작업을 받습니다. 워크플로는 서비스의 sandbox 정책에 맞춰 CSS, JavaScript, 날짜별 문서를 하나의 `new_tech.html`로 묶어 새 revision으로 업로드하고, 업로드 직후 status와 실제 진입 HTML을 다시 확인합니다.

저장소에는 다음 GitHub Actions variables가 필요합니다.

- `BOOKMARK_BASE_URL`: 북마크 서비스 주소
- `BOOKMARK_SITE_ID`: 처음 생성된 `new_tech` 사이트 ID
- `BOOKMARK_ENTRY_PATH`: `new_tech.html`

서비스가 인증을 요구하도록 바뀌면 `BOOKMARK_AUTH_TOKEN` repository secret을 추가합니다. 현재 내부 인증서 체인은 GitHub runner가 신뢰하지 않으므로 워크플로에서 해당 서비스 요청에만 `BOOKMARK_INSECURE_TLS=1`을 적용합니다.

로컬 runner 프로세스는 다음 명령으로 tmux 세션에서 시작합니다. 출력은 `/tmp/new-tech-cd-runner.log`에도 저장됩니다.

```bash
bash scripts/start-local-runner.sh
```

## 새 날짜 추가

1. `content/YYYY-MM-DD/` 아래에 개념별 HTML fragment를 추가합니다.
2. `content/manifest.json`에 날짜와 페이지 항목을 추가합니다.
3. 본문 수치에는 측정 조건과 1차 출처를 함께 기록합니다.

## 원칙

- 발표 수치와 자체 추정치를 분리합니다.
- "실행 가능"과 "실용적인 속도"를 구분합니다.
- 모델 내부 n-gram embedding과 prompt-lookup speculation처럼 이름이 비슷한 다른 기능을 분리합니다.
