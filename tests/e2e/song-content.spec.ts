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
