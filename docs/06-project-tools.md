# 프로젝트 도구 현황

확인일: 2026-10-28. 설치 여부와 계정 연결·요금은 서로 다른 상태다.

| 도구 | 확인한 상태 | 프로젝트에서의 용도 |
| --- | --- | --- |
| GitHub | `gh` CLI(`bahara100` 로그인)로 저장소 생성·Pages 배포 완료 | 저장소 `bahara100/JapaneseWordBook`, PR·CI·배포 확인 |
| Context7 | 문서 조회 MCP. Claude·코덱스 공통 등록(`@upstash/context7-mcp@4.1.1` 고정) | React·Vite·IndexedDB·Web Speech API 등 공식 문서 확인 |
| 브라우저 점검 | 앱 안 브라우저(Chromium) 사용 가능 | PC Chrome/Edge 화면과 사용자 흐름 검증 |
| Playwright MCP `playwright-iphone` | 2026-10-28 설치. 프로젝트 `.mcp.json`과 코덱스 설정에 등록, `@playwright/mcp@0.0.83` 고정, Apache-2.0 무료. WebKit 26.6 + iPhone 15 화면 흉내 | iPhone Safari 쪽 화면·입력 흐름 점검. 실제 아이폰의 음성 인식·재생은 대신 확인하지 못한다 |
| Product Design | 추가 설치·연결이 필요하며 완료 여부 미확인 | 디자인 방향 탐색·UX 검토·프로토타입 |
| Figma | 추가 설치·연결이 필요하며 완료 여부 미확인 | 향후 편집 가능한 디자인 파일과 협업 |

2026-10-28 MCP 목록을 다시 찾아봤지만 일본어 사전 MCP는 없었다. 단어 데이터는 MCP 대신 공개 사전 데이터를 스크립트로 가공하는 쪽이 맞다(콘텐츠 단계에서 출처·이용 조건과 함께 결정). DeepL(번역)·Figma는 계정·키가 필요하고 지금 구현에 꼭 필요하지 않아 설치하지 않았다.

한국어 사용자용 가나 입력 보조는 외부 MCP가 필요하지 않다. 현재 프로젝트의 로마자 변환 코드로 처리한다. 검색한 플러그인 목록에서는 이번 작업에 바로 맞는 일본어 사전·발음 평가 도구를 확인하지 못했다. 도구 검색 결과가 전체 MCP 생태계를 의미하지는 않는다.

현재 디자인 작업에는 추가 외부 유료 서비스가 필요하지 않으며, 유료 구독·크레딧 구매·결제를 진행하지 않았다.

## 무료 사용 범위

- Figma는 무료 Starter 요금제가 있다. MCP 호출·AI 기능·고급 기능에는 요금제에 따른 제한이 있어 제한 없는 무료 도구로 안내하지 않는다.
- Product Design의 별도 요금과 무료 이용 범위는 확인한 공식 안내만으로 확정하지 못했다. 설치 가능 표시를 무료 사용 보장으로 해석하지 않는다.
- 도구를 설치한 상태와 외부 계정을 인증해 도구를 실제 사용할 수 있는 상태는 구분한다. 연결이 확인되지 않은 도구로 이번 디자인을 만들었다고 주장하지 않는다.

참고: [Figma 요금](https://www.figma.com/pricing/), [Figma MCP FAQ](https://help.figma.com/hc/en-us/articles/39252411778583-Figma-MCP-server-FAQs), [ChatGPT 플러그인 안내](https://learn.chatgpt.com/docs/plugins), [ChatGPT 요금 안내](https://learn.chatgpt.com/docs/pricing).
