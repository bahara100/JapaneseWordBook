# 데이터·기술 설계 v0.1

## 1. 실제 앱의 권장 구조

React + TypeScript + Vite로 정적 앱을 만들고 GitHub Actions로 빌드하여 GitHub Pages에 배포한다. 현재 설계 시안은 의존성 없는 HTML/CSS/JavaScript로 분리해 구현 선택을 쉽게 검토할 수 있게 한다.

```text
화면(UI)
  ├─ 학습 서비스 → 세션 선정·평가·복습 계산
  ├─ 콘텐츠 저장소 → 수준별 정적 JSON·그림·음성
  ├─ 개인 기록 저장소 → IndexedDB
  └─ 음성 어댑터 → 브라우저 지원 탐지·합성·인식
```

컴포넌트에서 음성 API나 IndexedDB를 직접 호출하지 않는다. 저장·음성 어댑터를 교체하면 나중에 서버 동기화나 외부 음성 평가를 붙일 수 있게 한다.

## 2. 데이터 분리

| 데이터 | 위치 | 갱신 방식 |
| --- | --- | --- |
| 단어·문법·매체·출처 | Git의 수준별 콘텐츠 파일 | 편집→검수→빌드→배포 |
| 개인 즐겨찾기·학습 기록·세션 | 기기 IndexedDB | 사용자 학습 동작마다 트랜잭션 저장 |
| 소량 설정 | localStorage | 설정 변경 시 저장 |
| 백업 | 사용자가 내려받는 JSON | 명시적 내보내기/가져오기 |
| 원음 녹음 | 기본 저장하지 않음 | 인식 중에만 사용 |

정적 사이트에 데이터를 저장했다고 학습 기록이 Git으로 올라가지는 않는다. 자동 기기 동기화는 별도 인증·서버 저장소가 필요하며 1차 범위 밖이다.

## 3. 콘텐츠 계약

구체 타입은 `design/content-model.ts`를 참조한다.

- Word: 수준·표기·읽기·품사·의미. 한 단어에 여러 읽기/의미를 허용한다.
- CardPrompt: wordId + senseId + readingId로 이번 카드의 정답을 특정한다. 정답 한자와 가나의 허용 표기는 명시적으로 저장한다.
- MediaAsset: 경로·대체 설명·제작/이용 조건·검수 상태. 그림과 음성은 독립 자산이다.
- ExampleSentence: 일본어 원문·읽기·한국어 번역·출처. 읽기와 실제 문장을 분리한다.
- Grammar: 수준·표현·의미·접속 형태·설명·예문·주의점·관련 문법 ID.
- Provenance: 출처 URL(있는 경우)·작성자·이용 조건·검수 상태·검수 날짜.
- ContentManifest: schemaVersion, contentVersion, 수준별 파일과 콘텐츠 수. 첫 화면에는 전체 매체를 내려받지 않는다.

ID는 표기나 수준에서 매번 생성하지 않고 안정된 ID를 사용한다. 수준이 수정되더라도 즐겨찾기가 깨지지 않게 한다. 삭제 콘텐츠는 tombstone 또는 이전 ID→새 ID 매핑으로 마이그레이션한다. 출처가 다르면 같은 예문을 중복 수집하지 않는다.

## 4. 개인 기록·세션

IndexedDB 초기 object store 후보:

| 저장소 | 키/인덱스 |
| --- | --- |
| favorites | wordId / createdAt |
| wordProgress | promptId / dueAt, level |
| studySessions | sessionId / studyDate, type, status |
| answerAttempts | attemptId / sessionId+cardIndex |
| metadata | schemaVersion, 최근 백업 시각 |

하루 세션 키는 `daily:YYYY-MM-DD`로 한다. 시작 당시 수준과 시간대는 세션 안에 보관한다. 날짜가 고정된 세션이 존재하면 수준을 바꿔도 새 세션을 생성하지 않는다. 모든 시각은 UTC ISO 시각으로 저장하되, studyDate는 세션 시간대에서 계산한 YYYY-MM-DD다.

AnswerAttempt에는 입력 수단, 입력/인식 텍스트, 결과, 힌트 여부, 시도 시각을 남긴다. 기술적 음성 실패는 결과 `unrecognized`로 구분한다. 첫 유효 평가 이후에는 카드 완료 여부를 다시 증가시키지 않는다.

