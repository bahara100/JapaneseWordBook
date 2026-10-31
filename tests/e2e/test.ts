import { test as base, type Route } from '@playwright/test';

export { expect, type Page, type Route } from '@playwright/test';

// Content files as plain JSON.
type Json = { [key: string]: any };

/**
 * Most screen tests describe the original three sample words of each level (猫, 学校, りんご in N5).
 * This serves only those, so the scenarios stay small and fixed as real content grows.
 * Tests of the full word list import from '@playwright/test' directly (full-content.spec.ts).
 */
export const test = base.extend<{ sampleContent: void }>({
  sampleContent: [async ({ page }, use) => {
    // A test may navigate away mid-request; then there is nobody left to answer, so stop quietly.
    const quietly = (handler: (route: Route) => Promise<void>) => (route: Route) => handler(route).catch(() => {});
    await page.route('**/content/*/words.json', quietly(async route => {
      const response = await route.fetch();
      const data: Json = await response.json();
      data.words = data.words.filter((w: Json) => w.curriculumOrder <= 3);
      const ids = new Set(data.words.map((w: Json) => w.id));
      data.prompts = data.prompts.filter((p: Json) => ids.has(p.wordId));
      await route.fulfill({ response, json: data });
    }));
    await page.route('**/content/manifest.json', quietly(async route => {
      const response = await route.fetch();
      const manifest: Json = await response.json();
      for (const level of Object.values(manifest.levels) as Json[]) {
        level.wordCount = 3;
        level.promptCount = Math.min(level.promptCount, 3);
      }
      await route.fulfill({ response, json: manifest });
    }));
    await use();
  }, { auto: true }],
});
