import { expect, test } from './test';
import { fakeRecognition, fakeSpeech, spoken } from './fakes';

test('the device check reports support and runs the sound and speaking tests', async ({ page }, info) => {
  await fakeSpeech(page, [{ name: 'Korean voice', lang: 'ko-KR' }, { name: 'Test 日本語', lang: 'ja-JP' }]);
  await fakeRecognition(page, [{ heard: ['猫', 'ネコ'] }]);
  await page.goto('#/settings');
  await page.getByRole('link', { name: /이 기기에서 저장·듣기·말하기가 되는지 확인하기/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이 기기 확인');

  const storage = page.getByRole('region', { name: '기록 저장' });
  await expect(storage).toContainText('학습 기록가능이 기기에 저장돼요');
  const playback = page.getByRole('region', { name: '발음 듣기' });
  await expect(playback).toContainText('지원 · 음성 2개');
  await expect(playback).toContainText('Test 日本語(기기)');
  await expect(page.getByRole('region', { name: '말하기' })).toContainText('음성 인식가능지원');

  await page.getByRole('button', { name: '소리 시험 · ねこ' }).click();
  expect(await spoken(page)).toEqual([expect.objectContaining({ text: 'ねこ', lang: 'ja-JP' })]);
  await page.getByRole('button', { name: '말하기 시험 · ‘ねこ’라고 말하기' }).click();
  await expect(page.getByRole('region', { name: '직접 해 보기' }).getByText('‘ねこ’로 인식됨 · 들은 말: 猫 / ネコ')).toBeVisible();

  const report = page.getByLabel('확인 결과');
  await expect(report).toHaveValue(/하루일본어 기기 확인/);
  await expect(report).toHaveValue(/- 일본어 음성: Test 日本語\(기기\) \(가능\)/);
  await expect(report).toHaveValue(/- 소리 시험\(ねこ\): 재생됨/);
  await expect(report).toHaveValue(/- 말하기 시험\(ねこ\): ‘ねこ’로 인식됨/);
  await page.screenshot({ path: info.outputPath('check.png'), fullPage: true });
});

test('a device without voices or recognition is reported plainly', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await fakeRecognition(page, 'none');
  await page.goto('#/check');
  await expect(page.getByRole('region', { name: '발음 듣기' })).toContainText('음성 합성안 됨지원 안 됨');
  await expect(page.getByRole('region', { name: '말하기' })).toContainText('지원 안 됨(직접 입력으로 학습)');
  await page.getByRole('button', { name: /말하기 시험/ }).click();
  await expect(page.getByLabel('확인 결과')).toHaveValue(/말하기 시험\(ねこ\): 이 브라우저에서는 말하기를 지원하지 않아요/);
});
