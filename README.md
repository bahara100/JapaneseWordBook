# 하루일본어 — 설계 작업실

N5부터 N1까지, 그림과 소리로 매일 배우는 한국어 사용자를 위한 일본어 학습 사이트입니다. 이름은 작업용 가칭입니다.

현재 단계는 **1단계 설계**입니다. 실행 가능한 화면 시안은 샘플 콘텐츠와 임시 메모리 상태만 사용하며 실제 학습 앱이 아닙니다.

## 결과물

- [제품·학습 설계](docs/01-product-design.md): 범위, 사용자 흐름, 학습·채점 규칙, 단계별 완료 조건
- [화면·디자인 설계](docs/02-interface-design.md): 화면별 구성, PC·모바일 대응, 접근성, 상태 문구
- [데이터·기술 설계](docs/03-data-architecture.md): 콘텐츠와 개인 기록 분리, 저장·검색·배포·음성 계획
- [구현 백로그](docs/04-implementation-plan.md): 다음 구현 순서와 검수 항목
- [설계 시안 검증 기록](docs/05-design-qa.md): 이번 단계에서 확인한 동작과 검증 범위
- [프로젝트 도구 현황](docs/06-project-tools.md): MCP·플러그인의 설치/연결 상태와 무료 범위
- [데이터 타입 초안](design/content-model.ts): 구현 시 사용할 타입 계약
- [클릭형 화면 시안](prototype/index.html): 홈·학습·단어장·문법·즐겨찾기·설정
- [바로 열어보는 시안](design/preview.html): 파일을 브라우저로 열면 서버 없이 동작하는 단일 파일

## 실제 앱 (구현 중)

React + TypeScript + Vite 앱이 저장소 최상위(`src/`)에 있습니다. 지금은 백로그 3-2까지 구현했습니다: 공통 화면틀(PC 왼쪽 메뉴·모바일 하단 탭·상단 설정), 해시 경로(`#/words`, `#/words/<id>`, `#/grammar/<id>` 등 직접 진입), 홈 화면, 콘텐츠 원본·검증·불러오기, 설정 화면과 기기 내 저장(설정 localStorage, 기록 IndexedDB, 저장 실패 안내), 오늘의 학습(카드 선정·로마자 직접 입력·채점·결과, 새로고침·다른 탭·자정 처리), 복습 일정(1→3→7→14→30일)과 틀린 단어 다시 보기, 단어장 검색·상세와 즐겨찾기·모아 학습, 문법 검색·상세.

단어·문법은 `content/`에서 고칩니다. 형식과 검사 규칙은 [content/README.md](content/README.md)를 봅니다.

- 배포 주소: https://bahara100.github.io/JapaneseWordBook/ (시안은 `/prototype/`)
- `main`에 올리면 GitHub Actions가 단위 테스트 → 빌드 → 화면 테스트(PC Chrome, iPhone WebKit) 후 Pages에 배포합니다.

```powershell
npm install
npm run dev        # 개발 서버 (콘텐츠 검사 먼저)
npm run content    # 콘텐츠만 검사하고 public/content/ 만들기
npm test           # 단위 테스트(Vitest)
npm run build      # 타입 검사 + 빌드(dist/, 시안 포함)
npm run test:e2e   # 빌드 결과로 화면 테스트(Playwright)
```

화면 테스트를 처음 돌릴 때는 `npx playwright install chromium webkit`이 필요합니다. 내 컴퓨터에서는 브라우저를 하나씩만 띄웁니다.

## 화면 시안 실행

가장 간단한 방법은 `design/preview.html`을 브라우저로 여는 것입니다. 인터넷이나 패키지 설치 없이 동작합니다. 원본을 수정한 뒤에는 `node tools/export-preview.mjs`로 다시 생성합니다.

원본을 개발용 서버에서 볼 때는 다음을 사용합니다.

Node.js가 설치된 환경에서 프로젝트 폴더에서 실행합니다. 외부 패키지 설치는 없습니다.

```powershell
node tools/preview.mjs
```

출력된 주소 `http://127.0.0.1:4173/`를 브라우저에서 엽니다. 포트 변경은 `node tools/preview.mjs 4174`처럼 지정합니다. 종료는 `Ctrl+C`입니다.

시안에서는 화면 이동, 설정에서 수준·목표 변경, 카드 뒤집기, 예시 채점 상태, 검색, 즐겨찾기, 문법 상세, 모바일 배치를 확인할 수 있습니다. 홈에는 수준·목표 요약만 표시합니다. 새로고침하면 상태가 초기화됩니다. **마이크 녹음·음성 합성·실제 채점·영구 저장·로그인·배포는 연결하지 않았습니다.**

학습 카드의 직접 입력은 영문 자판을 지원합니다. `neko`처럼 로마자를 입력하고 위의 `ねこ / ネコ` 후보를 선택하면 답안에 추가됩니다. Enter는 히라가나를 추가하고, '입력 완료'에서 정답 화면을 확인합니다. 로마자 변환은 동작하지만 실제 답안 채점은 아직 연결 전입니다.

## 검토 포인트

1. 그림 → 답변 → 정답 확인 → 다음 카드 흐름이 자연스러운가?
2. 일본어 읽기·뜻·예문이 충분히 읽기 쉬운가?
3. 휴대폰에서 메뉴와 학습 버튼을 쉽게 누를 수 있는가?
4. 단어장·문법·즐겨찾기 사이의 이동이 명확한가?

## 콘텐츠 상태와 참고 자료

시안의 단어·문법은 구조와 화면 확인을 위한 소량의 작성 예시입니다. 수준 분류와 해설은 공개 전에 일본어 교육 관점의 검수가 필요합니다. 수준별 학습 콘텐츠이며 JLPT의 공식 전체 출제 목록을 뜻하지 않습니다.

- [JLPT 공식 FAQ](https://www.jlpt.jp/e/faq/index.html)
- [GitHub Pages 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 제한](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Vite GitHub Pages 배포](https://vite.dev/guide/static-deploy.html#github-pages)
- [브라우저 음성 인식](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [기기별 합성 음성 조회](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)

문서 작성: 2026-10-28. 저장소: https://github.com/bahara100/JapaneseWordBook (공개, GitHub Pages 배포).
