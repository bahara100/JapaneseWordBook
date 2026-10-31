import { expect, test, type Page } from './test';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 720;
const list = (page: Page) => page.getByRole('list', { name: '단어 목록' });
const detail = (page: Page) => page.getByRole('region', { name: '선택한 단어 상세' });
const search = (page: Page) => page.getByLabel('단어 검색');
const rows = (page: Page) => list(page).getByRole('listitem');

test('search by written form, either kana script, Korean meaning or romaji', async ({ page }) => {
  await page.goto('#/words');
  await expect(page.getByText('15개의 단어')).toBeVisible();
  for (const [query, word] of [['猫', '猫'], ['がっこう', '学校'], ['ガッコウ', '学校'], ['사과', 'りんご'], ['neko', '猫'], ['기여', '貢献']]) {
    await search(page).fill(query);
    await expect(page.getByText('1개의 단어')).toBeVisible();
    await expect(rows(page).first()).toContainText(word);
  }
  // Exact, then prefix, then anywhere.
  await search(page).fill('こう');
  await expect(rows(page).locator('.word-written')).toHaveText(['貢献', '学校', '傾向']);
});

test('the level filter narrows the list without touching study settings', async ({ page }) => {
  await page.goto('#/words');
  await page.getByLabel('학습 수준').selectOption('N3');
  await expect(rows(page).locator('.word-written')).toHaveText(['環境', '努力', '確認']);
  await page.goto('#/settings');
  await expect(page.getByLabel('학습 수준')).toHaveValue('N5');
});

test('no match offers a way back', async ({ page }) => {
  await page.goto('#/words');
  await page.getByLabel('학습 수준').selectOption('N4');
  await search(page).fill('고양이');
  await expect(page.getByRole('heading', { name: '일치하는 단어가 없어요.' })).toBeVisible();
  await page.getByRole('button', { name: '검색 조건 지우기' }).click();
  await expect(page.getByText('15개의 단어')).toBeVisible();
  await expect(search(page)).toBeFocused();
});

test('choosing a word shows its detail and gives it its own address', async ({ page }, info) => {
  await page.goto('#/words');
  await search(page).fill('がっこう');
  await rows(page).first().getByRole('link').click();
  await expect(page).toHaveURL(/#\/words\/w002$/);
  const heading = detail(page).getByRole('heading', { name: '学校' });
  await expect(heading).toBeFocused();
  await expect(detail(page)).toContainText('がっこう');
  await expect(detail(page)).toContainText('학교');
  await expect(detail(page)).toContainText('毎日、学校へ行きます。');
  await expect(detail(page).getByRole('img')).toHaveAccessibleName('시계와 여러 교실 창문이 있는 건물');
  await page.screenshot({ path: info.outputPath('detail.png') });

  if (isPhone(page)) {
    // On a phone the detail is its own page, and going back keeps the search.
    await expect(list(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: '← 단어 목록으로' })).toBeInViewport();
    await page.getByRole('link', { name: '← 단어 목록으로' }).click();
    await expect(search(page)).toHaveValue('がっこう');
  } else {
    // On a wide screen list and detail sit side by side.
    await expect(list(page)).toBeVisible();
    await expect(rows(page).first()).toHaveClass(/selected/);
  }
});

test('an unknown word address says so', async ({ page }) => {
  await page.goto('#/words/w999');
  await expect(page.getByRole('heading', { name: '찾는 단어가 없어요.' })).toBeVisible();
});

test('favorites: star, keep across reloads, newest first, and remove', async ({ page }) => {
  await page.goto('#/favorites');
  await expect(page.getByRole('heading', { name: '다시 보고 싶은 단어를 모아 보세요.' })).toBeVisible();
  await expect(page.getByText('0개 보관')).toBeVisible();

  await page.goto('#/words');
  await list(page).getByRole('button', { name: '猫 즐겨찾기 추가' }).click();
  await list(page).getByRole('button', { name: '環境 즐겨찾기 추가' }).click();
  await expect(list(page).getByRole('button', { name: '猫 즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('#/favorites');
  await page.reload();
  await expect(page.getByText('2개 보관')).toBeVisible();
  await expect(rows(page).locator('.word-written')).toHaveText(['環境', '猫']);

  await rows(page).filter({ hasText: '猫' }).getByRole('button', { name: /猫/ }).first().click();
  await expect(detail(page).getByRole('heading', { name: '猫' })).toBeFocused();
  await detail(page).getByRole('button', { name: '猫 즐겨찾기 해제' }).click();
  await expect(page.getByText('1개 보관')).toBeVisible();
  await expect(rows(page).locator('.word-written')).toHaveText(['環境']);
  await list(page).getByRole('button', { name: '環境 즐겨찾기 해제' }).click();
  await expect(page.getByRole('link', { name: '단어장 둘러보기 →' })).toBeVisible();
});

test('studying favorites is kept apart from the daily goal and the review schedule', async ({ page }) => {
  await page.goto('#/words');
  for (const word of ['猫', '学校']) await list(page).getByRole('button', { name: `${word} 즐겨찾기 추가` }).click();
  await expect(list(page).getByRole('button', { name: '学校 즐겨찾기 해제' })).toBeVisible();
  await page.goto('#/favorites');
  await page.getByRole('button', { name: '모은 단어 학습하기 →' }).click();

  await expect(page).toHaveURL(/#\/study$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('모아 보는 그림카드');
  await expect(page.getByText('1 / 2장')).toBeVisible();
  await page.getByRole('article').getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await page.getByRole('article').getByRole('button', { name: '다음 카드 →' }).click();
  await page.getByRole('article').getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await page.getByRole('article').getByRole('button', { name: '연습 마치기 →' }).click();

  // Back to today's study, still untouched, and no review was scheduled.
  await expect(page.getByRole('button', { name: '오늘의 학습 시작 →' })).toBeVisible();
  const progress = await page.evaluate(() => new Promise<number>(resolve => {
    const open = indexedDB.open('haru-japanese');
    open.onsuccess = () => { const q = open.result.transaction('wordProgress').objectStore('wordProgress').count(); q.onsuccess = () => { resolve(q.result); open.result.close(); }; };
  }));
  expect(progress).toBe(0);
});
