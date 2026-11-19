import { useEffect, useState } from 'react'

export type HaEnv = { dark: boolean; language: string }
type Hass = { themes?: { darkMode?: boolean }; language?: string }

/**
 * Ingress serves us same-origin with the HA frontend, so we can read its `hass` object for theme and language.
 * shortcut: `hass` is an HA internal; if HA changes it we silently fall back to the browser settings.
 */
export function readHaEnv(win: Window = window): HaEnv {
  try {
    if (win.parent !== win) {
      const hass = (win.parent.document.querySelector('home-assistant') as { hass?: Hass } | null)?.hass
      if (hass) return { dark: !!hass.themes?.darkMode, language: hass.language ?? 'en' }
    }
  } catch {
    // not embedded in HA, or not same-origin: use the browser
  }
  return { dark: win.matchMedia('(prefers-color-scheme: dark)').matches, language: win.navigator.language }
}

export function resolveLanguage(setting: 'auto' | 'en' | 'nl', haLanguage: string): 'en' | 'nl' {
  if (setting !== 'auto') return setting
  return haLanguage.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

/** HA has no change event we can subscribe to from the frame, so re-read on focus and every 2 s. */
export function useHaEnv(): HaEnv {
  const [env, setEnv] = useState(readHaEnv)
  useEffect(() => {
    const update = () =>
      setEnv((prev) => {
        const next = readHaEnv()
        return next.dark === prev.dark && next.language === prev.language ? prev : next
      })
    const id = setInterval(update, 2000)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(id)
      mq.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return env
}
