import { expect, test, type Page } from './test';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 720;
const list = (page: Page) => page.getByRole('list', { name: '문법 목록' });
const detail = (page: Page) => page.getByRole('region', { name: '선택한 문법 상세' });
const search = (page: Page) => page.getByLabel('문법 검색');

test('search by expression, kana, romaji, Korean meaning or explanation', async ({ page }) => {
  await page.goto('#/grammar');
  await expect(page.getByText('5개의 문법')).toBeVisible();
  for (const [query, expression] of [['ながら', '〜ながら'], ['nagara', '〜ながら'], ['하면서', '〜ながら'], ['관계없이', '〜にかかわらず'], ['격식', '〜を余儀なくされる']]) {
    await search(page).fill(query);
    await expect(page.getByText('1개의 문법')).toBeVisible();
    await expect(list(page).getByRole('link')).toContainText(expression);
  }
  await search(page).fill('');
  await page.getByLabel('학습 수준').selectOption('N3');
  await expect(list(page).getByRole('link')).toHaveCount(1);
  await expect(list(page).getByRole('link')).toContainText('〜ようにする');
});

test('no match offers a way back', async ({ page }) => {
  await page.goto('#/grammar');
  await search(page).fill('かもしれない');
  await expect(page.getByRole('heading', { name: '일치하는 문법이 없어요.' })).toBeVisible();
  await page.getByRole('button', { name: '검색 조건 지우기' }).click();
  await expect(page.getByText('5개의 문법')).toBeVisible();
});

test('detail reads meaning, connection, use, examples and cautions in order', async ({ page }, info) => {
  await page.goto('#/grammar');
  await search(page).fill('ながら');
  await list(page).getByRole('link').click();
  await expect(page).toHaveURL(/#\/grammar\/g002$/);
  const panel = detail(page);
  await expect(panel.getByRole('heading', { name: '〜ながら' })).toBeFocused();
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText(['접속 형태', '이럴 때 사용해요', '예문으로 익히기', '알아두면 좋아요']);
  await expect(panel.locator('.meaning')).toHaveText('~하면서');
  await expect(panel.locator('.connection')).toHaveText('동사 ます형에서 ます를 뺀 형태 + ながら');
  await expect(panel).toContainText('音楽を聞きながら、勉強します。');
  await expect(panel).toContainText('おんがくをききながら、べんきょうします。');
  await expect(panel).toContainText('두 동작의 주어는 같습니다.');
  // No related grammar is in the data yet, so none is shown.
  await expect(panel.getByRole('heading', { name: '함께 보면 좋은 문법' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '예문 듣기' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('grammar.png'), fullPage: !isPhone(page) });

  if (isPhone(page)) {
    await expect(page.getByRole('link', { name: '← 문법 목록으로' })).toBeInViewport();
    await page.getByRole('link', { name: '← 문법 목록으로' }).click();
    await expect(search(page)).toHaveValue('ながら');
  } else {
    await expect(list(page)).toBeVisible();
    await expect(list(page).getByRole('link')).toHaveClass(/selected/);
  }
});

test('an unknown grammar address says so', async ({ page }) => {
  await page.goto('#/grammar/g999');
  await expect(page.getByRole('heading', { name: '찾는 문법이 없어요.' })).toBeVisible();
});
