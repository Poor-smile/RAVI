import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mobileEntryScript } from '../scripts/mobile-entry.mjs';

function visit({ url = 'https://raviweb.poorsmile.ir/', ua = 'Desktop Chrome', platform = 'Win32', touch = 0, coarse = false, narrow = false, saved = null, blocked = false } = {}) {
  let target;
  const storage = new Map(saved ? [['raavi:web-view', saved]] : []);
  vm.runInNewContext(mobileEntryScript, {
    URL, navigator: { userAgent: ua, platform, maxTouchPoints: touch },
    window: { location: { href: url, pathname: new URL(url).pathname, replace(value) { target = value; } }, matchMedia: query => ({ matches: query.includes('pointer') ? coarse : narrow }) },
    localStorage: { getItem: key => { if (blocked) throw Error('Disabled'); return storage.get(key); }, setItem: (key, value) => { if (blocked) throw Error('Disabled'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
  });
  return { target, saved: storage.get('raavi:web-view') };
}
test('desktop stays while phone and iPad enter Light preserving document query and anchor', () => {
  assert.equal(visit().target, undefined);
  for (const device of [{ ua: 'iPhone' }, { ua: 'Android' }, { platform: 'MacIntel', touch: 5 }, { coarse: true, narrow: true }]) {
    assert.equal(visit({ ...device, url: 'https://raviweb.poorsmile.ir/?document=a%2Fb#section' }).target, 'https://raviweb.poorsmile.ir/light/?document=a%2Fb#section');
  }
});
test('explicit choices override auto detection and persist; auto clears the preference', () => {
  assert.equal(visit({ ua: 'Android', saved: 'desktop' }).target, undefined);
  assert.equal(visit({ ua: 'Android', url: 'https://raviweb.poorsmile.ir/?view=desktop' }).saved, 'desktop');
  assert.equal(visit({ url: 'https://raviweb.poorsmile.ir/?view=light' }).target, 'https://raviweb.poorsmile.ir/light/');
  assert.equal(visit({ ua: 'Android', saved: 'desktop', url: 'https://raviweb.poorsmile.ir/?view=auto' }).target, 'https://raviweb.poorsmile.ir/light/');
});
test('private browsing still redirects; subpaths never loop', () => {
  assert.equal(visit({ ua: 'iPhone', blocked: true }).target, 'https://raviweb.poorsmile.ir/light/');
  for (const path of ['/light/', '/light', '/document']) assert.equal(visit({ ua: 'iPhone', url: `https://raviweb.poorsmile.ir${path}` }).target, undefined);
});
