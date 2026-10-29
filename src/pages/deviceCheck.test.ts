import { describe, expect, it } from 'vitest';
import { describeBrowser } from './DeviceCheck';

describe('describeBrowser', () => {
  it('names the common browsers and systems', () => {
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'))
      .toBe('Chrome 131 · Windows');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70'))
      .toBe('Edge 131 · Windows');
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'))
      .toBe('Samsung Internet 26 · Android');
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'))
      .toBe('Safari 18 · iPhone');
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1'))
      .toBe('Chrome 131 (iOS) · iPhone');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0')).toBe('Firefox 133 · Windows');
  });
});
