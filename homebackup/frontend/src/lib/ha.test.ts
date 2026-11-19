import { readHaEnv, resolveLanguage } from './ha'

function fakeWindow(parentDoc: unknown, prefersDark = false, lang = 'en-GB') {
  const win: Record<string, unknown> = {
    matchMedia: () => ({ matches: prefersDark }),
    navigator: { language: lang },
  }
  win.parent = parentDoc ? { document: parentDoc } : win
  return win as unknown as Window
}

test('reads theme and language from the HA frontend when embedded', () => {
  const hass = { themes: { darkMode: true }, language: 'nl' }
  const doc = { querySelector: (s: string) => (s === 'home-assistant' ? { hass } : null) }
  expect(readHaEnv(fakeWindow(doc))).toEqual({ dark: true, language: 'nl' })
})

test('falls back to the browser when not inside HA', () => {
  expect(readHaEnv(fakeWindow(null, true, 'nl-BE'))).toEqual({ dark: true, language: 'nl-BE' })
})

test('falls back when the parent is not reachable', () => {
  const doc = { querySelector: () => { throw new Error('cross-origin') } }
  expect(readHaEnv(fakeWindow(doc, false, 'en-US'))).toEqual({ dark: false, language: 'en-US' })
})

test('language setting overrides HA, auto follows HA', () => {
  expect(resolveLanguage('auto', 'nl-BE')).toBe('nl')
  expect(resolveLanguage('auto', 'fr')).toBe('en')
  expect(resolveLanguage('nl', 'en')).toBe('nl')
  expect(resolveLanguage('en', 'nl')).toBe('en')
})
