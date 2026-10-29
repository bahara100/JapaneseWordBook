import { expect, test, type Page } from '@playwright/test';

// N5 sample cards in curriculum order: 猫 ねこ, 学校 がっこう, りんご りんご.
const card = (page: Page) => page.getByRole('article');
const heading = (page: Page) => page.getByRole('heading', { level: 1 });

async function type(page: Page, romaji: string, script: '히라가나' | '가타카나' = '히라가나') {
  const article = card(page);
  const toggle = article.getByRole('button', { name: '직접 입력' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await article.getByLabel('영문 자판으로 입력').fill(romaji);
  await article.getByRole('button', { name: new RegExp(script) }).click();
  await article.getByRole('button', { name: '입력 완료 · 정답 확인' }).click();
}

async function start(page: Page) {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await expect(page.getByText('1 / 3장')).toBeVisible();
}

test('a full day: typed answers, a retry, a reveal and the results', async ({ page }, info) => {
  await page.goto('#/study');
  await expect(page.getByText('오늘은 준비된 카드 3장으로 학습해요.')).toBeVisible();
  await expect(page.getByText('아직 검수 전인 초안 카드가 포함돼 있어요.')).toBeVisible();
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();

  // The front never shows the answer.
  await expect(card(page)).not.toContainText('ねこ');
  await expect(card(page).getByRole('img')).toHaveAccessibleName('편안하게 앉아 있는 동물');

  await type(page, 'neko');
  await expect(card(page).getByText('정답이에요.')).toBeVisible();
  await expect(card(page).getByRole('heading', { name: '猫' })).toBeFocused();
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();

  await expect(page.getByText('2 / 3장')).toBeVisible();
  await card(page).getByRole('button', { name: '직접 입력' }).click();
  await card(page).getByLabel('영문 자판으로 입력').fill('gakkou');
  await page.screenshot({ path: info.outputPath('front-typing.png') });
  await card(page).getByLabel('영문 자판으로 입력').fill('');
  await type(page, 'gako');
  await expect(card(page).getByText('읽기를 다시 확인해 볼까요?')).toBeVisible();
  await expect(card(page).getByText('がこ')).toBeVisible();
  await card(page).getByRole('button', { name: '다시 시도' }).click();
  await type(page, 'gakkou', '가타카나');
  await expect(card(page).getByText('다시 연습할 단어로 기록했어요.')).toBeVisible();
  // The answer side is on screen, not left below a long input form.
  await expect(card(page).getByRole('heading', { name: '学校' })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('back.png') });
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();

  await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await expect(card(page).getByText('정답을 확인했어요.')).toBeVisible();
  await card(page).getByRole('button', { name: '오늘의 결과 보기 →' }).click();

  const summary = page.getByRole('region', { name: '오늘의 결과' });
  await expect(summary).toContainText('3 / 3');
  await expect(summary.locator('.summary-stats')).toHaveText(/1바로 정답\s*1다시 연습\s*1답 확인/);
  await expect(summary).toContainText('정답률 33%');
  await page.screenshot({ path: info.outputPath('summary.png') });

  await page.goto('#/home');
  await expect(page.getByRole('link', { name: '오늘의 결과 보기' })).toBeVisible();
});

test('reload keeps the same card, and settings changes wait for the next day', async ({ page }) => {
  await start(page);
  await type(page, 'neko');
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();
  await expect(page.getByText('2 / 3장')).toBeVisible();

  await page.goto('#/settings');
  await page.getByLabel('학습 수준').selectOption('N1');
  await page.goto('#/home');
  await expect(page.getByRole('link', { name: '이어서 학습' })).toBeVisible();
  await expect(page.getByText('N5 · 1 / 3장 확인')).toBeVisible();

  await page.reload();
  await page.goto('#/study');
  await expect(page.getByText('2 / 3장')).toBeVisible();
  await expect(heading(page).locator('..').getByText('N5')).toBeVisible();
  await expect(card(page).getByRole('img')).toHaveAccessibleName('시계가 있는 교실 건물');
});

test('the answer side and favorites come back after a reload', async ({ page }) => {
  await start(page);
  await type(page, 'neko');
  await card(page).getByRole('button', { name: '猫 즐겨찾기 추가' }).click();
  await expect(card(page).getByRole('button', { name: '猫 즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(card(page).getByText('정답이에요.')).toBeVisible();
  await expect(card(page).getByRole('button', { name: '猫 즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');
});

test('a double click on 다음 moves one card only', async ({ page }) => {
  await start(page);
  await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await card(page).getByRole('button', { name: '다음 카드 →' }).dblclick();
  await expect(page.getByText('2 / 3장')).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 / 3장')).toBeVisible();
});

test('two tabs never count a card twice', async ({ page, context }) => {
  await start(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByText('1 / 3장')).toBeVisible();

  await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();
  await expect(page.getByText('2 / 3장')).toBeVisible();

  // The other tab still shows card 1; acting on it adopts the saved progress instead.
  await card(other).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await expect(other.getByText('다른 탭에서 학습이 이어졌어요. 그 내용으로 맞출게요.')).toBeVisible();
  await expect(other.getByText('2 / 3장')).toBeVisible();
});

test('a session started before midnight can be finished, then a new day starts', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T14:50:00Z') }); // 23:50 in Seoul
  await page.addInitScript(() => localStorage.setItem('haru-japanese.settings.v1', JSON.stringify({ timeZone: 'Asia/Seoul' })));
  await start(page);
  await expect(page.getByText('2026-10-28 · 새 카드')).toBeVisible();

  await page.clock.setSystemTime(new Date('2026-10-28T15:20:00Z')); // 00:20 the next day
  await page.reload();
  await expect(page.getByText('2026-10-28에 시작한 학습이에요.')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await card(page).getByRole('button', { name: /다음 카드 →|오늘의 결과 보기 →/ }).click();
  }
  // Yesterday's session is done, so today shows a start screen rather than its results. All three
  // cards were answered after midnight, so their first reviews come the day after.
  const startPanel = page.getByRole('region', { name: '오늘의 학습 시작' });
  await expect(startPanel).toContainText('준비된 N5 카드를 모두 학습했고, 오늘 돌아올 복습은 없어요.');
  await expect(startPanel).toContainText('다음 복습은 10월 30일에 시작돼요.');

  await page.clock.setSystemTime(new Date('2026-10-29T15:20:00Z')); // 00:20 on 10-30
  await page.reload();
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await expect(page.getByText('2026-10-30 · 복습 카드')).toBeVisible();
});

test('romaji input handles っ and ん and can be corrected', async ({ page }) => {
  await start(page);
  const article = card(page);
  await article.getByRole('button', { name: '직접 입력' }).click();
  const input = article.getByLabel('영문 자판으로 입력');
  await input.fill('gakk');
  await expect(article.getByText('이어서 입력해 주세요.')).toBeVisible();
  await input.fill('gakkou');
  await expect(article.getByRole('button', { name: /がっこう/ })).toBeVisible();
  await input.press('Enter');
  await expect(article.locator('.kana-answer')).toHaveText('がっこう');
  await article.getByRole('button', { name: '한 글자 지우기' }).click();
  await expect(article.locator('.kana-answer')).toHaveText('がっこ');
  await input.fill('shinbun');
  await expect(article.getByRole('button', { name: /しんぶん/ })).toBeVisible();
  await input.fill('xq');
  await expect(article.getByText('영문 로마자로 입력해 주세요.')).toBeVisible();
  await article.getByRole('button', { name: '입력 완료 · 정답 확인' }).click();
  await expect(article.getByRole('alert')).toHaveText('로마자 입력을 마친 뒤 후보를 선택해 주세요.');
});
