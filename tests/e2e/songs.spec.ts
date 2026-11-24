import { expect, test, type Page } from './test';

// Two made-up songs over the sample words (猫 w001, 学校 w002 in N5; 経験 w004 in N4) and grammar.
const SONGS = {
  songs: [
    { id: 's001', title: '시험 노래', artist: '시험 가수', wordIds: ['w001', 'w004'], grammarIds: ['g002'],
      provenance: { author: '시험', usageTerms: '시험', status: 'draft' } },
    { id: 's002', title: '두 번째 노래', artist: '다른 가수', wordIds: ['w001'], grammarIds: [],
      provenance: { author: '시험', usageTerms: '시험', status: 'draft' } },
  ],
};

async function withSongs(page: Page) {
  await page.route('**/content/songs.json', route => route.fulfill({ json: SONGS }).catch(() => {}));
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 720;
const detail = (page: Page) => page.getByRole('region', { name: '선택한 노래 상세' });

test('without songs the menu explains what will appear', async ({ page }) => {
  await page.goto('#/songs');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('노래로 만나는 일본어.');
  await expect(page.getByRole('heading', { name: '아직 들어온 노래가 없어요.' })).toBeVisible();
});

test('a song shows its words and grammar, newest song first', async ({ page }, info) => {
  await withSongs(page);
  await page.goto('#/songs');
  const list = page.getByRole('list', { name: '노래 목록' });
  await expect(list.getByRole('link')).toHaveText([/두 번째 노래.*단어 1개 · 문법 0개/, /시험 노래.*시험 가수 · 단어 2개 · 문법 1개/]);
  await list.getByRole('link', { name: /시험 노래/ }).click();
  await expect(page).toHaveURL(/#\/songs\/s001$/);
  await expect(detail(page).getByRole('heading', { name: '시험 노래' })).toBeFocused();
  await expect(detail(page).getByText('N5 1 · N4 2')).toBeVisible();
  const words = detail(page).getByRole('list', { name: '시험 노래의 단어' }).getByRole('link');
  await expect(words).toHaveCount(2);
  await expect(words.first()).toContainText('猫');
  await expect(words.first()).toContainText('고양이');
  await expect(detail(page).getByRole('list', { name: '시험 노래의 문법' }).getByRole('link')).toHaveText([/〜ながら/]);
  await page.screenshot({ path: info.outputPath('song.png'), fullPage: true });

  // The words open in the word library, which links back to every song they came from.
  await words.first().click();
  await expect(page).toHaveURL(/#\/words\/w001$/);
  const word = page.getByRole('region', { name: '선택한 단어 상세' });
  await expect(word.getByRole('heading', { name: '이 단어가 나온 노래' })).toBeVisible();
  await expect(word.getByRole('link', { name: /노래/ })).toHaveText(['시험 노래', '두 번째 노래']);
  await word.getByRole('link', { name: '두 번째 노래' }).click();
  await expect(page).toHaveURL(/#\/songs\/s002$/);
  await expect(detail(page).getByRole('heading', { name: '두 번째 노래' })).toBeVisible();
});

test('grammar from a song links back to the song', async ({ page }) => {
  await withSongs(page);
  await page.goto('#/grammar/g002');
  const point = page.getByRole('region', { name: '선택한 문법 상세' });
  await expect(point.getByRole('heading', { name: '이 문법이 나온 노래' })).toBeVisible();
  await point.getByRole('link', { name: '시험 노래' }).click();
  await expect(detail(page).getByRole('heading', { name: '시험 노래' })).toBeVisible();
  if (isPhone(page)) {
    await page.getByRole('link', { name: '← 노래 목록으로' }).click();
    await expect(page.getByRole('list', { name: '노래 목록' })).toBeVisible();
  }
});

test('an unknown song shows a way back', async ({ page }) => {
  await withSongs(page);
  await page.goto('#/songs/s999');
  await expect(detail(page).getByRole('heading', { name: '찾는 노래가 없어요.' })).toBeVisible();
  await detail(page).getByRole('link', { name: '노래 목록 보기 →' }).click();
  await expect(page).toHaveURL(/#\/songs$/);
});
