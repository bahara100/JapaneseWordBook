// The real song list (no sample trimming), so it imports Playwright directly.
import { expect, test } from '@playwright/test';

test('JANE DOE lists its words and grammar, which also live in the library', async ({ page }) => {
  await page.goto('#/songs/s001');
  const song = page.getByRole('region', { name: '선택한 노래 상세' });
  await expect(song.getByRole('heading', { name: 'JANE DOE' })).toBeVisible();
  await expect(song.getByRole('heading', { name: '이 노래의 단어 48개' })).toBeVisible();
  await expect(song.getByRole('heading', { name: '이 노래의 문법 16개' })).toBeVisible();
  // りんご was already a word; the song links to it instead of adding 林檎 again.
  await song.getByRole('link', { name: /りんご/ }).click();
  await expect(page).toHaveURL(/#\/words\/w003$/);
  await expect(page.getByRole('region', { name: '선택한 단어 상세' }).getByRole('link', { name: 'JANE DOE' })).toBeVisible();
});

test('側 has two readings, each with its own meaning and card', async ({ page }, info) => {
  await page.goto('#/songs/s001');
  await expect(page.getByRole('region', { name: '선택한 노래 상세' }).getByRole('link', { name: /側/ })).toContainText('そば · がわ');
  await page.goto('#/words/w293');
  const detail = page.getByRole('region', { name: '선택한 단어 상세' });
  await expect(detail.locator('.sense')).toHaveCount(2);
  await expect(detail.locator('.sense').nth(0)).toContainText('そば');
  await expect(detail.locator('.sense').nth(0)).toContainText('곁, 옆');
  await expect(detail.locator('.sense').nth(1)).toContainText('がわ');
  await expect(detail.locator('.sense').nth(1)).toContainText('쪽, 편');
  await page.screenshot({ path: info.outputPath('side-detail.png') });
  // The card shows the same kanji for both readings, so it says which meaning it asks for.
  await detail.getByRole('button', { name: '側 즐겨찾기 추가' }).click();
  await page.goto('#/favorites');
  await page.getByRole('button', { name: '모은 단어 학습하기 →' }).click();
  const card = page.getByRole('article');
  await expect(card.locator('.front-word')).toHaveText('側');
  await expect(card.locator('.situation-hint')).toHaveText('뜻: 곁, 옆');
  await page.screenshot({ path: info.outputPath('side-card.png') });
});
