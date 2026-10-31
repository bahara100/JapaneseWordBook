// Uses the real, full word list (no sample trimming), so it imports Playwright directly.
import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.getByRole('article');
const list = (page: Page) => page.getByRole('list', { name: '단어 목록' });

test('every level has 50 words, and the library and home show them', async ({ page }) => {
  await page.goto('#/home');
  await expect(page.getByText('준비된 N5 카드 50장 · 검수 전 초안 50장 포함')).toBeVisible();
  await page.goto('#/words');
  await expect(page.getByText('250개의 단어')).toBeVisible();
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    await page.getByLabel('학습 수준').selectOption(level);
    await expect(page.getByText('50개의 단어')).toBeVisible();
  }
  await page.getByLabel('학습 수준').selectOption('all');
  await page.getByLabel('단어 검색').fill('kuukou');
  await expect(list(page).locator('.word-written')).toHaveText(['空港']);
});

test('a full day uses the daily target, with pictures for the first N5 words', async ({ page }) => {
  await page.goto('#/study');
  await expect(page.getByText('하루 목표 15장')).toBeVisible();
  await expect(page.getByText(/오늘은 준비된 카드/)).toHaveCount(0);
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await expect(page.getByText('1 / 15장')).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await expect(card(page).getByRole('img')).toHaveCount(1);
    await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await card(page).getByRole('button', { name: '다음 카드 →' }).click();
  }
  // The new pictures continue past the first three: 水 was 4th above, 本 is 5th here.
  await expect(page.getByText('5 / 15장')).toBeVisible();
  const picture = card(page).getByRole('img');
  await expect(picture).toHaveAccessibleName('책갈피가 살짝 보이는 한 권의 책');
  expect(await picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('words without a picture ask for the reading of the written word', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('haru-japanese.settings.v1', JSON.stringify({ level: 'N4' })));
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  for (let i = 0; i < 3; i++) {
    await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await card(page).getByRole('button', { name: '다음 카드 →' }).click();
  }
  // 経験 has no picture yet: the word is shown and the reading is asked for.
  await expect(page.getByText('4 / 15장')).toBeVisible();
  await expect(card(page).getByRole('img')).toHaveCount(0);
  await expect(card(page).locator('.front-word')).toHaveText('経験');
  await expect(card(page).getByRole('heading', { name: '어떻게 읽을까요?' })).toBeVisible();
  await expect(card(page)).not.toContainText('けいけん');
  await page.screenshot({ path: info.outputPath('reading-card.png') });
  await card(page).getByRole('button', { name: '직접 입력' }).click();
  await card(page).getByLabel('영문 자판으로 입력').fill('keiken');
  await card(page).getByRole('button', { name: /히라가나/ }).click();
  await card(page).getByRole('button', { name: '입력 완료 · 정답 확인' }).click();
  await expect(card(page).getByText('정답이에요.')).toBeVisible();
  await expect(card(page)).toContainText('海外で働いた経験があります。');
});

test('pictures that need context carry a short hint', async ({ page }, info) => {
  await page.goto('#/words');
  for (const word of ['今日', '明日']) {
    await page.getByLabel('단어 검색').fill(word);
    await page.getByRole('list', { name: '단어 목록' }).getByRole('button', { name: `${word} 즐겨찾기 추가` }).click();
    await expect(page.getByRole('list', { name: '단어 목록' }).getByRole('button', { name: `${word} 즐겨찾기 해제` })).toBeVisible();
  }
  await page.goto('#/favorites');
  await page.getByRole('button', { name: '모은 단어 학습하기 →' }).click();
  const hints = ['달력에서 표시된 날의 다음 날이에요.', '달력에서 지금 표시된 날이에요.']; // newest favorite first
  await expect(card(page).locator('.situation-hint')).toHaveText(hints[0]);
  await page.screenshot({ path: info.outputPath('hint-card.png') });
  await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
  await card(page).getByRole('button', { name: '다음 카드 →' }).click();
  await expect(card(page).locator('.situation-hint')).toHaveText(hints[1]);
});

test('a word written only in kana shows its meaning instead', async ({ page }, info) => {
  await page.goto('#/words');
  await page.getByLabel('단어 검색').fill('텔레비전');
  await list(page).getByRole('button', { name: 'テレビ 즐겨찾기 추가' }).click();
  await expect(list(page).getByRole('button', { name: 'テレビ 즐겨찾기 해제' })).toBeVisible();
  await page.goto('#/favorites');
  await page.getByRole('button', { name: '모은 단어 학습하기 →' }).click();
  await expect(card(page).locator('.front-meaning')).toContainText('텔레비전');
  await expect(card(page).getByRole('heading', { name: '일본어로 뭐라고 할까요?' })).toBeVisible();
  await expect(card(page)).not.toContainText('テレビ');
  await page.screenshot({ path: info.outputPath('meaning-card.png') });
});

test('listening practice offers four meanings from the level', async ({ page }) => {
  await page.goto('#/study');
  await page.getByRole('region', { name: '다른 방법으로 연습하기' }).getByRole('button', { name: /듣고 맞히기/ }).click();
  await expect(page.getByText('1 / 10장')).toBeVisible();
  const choices = card(page).getByRole('group', { name: '뜻 고르기' }).getByRole('button');
  await expect(choices).toHaveCount(4);
  await expect(choices.filter({ hasText: '고양이' })).toHaveCount(1);
});
