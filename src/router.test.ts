import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router';

describe('parseHash', () => {
  it('opens home for an empty hash', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
  });

  it('reads each menu section', () => {
    for (const name of ['home', 'study', 'words', 'grammar', 'favorites', 'settings', 'check']) {
      expect(parseHash(`#/${name}`)).toEqual({ name });
    }
  });

  it('ignores a trailing slash', () => {
    expect(parseHash('#/words/')).toEqual({ name: 'words' });
  });

  it('reads word and grammar detail ids', () => {
    expect(parseHash('#/words/w001')).toEqual({ name: 'words', id: 'w001' });
    expect(parseHash('#/grammar/g%20one')).toEqual({ name: 'grammar', id: 'g one' });
  });

  it('rejects unknown paths and details on other sections', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'not-found', path: 'nope' });
    expect(parseHash('#/settings/x')).toEqual({ name: 'not-found', path: 'settings/x' });
    expect(parseHash('#/words/w001/extra')).toEqual({ name: 'not-found', path: 'words/w001/extra' });
  });
});

describe('hrefFor', () => {
  it('round-trips through parseHash', () => {
    for (const hash of ['#/home', '#/study', '#/words', '#/words/w001', '#/grammar/g%20one', '#/settings']) {
      expect(hrefFor(parseHash(hash))).toBe(hash);
    }
  });
});
