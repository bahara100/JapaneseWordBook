import { expect, test } from '@playwright/test';

test('home shows what the level has ready, from the built content', async ({ page }) => {
  await page.goto('#/home');
  await expect(page.getByText('준비된 N5 카드 3장 · 검수 전 초안 3장 포함')).toBeVisible();
  await expect(page.getByRole('link', { name: '오늘의 학습 시작' })).toBeVisible();
});

test('content files and pictures are served under the project path', async ({ page, request }) => {
  const manifest = await (await request.get('content/manifest.json')).json();
  expect(manifest.schemaVersion).toBe(1);
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    const words = await request.get(manifest.levels[level].wordsPath);
    expect(words.ok()).toBe(true);
    for (const asset of (await words.json()).media) {
      expect((await request.get(asset.path)).ok(), asset.path).toBe(true);
    }
    expect((await request.get(manifest.levels[level].grammarPath)).ok()).toBe(true);
  }
  await page.goto('#/home');
  const picture = page.getByRole('img', { name: '편안하게 앉아 있는 동물' });
  await expect(picture).toBeVisible();
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('a failed content load says so and can be retried', async ({ page }) => {
  await page.route('**/content/manifest.json', route => route.abort());
  await page.goto('#/home');
  await expect(page.getByRole('alert')).toContainText('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
  await expect(page.getByRole('link', { name: '오늘의 학습 시작' })).toHaveCount(0);
  await page.unroute('**/content/manifest.json');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByText('준비된 N5 카드 3장 · 검수 전 초안 3장 포함')).toBeVisible();
});
