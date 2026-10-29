import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const list = (page: Page) => page.getByRole('list', { name: '단어 목록' });

/**
 * Wait for the settings screen itself (the word library also has a "학습 수준" select) and for device
 * storage to be open (the backup buttons stay disabled until then; WebKit reloads on a same-URL goto).
 */
async function openSettings(page: Page) {
  await page.goto('#/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('나에게 맞는 학습 설정.');
  await expect(page.getByRole('button', { name: '백업 파일 가져오기' })).toBeEnabled();
}

async function exportBackup(page: Page) {
  await openSettings(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '기록 내보내기' }).click();
  const file = await downloading;
  return { name: file.suggestedFilename(), text: readFileSync((await file.path())!, 'utf8') };
}

async function importText(page: Page, text: string, name = 'backup.json') {
  await openSettings(page);
  await page.getByLabel('백업 파일 선택').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

async function favoriteCount(page: Page) {
  await page.goto('#/favorites');
  const pill = page.getByText(/^\d+개 보관$/);
  await expect(pill).toBeVisible();
  return Number((await pill.textContent())!.replace(/\D/g, ''));
}

test('export, change things, then restore the backup after a preview', async ({ page }, info) => {
  // Something worth keeping: a favorite, N3 settings and a finished study day.
  await page.goto('#/words');
  await list(page).getByRole('button', { name: '猫 즐겨찾기 추가' }).click();
  await expect(list(page).getByRole('button', { name: '猫 즐겨찾기 해제' })).toBeVisible();
  await openSettings(page);
  await page.getByLabel('학습 수준').selectOption('N3');
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('article').getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await page.getByRole('article').getByRole('button', { name: /다음 카드 →|오늘의 결과 보기 →/ }).click();
  }
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();

  const backup = await exportBackup(page);
  expect(backup.name).toMatch(/^haru-japanese-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(backup.text);
  expect(data).toMatchObject({ format: 'haru-japanese-backup', schemaVersion: 1, settings: { level: 'N3' } });
  expect(data.favorites.map((f: { wordId: string }) => f.wordId)).toEqual(['w001']);
  expect(data.sessions).toHaveLength(1);
  expect(data.attempts).toHaveLength(3);
  expect(data.progress).toHaveLength(3);
  await expect(page.getByText(/마지막 내보내기:/)).toBeVisible();

  // Change things after the backup.
  await page.goto('#/words');
  await list(page).getByRole('button', { name: '学校 즐겨찾기 추가' }).click();
  await list(page).getByRole('button', { name: '猫 즐겨찾기 해제' }).click();
  await openSettings(page);
  await page.getByLabel('학습 수준').selectOption('N1');

  // Preview, then cancel: nothing changes.
  await importText(page, backup.text, backup.name);
  const preview = page.getByRole('region', { name: '가져올 백업 확인' });
  await expect(preview).toBeFocused();
  await expect(preview.getByRole('row', { name: /즐겨찾기/ })).toHaveText(/즐겨찾기\s*1\s*1/);
  await expect(preview.getByRole('row', { name: /마친 학습일/ })).toHaveText(/마친 학습일\s*1\s*1/);
  await expect(preview).toContainText('N3 · 하루 15장');
  await page.screenshot({ path: info.outputPath('preview.png'), fullPage: true });
  await preview.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('가져오기를 취소했어요. 이 기기의 기록은 그대로예요.')).toBeVisible();
  await expect(page.getByLabel('학습 수준')).toHaveValue('N1');

  // Apply: records and settings come back as they were in the file.
  await importText(page, backup.text, backup.name);
  await page.getByRole('button', { name: '이 백업으로 바꾸기' }).click();
  await expect(page.getByText(/백업으로 바꿨어요\./)).toBeVisible();
  await expect(page.getByLabel('학습 수준')).toHaveValue('N3');
  await page.goto('#/favorites');
  await expect(page.getByRole('list', { name: '단어 목록' }).locator('.word-written')).toHaveText(['猫']);
  await page.goto('#/study');
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();
});

test('a bad file is refused and nothing on the device changes', async ({ page }) => {
  await page.goto('#/words');
  await list(page).getByRole('button', { name: '猫 즐겨찾기 추가' }).click();
  await expect(list(page).getByRole('button', { name: '猫 즐겨찾기 해제' })).toBeVisible();

  await importText(page, '{"hello": "world"}');
  await expect(page.getByRole('alert')).toContainText('하루일본어 백업 파일이 아니에요.');
  await expect(page.getByRole('region', { name: '가져올 백업 확인' })).toHaveCount(0);

  const { text } = await exportBackup(page);
  const broken = JSON.parse(text);
  broken.favorites.push({ wordId: 'w001', createdAt: 'yesterday' });
  await importText(page, JSON.stringify(broken));
  await expect(page.getByRole('alert')).toContainText('이 파일은 가져올 수 없어요. 이 기기의 기록은 그대로예요.');
  await expect(page.getByRole('alert')).toContainText('favorites에 같은 wordId "w001"가 두 번 있어요.');

  expect(await favoriteCount(page)).toBe(1);
});
