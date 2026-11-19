import i18n from '@/i18n'
import type { Message } from '@/api/client'
import { bytes } from './format'

/** Translate a language-neutral API message. `files` doubles as the plural count; byte params get a `_h` form. */
export function msg(m: Message | null | undefined, short = false) {
  if (!m) return ''
  const params: Record<string, unknown> = { ...m.params, count: m.params?.files }
  for (const k of ['free', 'min']) if (typeof m.params?.[k] === 'number') params[`${k}_h`] = bytes(m.params[k] as number)
  const key = `msg.${m.code}${short ? '_short' : ''}`
  return i18n.t(i18n.exists(key) ? key : `msg.${m.code}`, { ...params, defaultValue: m.code })
}
