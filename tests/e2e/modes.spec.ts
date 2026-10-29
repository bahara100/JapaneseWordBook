import { expect, test, type Page } from '@playwright/test';
import { fakeRecognition, fakeSpeech, spoken } from './fakes';

// N5 sample cards in course order: 猫 ねこ 고양이, 学校 がっこう 학교, りんご りんご 사과.
const card = (page: Page) => page.getByRole('article');
const VOICES = [{ name: 'Test 日本語', lang: 'ja-JP' }];

function count(page: Page, store: 'wordProgress' | 'answerAttempts') {
  return page.evaluate(name => new Promise<number>(resolve => {
    const open = indexedDB.open('haru-japanese');
    open.onsuccess = () => { const q = open.result.transaction(name).objectStore(name).count(); q.onsuccess = () => { resolve(q.result); open.result.close(); }; };
  }), store);
}

async function startMode(page: Page, name: '듣고 맞히기' | '따라 말하기') {
  await page.goto('#/study');
  await page.getByRole('region', { name: '다른 방법으로 연습하기' }).getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByText('1 / 3장')).toBeVisible();
}

test('listening: hear it, pick the meaning, and nothing reaches the schedule', async ({ page }, info) => {
  await fakeSpeech(page, VOICES);
  await startMode(page, '듣고 맞히기');

  // The question side has only sound and choices: no picture, no word, no reading.
  await expect(card(page).getByRole('img')).toHaveCount(0);
  await expect(card(page)).not.toContainText('猫');
  await expect(card(page)).not.toContainText('ねこ');
  const choices = card(page).getByRole('group', { name: '뜻 고르기' }).getByRole('button');
  await expect(choices).toHaveCount(3);
  expect((await choices.allTextContents()).sort()).toEqual(['고양이', '사과', '학교']);
  await card(page).getByRole('button', { name: '소리 듣기' }).click();
  expect(await spoken(page)).toEqual([expect.objectContaining({ text: 'ねこ', lang: 'ja-JP' })]);
  await page.screenshot({ path: info.outputPath('listening.png') });

  // Choices are fixed for the round, even after a reload.
  const order = await choices.allTextContents();
  await page.reload();
  await expect(choices).toHaveText(order);

  await choices.filter({ hasText: '학교' }).click();
  await expect(card(page).getByText('아쉬워요. 정답을 확인해 보세요.')).toBeVisible();
  await expect(card(page).getByText('내가 고른 뜻')).toContainText('학교');
  await expect(card(page).getByRole('heading', { name: '猫' })).toBeVisible();
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();

  await choices.filter({ hasText: '학교' }).click();
  await expect(card(page).getByText('정답이에요.')).toBeVisible();
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();

  await card(page).getByRole('button', { name: '모르겠어요 · 정답 보기' }).click();
  await card(page).getByRole('button', { name: '연습 마치기 →' }).click();

  await expect(page.getByText('듣고 맞히기 연습을 마쳤어요. 3장 중 1장을 바로 맞혔어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '오늘의 학습 시작 →' })).toBeVisible();
  expect(await count(page, 'wordProgress')).toBe(0);
  expect(await count(page, 'answerAttempts')).toBe(3);
});

test('repeat: see and hear the word, say it along, results stay practice only', async ({ page }, info) => {
  await fakeSpeech(page, VOICES);
  await fakeRecognition(page, [{ heard: ['猫'] }, { heard: ['ねっこ'] }, { error: 'no-speech' }]);
  await startMode(page, '따라 말하기');

  await expect(card(page).getByRole('heading', { name: '猫' })).toBeVisible();
  await expect(card(page)).toContainText('ねこ');
  await expect(card(page)).toContainText('고양이');
  await card(page).getByRole('button', { name: '발음 듣기' }).click();
  expect(await spoken(page)).toEqual([expect.objectContaining({ text: 'ねこ' })]);

  const sayAlong = card(page).getByRole('button', { name: '따라 말하기' });
  await sayAlong.click();
  await expect(card(page).getByText('정답 단어로 인식했어요.')).toBeVisible();
  await sayAlong.click();
  await expect(card(page).getByText('‘ねっこ’(으)로 들렸어요. 소리를 다시 듣고 따라 해 보세요.')).toBeVisible();
  await sayAlong.click();
  await expect(card(page).getByText('잘 듣지 못했어요.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('repeat.png') });

  for (const label of ['다음 카드 →', '다음 카드 →', '연습 마치기 →']) await card(page).getByRole('button', { name: label }).click();
  await expect(page.getByText('따라 말하기 연습을 마쳤어요. 3장을 따라 했어요.')).toBeVisible();
  expect(await count(page, 'wordProgress')).toBe(0);
  expect(await count(page, 'answerAttempts')).toBe(3);
});

test('practice modes are offered after the day is done too, and can be left', async ({ page }) => {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  for (let i = 0; i < 3; i++) {
    await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await card(page).getByRole('button', { name: /다음 카드 →|오늘의 결과 보기 →/ }).click();
  }
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();
  await page.getByRole('region', { name: '다른 방법으로 연습하기' }).getByRole('button', { name: /따라 말하기/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('따라 말하기');
  await page.getByRole('button', { name: '연습 그만하기' }).click();
  await expect(page.getByRole('region', { name: '오늘의 결과' })).toBeVisible();
  await expect(page.getByText(/연습을 마쳤어요/)).toHaveCount(0);
});
