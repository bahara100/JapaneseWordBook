import { expect, test, type Page } from '@playwright/test';

/** Replaces the browser's speech with a recorder; `voices` decides which voices the "device" has. */
async function fakeSpeech(page: Page, voices: { name: string; lang: string }[] | 'none') {
  await page.addInitScript(list => {
    const w = window as unknown as Record<string, unknown>;
    if (list === 'none') {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true });
      return;
    }
    const spoken: unknown[] = [];
    w.__spoken = spoken;
    class FakeUtterance {
      lang = ''; rate = 1; voice: { name: string } | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => list.map(v => ({ ...v, localService: true, default: false, voiceURI: v.name })),
        speak: (u: FakeUtterance) => { spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name }); w.__last = u; },
        cancel: () => { (w.__last as FakeUtterance | undefined)?.onend?.(); },
        addEventListener() {}, removeEventListener() {},
      },
    });
    w.__finish = () => (w.__last as FakeUtterance | undefined)?.onend?.();
  }, voices);
}
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken);
const card = (page: Page) => page.getByRole('article');
const JAPANESE = [{ name: 'Korean voice', lang: 'ko-KR' }, { name: 'Test 日本語', lang: 'ja-JP' }];

async function startAndReveal(page: Page) {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
}

test('the answer side reads the word and the example in kana with a Japanese voice', async ({ page }) => {
  await fakeSpeech(page, JAPANESE);
  await startAndReveal(page);
  const listen = card(page).getByRole('button', { name: '발음 듣기' });
  await listen.click();
  await expect(card(page).getByRole('button', { name: '정지' })).toHaveAttribute('aria-pressed', 'true');
  expect(await spoken(page)).toEqual([{ text: 'ねこ', lang: 'ja-JP', rate: 0.85, voice: 'Test 日本語' }]);
  await page.evaluate(() => (window as unknown as { __finish: () => void }).__finish());
  await expect(listen).toHaveAttribute('aria-pressed', 'false');

  await card(page).getByRole('button', { name: '예문 듣기' }).click();
  expect((await spoken(page))[1]).toMatchObject({ text: 'ねこがねています。', lang: 'ja-JP' });
});

test('the speed setting is used, and word and grammar details can play too', async ({ page }) => {
  await fakeSpeech(page, JAPANESE);
  await page.goto('#/settings');
  await page.getByLabel('발음 재생 속도').selectOption({ label: '천천히' });
  await page.goto('#/words/w002');
  await page.getByRole('region', { name: '선택한 단어 상세' }).getByRole('button', { name: '발음 듣기' }).click();
  await page.goto('#/grammar/g002');
  await page.getByRole('region', { name: '선택한 문법 상세' }).getByRole('button', { name: '예문 듣기' }).click();
  expect(await spoken(page)).toEqual([
    { text: 'がっこう', lang: 'ja-JP', rate: 0.7, voice: 'Test 日本語' },
    { text: 'おんがくをききながら、べんきょうします。', lang: 'ja-JP', rate: 0.7, voice: 'Test 日本語' },
  ]);
});

test('the listening hint is remembered and the answer counts as hinted', async ({ page }) => {
  await fakeSpeech(page, JAPANESE);
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  // The question side never shows the answer, even with the hint button there.
  await expect(card(page)).not.toContainText('ねこ');
  await card(page).getByRole('button', { name: '듣기 힌트' }).click();
  expect(await spoken(page)).toEqual([expect.objectContaining({ text: 'ねこ' })]);
  await expect(card(page).getByText('힌트를 들었어요.')).toBeVisible();
  await page.reload();
  await expect(card(page).getByText('힌트를 들었어요.')).toBeVisible();

  await card(page).getByRole('button', { name: '직접 입력' }).click();
  await card(page).getByLabel('영문 자판으로 입력').fill('neko');
  await card(page).getByRole('button', { name: /히라가나/ }).click();
  await card(page).getByRole('button', { name: '입력 완료 · 정답 확인' }).click();
  await expect(card(page).getByText('힌트를 듣고 맞혔어요.')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    if (i > 0) await card(page).getByRole('button', { name: '카드 뒤집어 정답 보기' }).click();
    await card(page).getByRole('button', { name: /다음 카드 →|오늘의 결과 보기 →/ }).click();
  }
  const summary = page.getByRole('region', { name: '오늘의 결과' });
  await expect(summary.locator('.summary-stats')).toHaveText(/0바로 정답\s*0다시 연습\s*3답 확인·힌트/);
  await expect(summary.getByRole('listitem').first()).toContainText('힌트 사용');
});

test('a device without a Japanese voice says so, and no hint is counted', async ({ page }) => {
  await fakeSpeech(page, [{ name: 'Korean voice', lang: 'ko-KR' }]);
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await card(page).getByRole('button', { name: '듣기 힌트' }).click();
  await expect(card(page).getByText('일본어 음성을 찾지 못했어요.')).toBeVisible();
  await expect(card(page).getByText('힌트를 들었어요.')).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
});

test('a browser without speech says so', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await startAndReveal(page);
  await card(page).getByRole('button', { name: '발음 듣기' }).click();
  await expect(card(page).getByText('이 브라우저에서는 발음 듣기를 지원하지 않아요.')).toBeVisible();
});
