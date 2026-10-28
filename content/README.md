# 학습 콘텐츠 원본

단어·문법의 원본 파일입니다. 사람이 고치는 곳은 여기뿐이고, 앱이 읽는 파일(`public/content/`)은 빌드할 때 만들어집니다(저장소에 올리지 않음).

```text
content/<수준>/words.json    단어(words) · 학습 카드(prompts) · 카드가 쓰는 그림/소리(media)
content/<수준>/grammar.json  문법
public/media/images/         그림 파일 (media.path는 "media/images/<이름>.svg"처럼 public/ 기준)
```

타입은 [src/content/types.ts](../src/content/types.ts)가 기준입니다(`design/content-model.ts`에서 시작해 수준별 파일 형식과 manifest를 더했습니다).

## 확인하는 법

```powershell
npm run content
```

`npm run dev`와 `npm run build`도 먼저 이 검사를 돌리며, 오류가 하나라도 있으면 빌드를 멈춥니다. GitHub에 올렸을 때도 같아서 잘못된 콘텐츠는 배포되지 않습니다.

## 오류로 막는 것

- id: 비었거나, 영문 소문자·숫자·`-` 밖의 글자, 다른 곳에서 이미 쓴 id(수준이 달라도). 같은 그림을 여러 수준에서 쓸 때만 같은 media id·같은 경로가 허용됩니다.
- 수준: 폴더와 파일의 `level`, 각 단어·문법의 `level`이 다름. `curriculumOrder`가 1 이상 정수가 아니거나 겹침.
- 읽기: `kana`에 가나 밖의 글자, 예문 `reading`에 가나·문장부호 밖의 글자, `romaji`가 영문 로마자가 아님.
- 연결: 의미의 `readingIds`가 그 단어의 읽기가 아님. 카드의 `wordId`·`senseId`·`readingId`·`imageAssetId`·`audioAssetId`가 없거나 서로 맞지 않음. 출제 읽기가 `acceptedKanaForms`에 없음. 없는 `relatedGrammarIds`.
- 매체: 경로가 `media/…` 형식이 아니거나 실제 파일이 없음, 종류와 확장자가 다름. **그림 설명에 정답 표기·읽기가 들어감**(문제 화면에서 낭독되므로).
- 출처: `provenance`의 작성자·이용 조건·상태가 없음. `reviewed`인데 `reviewedAt` 날짜가 없음.

## 주의로만 알리는 것

- 예문에 단어 표기가 그대로 없음(활용형이면 괜찮음)
- 카드가 없는 단어, 어느 카드도 쓰지 않는 매체

## 지금 들어 있는 것

시안에서 옮긴 단어 15개(수준별 3개)·문법 5개·그림 15장이며 모두 `draft`(검수 전)입니다. JLPT 공식 목록이 아니며, 공개 학습에 쓰기 전에 검수가 필요합니다.
