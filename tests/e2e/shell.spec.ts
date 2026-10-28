import { expect, test, type Page } from '@playwright/test';

const SECTIONS = [
  { hash: '#/home', heading: '오늘도, 일본어 한 장.', menu: '홈' },
  { hash: '#/study', heading: '오늘의 그림카드', menu: '학습' },
  { hash: '#/words', heading: '궁금한 단어를 찾아보세요.', menu: '단어' },
  { hash: '#/grammar', heading: '문법도, 문장 속에서.', menu: '문법' },
  { hash: '#/favorites', heading: '다시 만나고 싶은 단어.', menu: '보관함' },
];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 720;
const menu = (page: Page) => page.getByRole('navigation', { name: isPhone(page) ? '모바일 주요 메뉴' : '주요 메뉴', exact: true });

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const section of SECTIONS) {
  test(`direct entry ${section.hash}`, async ({ page }) => {
    await page.goto(section.hash);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(section.heading);
    await expect(menu(page)).toBeVisible();
    const current = menu(page).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    if (isPhone(page)) await expect(current).toHaveText(section.menu);
    await expectNoSideScroll(page);
  });
}

test('settings opens from the top bar on every screen size', async ({ page }) => {
  await page.goto('');
  await page.getByRole('banner').getByRole('link', { name: '설정' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('나에게 맞는 학습 설정.');
});

test('menu moves between screens and focuses the new title', async ({ page }) => {
  await page.goto('#/home');
  for (const section of SECTIONS.slice(1)) {
    const link = isPhone(page) ? section.menu : { '학습': '오늘의 학습', '단어': '단어장', '문법': '문법', '보관함': '즐겨찾기' }[section.menu]!;
    await menu(page).getByRole('link', { name: link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${section.hash}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('문법도, 문장 속에서.');
});

test('detail paths open directly', async ({ page }) => {
  await page.goto('#/words/w001');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('궁금한 단어를 찾아보세요.');
  await expect(page.getByText('w001')).toBeVisible();
  await page.goto('#/grammar/g001');
  await expect(page.getByText('g001')).toBeVisible();
});

test('unknown paths show a way home', async ({ page }) => {
  await page.goto('#/nowhere');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('찾는 화면이 없어요.');
  await page.getByRole('link', { name: '홈으로 가기' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('오늘도, 일본어 한 장.');
});

test('unfinished screens link to the design prototype', async ({ page }) => {
  await page.goto('#/words');
  await page.getByRole('link', { name: '디자인 시안에서 보기' }).click();
  await expect(page).toHaveURL(/\/JapaneseWordBook\/prototype\/#\/words$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('궁금한 단어를 찾아보세요.');
});

test('home art and styles load under the project path', async ({ page }, info) => {
  await page.goto('#/home');
  await expect(page.getByRole('img', { name: '편안하게 앉아 있는 동물' })).toBeVisible();
  await expect(page.getByRole('link', { name: '오늘의 학습 시작' })).toBeVisible();
  const background = await page.evaluate(() => getComputedStyle(document.querySelector('.hero-start')!).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
});

test('narrow 320px phone has no sideways scroll', async ({ page }) => {
  test.skip(!isPhone(page), 'phone layout only');
  await page.setViewportSize({ width: 320, height: 640 });
  for (const section of SECTIONS) {
    await page.goto(section.hash);
    await expectNoSideScroll(page);
  }
});