답변 이력·카드 위치·복습일 갱신은 하나의 트랜잭션으로 처리한다. 같은 카드의 빠른 중복 클릭과 두 탭의 동시 저장을 막는 버전 번호/낙관적 잠금을 고려한다. 저장 실패 시 성공한 것처럼 다음 카드로 진행하지 않는다.

IndexedDB 마이그레이션은 버전별로 수행하고 실패하면 기존 기록을 덮어쓰지 않는다. 사생활 보호 모드·저장 공간 부족 등에서는 임시 학습과 백업 안내를 제공한다.

## 5. 검색

1차는 각 수준의 텍스트 데이터만 로드해 정규화된 인덱스를 만든다. 이미지와 음성은 상세·카드에서 지연 로드한다.

- 검색 대상: 단어 표기, 읽기, 한국어 뜻. 문법은 표현·한국어 의미·설명.
- 정규화: 공백, 영문 대소문자, 유니코드 정규화, 가타카나/히라가나 동등 검색.
- 순위: 정확히 일치 → 앞부분 일치 → 포함.
- 수준 필터와 검색을 함께 적용. 리스트는 많아지면 페이지/점진 로딩으로 렌더링 비용을 제한.
- 검색 중 개인의 일일 학습 수준을 변경하지 않는다.

## 6. 음성 어댑터

인터페이스: `getCapabilities()`, `listJapaneseVoices()`, `speak(reading, rate)`, `stopSpeaking()`, `startRecognition(ja-JP)`, `cancelRecognition()`.

합성에는 한자 문자열보다 검수된 읽기를 사용해 다독음 오류를 줄인다. 시작 시와 voiceschanged 시에 일본어 음성을 다시 탐색한다. 정해진 단어/예문의 검수된 음성 파일이 있으면 이를 우선할 수 있다. 준비된 음성도 없으면 재생 불가를 명시한다.

인식 결과는 '발음 품질'이 아닌 '정답 단어 일치'로 해석한다. 인식 텍스트·후보를 허용 표기와 비교하고 원음은 영구 저장하지 않는다. 네트워크 사용·권한·브라우저 지원 차이를 실제 기기에서 확인한다. 실제 환경의 기능 탐지로 UI를 바꾸며 특정 브라우저 이름만 보고 지원한다고 단정하지 않는다.

외부 유료 API를 붙이면 별도 서버에서 비밀 키·사용량·요금 한도를 관리해야 한다. 정적 번들에 API 키를 넣지 않는다.

## 7. 백업·동기화

백업 JSON에는 schemaVersion, exportAt, 설정, favorites, progress, sessions, attempts를 넣는다. 원음·API 키는 없다. 가져오기는 크기/스키마/ID 검증 → 요약 미리보기 → 사용자의 적용 동작 순이다. 기본 정책은 통째로 교체하며 기존 데이터를 먼저 백업할 수 있게 한다. 동시 합치기는 충돌 규칙이 필요해 후속 기능으로 둔다.

자동 동기화가 도입되면 로컬 저장소를 캐시/오프라인 기반으로 유지하고 인증된 서버를 기준으로 충돌 정책을 별도로 설계한다. 무료 할당량이 영구 무료를 보장한다고 안내하지 않는다.

## 8. 배포

- 공개 저장소 + GitHub Pages. 사용자는 github.io 주소로 접속한다.
- Pages는 정적 배포이며 로그인 DB·자체 음성 처리 서버를 실행하지 않는다.
- 초기 라우팅은 해시 방식: `/#/words`, `/#/grammar/:id`. 직접 URL 진입 시 Pages의 404를 피한다.
- 프로젝트 주소의 저장소 하위 경로를 Vite base와 모든 매체 경로에 반영한다.
- main push → 검증/빌드 → Pages artifact 업로드 → 배포. 기본 워크플로 권한은 필요한 수준으로 제한한다.
- 새 콘텐츠는 배포 후 방문 시 manifest 버전을 확인한다. 진행 중 세션은 기존 버전/프롬프트 스냅샷으로 완료한다.
- 이미지 압축, 수준별 분할, 미디어 지연 로딩으로 사이트 크기를 관리한다. 오프라인 캐시/PWA는 후속 단계다.

GitHub Free 공개 저장소 사용 조건, 사이트 크기·대역폭과 상업 서비스 제한은 배포 시 다시 확인한다.

## 9. 참고

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 제한](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Vite 배포](https://vite.dev/guide/static-deploy.html#github-pages)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MDN getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
