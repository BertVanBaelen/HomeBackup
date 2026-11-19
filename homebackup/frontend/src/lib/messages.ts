import i18n from '@/i18n'
import type { Message } from '@/api/client'

/** Translate a language-neutral API message. `files` doubles as the plural count. */
export function msg(m: Message | null | undefined, short = false) {
  if (!m) return ''
  const params = m.params ?? {}
  const key = `msg.${m.code}${short ? '_short' : ''}`
  return i18n.t(i18n.exists(key) ? key : `msg.${m.code}`, { ...params, count: params.files, defaultValue: m.code })
}
