import { expect, test } from '@playwright/test';

test('settings survive a reload and drive the home screen', async ({ page }, info) => {
  await page.goto('#/settings');
  await page.getByLabel('학습 수준').selectOption('N3');
  await page.getByRole('group', { name: '하루 카드 수' }).getByRole('button', { name: '20장' }).click();
  await page.getByLabel('로마자 함께 보기').check();
  await page.getByLabel('학습일 기준 시간대').selectOption('Asia/Tokyo');
  await page.getByLabel('발음 재생 속도').selectOption({ label: '기본 속도' });
  await expect(page.getByRole('status').filter({ hasText: '이 기기에 저장했어요' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('학습 수준')).toHaveValue('N3');
  await expect(page.getByRole('button', { name: '20장' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('로마자 함께 보기')).toBeChecked();
  await expect(page.getByLabel('학습일 기준 시간대')).toHaveValue('Asia/Tokyo');
  await expect(page.getByLabel('발음 재생 속도')).toHaveValue('1');
  await page.screenshot({ path: info.outputPath('settings.png'), fullPage: true });

  await page.goto('#/home');
  await expect(page.locator('.hero-meta')).toContainText('N3 · 중급');
  await expect(page.locator('.hero-meta')).toContainText('하루 20장');
  await expect(page.getByText('준비된 N3 카드 3장 · 검수 전 초안 3장 포함')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('records live in IndexedDB with the planned stores', async ({ page }) => {
  await page.goto('#/settings');
  await expect(page.getByText('이 기기의 브라우저에 저장하고 있어요.')).toBeVisible();
  const stores = await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const open = indexedDB.open('haru-japanese');
    open.onsuccess = () => { resolve([...open.result.objectStoreNames].sort()); open.result.close(); };
    open.onerror = () => reject(open.error);
  }));
  expect(stores).toEqual(['answerAttempts', 'favorites', 'metadata', 'studySessions', 'wordProgress']);
});

test('blocked storage is announced, and the visit still works', async ({ page }, info) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    IDBFactory.prototype.open = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await page.goto('#/home');
  const alert = page.locator('.storage-alert');
  await expect(alert).toContainText('이 기기에 기록을 저장하지 못했어요.');
  await page.goto('#/settings');
  await expect(page.getByText('이 브라우저가 기록 저장을 막고 있어요.')).toBeVisible();
  await page.getByLabel('학습 수준').selectOption('N4');
  await expect(page.getByLabel('학습 수준')).toHaveValue('N4');
  await expect(page.getByText('이 기기에 저장했어요')).toHaveCount(0);
  await alert.getByRole('button', { name: '다시 시도' }).click();
  await expect(alert).toBeVisible();
  await page.screenshot({ path: info.outputPath('blocked.png') });
});

test('a broken saved value falls back without breaking the page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('haru-japanese.settings.v1', '{"level":"N9","dailyTarget":20'));
  await page.goto('#/settings');
  await expect(page.getByLabel('학습 수준')).toHaveValue('N5');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
