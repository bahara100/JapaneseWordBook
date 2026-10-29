import { expect, test, type Page } from '@playwright/test';

// N5 sample cards in curriculum order: 猫 ねこ, 学校 がっこう, りんご りんご. Study day in Seoul.
const card = (page: Page) => page.getByRole('article');
const seoul = (iso: string) => new Date(iso); // times below are written in UTC; Seoul is UTC+9

async function type(page: Page, romaji: string) {
  const toggle = card(page).getByRole('button', { name: '직접 입력' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await card(page).getByLabel('영문 자판으로 입력').fill(romaji);
  await card(page).getByRole('button', { name: /히라가나/ }).click();
  await card(page).getByRole('button', { name: '입력 완료 · 정답 확인' }).click();
}
const reveal = (page: Page) => card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
const next = (page: Page) => card(page).getByRole('button', { name: /다음 카드 →|오늘의 결과 보기 →|연습 마치기 →/ }).click();

function progress(page: Page) {
  return page.evaluate(() => new Promise<Record<string, { reviewStep: number; dueAt: string; incorrectCount: number }>>((resolve, reject) => {
    const open = indexedDB.open('haru-japanese');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const all = open.result.transaction('wordProgress').objectStore('wordProgress').getAll();
      all.onsuccess = () => {
        resolve(Object.fromEntries(all.result.map((p: { promptId: string; reviewStep: number; dueAt: string; incorrectCount: number }) =>
          [p.promptId, { reviewStep: p.reviewStep, dueAt: p.dueAt, incorrectCount: p.incorrectCount }])));
        open.result.close();
      };
    };
  }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('haru-japanese.settings.v1', JSON.stringify({ timeZone: 'Asia/Seoul' })));
});

test('first answers set the review schedule; practice does not; misses return tomorrow', async ({ page }, info) => {
  await page.clock.install({ time: seoul('2026-10-29T01:00:00Z') }); // 10:00 on 10-29 in Seoul
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();

  await type(page, 'neko');
  await next(page);
  await type(page, 'gako');
  await card(page).getByRole('button', { name: '다시 시도' }).click();
  await type(page, 'gakkou');
  await next(page);
  await reveal(page);
  await next(page);

  const summary = page.getByRole('region', { name: '오늘의 결과' });
  await expect(summary.getByRole('heading', { name: '다시 볼 단어 2개' })).toBeVisible();
  await expect(summary.getByRole('listitem')).toHaveText([/学校.*がっこう.*학교.*다시 연습/, /りんご.*りんご.*사과.*답 확인/]);
  await page.screenshot({ path: info.outputPath('summary.png'), fullPage: true });

  // Everything is due at midnight starting 10-30 in Seoul; misses are counted.
  const tomorrow = '2026-10-29T15:00:00.000Z';
  expect(await progress(page)).toEqual({
    'w001-p1': { reviewStep: 1, dueAt: tomorrow, incorrectCount: 0 },
    'w002-p1': { reviewStep: 1, dueAt: tomorrow, incorrectCount: 1 },
    'w003-p1': { reviewStep: 1, dueAt: tomorrow, incorrectCount: 1 },
  });

  // Practice the two misses; right answers there change nothing.
  await summary.getByRole('button', { name: '틀린 단어 다시 보기 (2장) →' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('틀린 단어 다시 보기');
  await expect(page.getByText('1 / 2장')).toBeVisible();
  await expect(card(page).getByRole('img')).toHaveAccessibleName('시계가 있는 교실 건물');
  await type(page, 'gakkou');
  await expect(card(page).getByText('정답이에요.')).toBeVisible();
  await next(page);
  await expect(page.getByText('2 / 2장')).toBeVisible();
  await page.reload(); // practice is kept like any session
  await expect(page.getByText('2 / 2장')).toBeVisible();
  await type(page, 'ringo');
  await next(page);
  await expect(summary).toBeVisible();
  await expect(summary.locator('.summary-stats')).toHaveText(/1바로 정답\s*1다시 연습\s*1답 확인·힌트/);
  expect((await progress(page))['w002-p1']).toEqual({ reviewStep: 1, dueAt: tomorrow, incorrectCount: 1 });

  // Next day: the three words come back as reviews, and a right answer moves 学校 to 3 days.
  await page.clock.setSystemTime(seoul('2026-10-30T01:00:00Z'));
  await page.reload();
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await expect(page.getByText('2026-10-30 · 복습 카드')).toBeVisible();
  await expect(page.getByText('1 / 3장')).toBeVisible();
  // Reviews come oldest-due first, then most-missed: 学校 and りんご (1 miss) before 猫.
  await expect(card(page).getByRole('img')).toHaveAccessibleName('시계가 있는 교실 건물');
  await type(page, 'gakkou');
  expect((await progress(page))['w002-p1']).toEqual({ reviewStep: 2, dueAt: '2026-11-01T15:00:00.000Z', incorrectCount: 1 });
});

test('leaving practice early returns to the results', async ({ page }) => {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  for (let i = 0; i < 3; i++) { await reveal(page); await next(page); }
  await page.getByRole('button', { name: '틀린 단어 다시 보기 (3장) →' }).click();
  await expect(page.getByText('1 / 3장')).toBeVisible();
  await page.getByRole('button', { name: '연습 그만하기' }).click();
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();
});

test('a perfect day offers no practice', async ({ page }) => {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  for (const romaji of ['neko', 'gakkou', 'ringo']) { await type(page, romaji); await next(page); }
  const summary = page.getByRole('region', { name: '오늘의 결과' });
  await expect(summary).toContainText('정답률 100%');
  await expect(summary).toContainText('모두 바로 맞혔어요.');
  await expect(summary.getByRole('button', { name: /틀린 단어 다시 보기/ })).toHaveCount(0);
});
