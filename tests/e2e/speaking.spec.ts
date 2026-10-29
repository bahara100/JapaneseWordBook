import { expect, test, type Page } from '@playwright/test';
import { fakeRecognition } from './fakes';

const card = (page: Page) => page.getByRole('article');
const speak = (page: Page) => card(page).getByRole('button', { name: /말하기|듣는 중/ }).click();

async function start(page: Page) {
  await page.goto('#/study');
  await page.getByRole('button', { name: '오늘의 학습 시작 →' }).click();
  await expect(page.getByText('1 / 3장')).toBeVisible();
}

function attempts(page: Page) {
  return page.evaluate(() => new Promise<{ method: string; outcome: string; inputText?: string }[]>(resolve => {
    const open = indexedDB.open('haru-japanese');
    open.onsuccess = () => {
      const q = open.result.transaction('answerAttempts').objectStore('answerAttempts').getAll();
      q.onsuccess = () => {
        const inOrder = q.result.sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
        resolve(inOrder.map(({ method, outcome, inputText }) => ({ method, outcome, inputText })));
        open.result.close();
      };
    };
  }));
}

test('saying the word is recognised as the right answer', async ({ page }) => {
  await fakeRecognition(page, [{ heard: ['寝子', '猫', 'ネコ'] }]);
  await start(page);
  await speak(page);
  await expect(card(page).getByText('정답 단어로 인식했어요.')).toBeVisible();
  await expect(card(page).getByText('들은 말')).toContainText('猫');
  expect(await page.evaluate(() => (window as unknown as { __started: unknown[] }).__started)).toEqual([{ lang: 'ja-JP', maxAlternatives: 5 }]);
  await page.reload();
  await expect(card(page).getByText('정답 단어로 인식했어요.')).toBeVisible();
  expect(await attempts(page)).toEqual([{ method: 'speech', outcome: 'correct', inputText: '猫' }]);
});

test('another word is asked again once, then counts as wrong', async ({ page }) => {
  await fakeRecognition(page, [{ heard: ['ねっこ'] }, { heard: ['ねっこ'] }]);
  await start(page);
  await speak(page);
  await expect(card(page).getByText('‘ねっこ’(으)로 들렸어요. 한 번 더 또렷하게 말해 볼까요?')).toBeVisible();
  await expect(card(page).getByText('읽기를 다시 확인해 볼까요?')).toHaveCount(0);
  await speak(page);
  await expect(card(page).getByText('읽기를 다시 확인해 볼까요?')).toBeVisible();
  await expect(card(page).getByText('들은 말')).toContainText('ねっこ');
  expect(await attempts(page)).toEqual([
    { method: 'speech', outcome: 'unrecognized', inputText: 'ねっこ' },
    { method: 'speech', outcome: 'incorrect', inputText: 'ねっこ' },
  ]);
});

test('silence and a dropped connection are not wrong answers', async ({ page }) => {
  await fakeRecognition(page, [{ error: 'no-speech' }, { error: 'network' }, { heard: ['ねこ'] }]);
  await start(page);
  await speak(page);
  await expect(card(page).getByText('잘 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.')).toBeVisible();
  await speak(page);
  await expect(card(page).getByText('말하기 확인이 연결되지 않았어요.')).toBeVisible();
  await speak(page);
  // Still the first try that counts: right, with no mistakes recorded before it.
  await expect(card(page).getByText('정답 단어로 인식했어요.')).toBeVisible();
  expect((await attempts(page)).map(a => a.outcome)).toEqual(['unrecognized', 'unrecognized', 'correct']);
});

test('a refused microphone opens typing, and nothing is recorded', async ({ page }) => {
  await fakeRecognition(page, [{ error: 'not-allowed' }]);
  await start(page);
  await speak(page);
  await expect(card(page).getByText('마이크를 사용할 수 없어요. 직접 입력으로 계속할 수 있어요.')).toBeVisible();
  await expect(card(page).getByLabel('영문 자판으로 입력')).toBeVisible();
  expect(await attempts(page)).toEqual([]);
});

test('listening can be cancelled', async ({ page }) => {
  await fakeRecognition(page, ['hang']);
  await start(page);
  await speak(page);
  const listening = card(page).getByRole('button', { name: '듣는 중 · 취소' });
  await expect(listening).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).getByText('듣고 있어요. 일본어로 말해 주세요.')).toBeVisible();
  await listening.click();
  await expect(card(page).getByText('말하기를 취소했어요.')).toBeVisible();
  await expect(card(page).getByRole('button', { name: '말하기' })).toHaveAttribute('aria-pressed', 'false');
  expect(await attempts(page)).toEqual([]);
});

test('without speech recognition, typing is offered instead', async ({ page }) => {
  await fakeRecognition(page, 'none');
  await start(page);
  await speak(page);
  await expect(card(page).getByText('이 브라우저에서는 말하기를 지원하지 않아요. 직접 입력으로 답해 주세요.')).toBeVisible();
  await expect(card(page).getByLabel('영문 자판으로 입력')).toBeVisible();
});
