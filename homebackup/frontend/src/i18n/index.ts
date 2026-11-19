import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// One file per area (common.json, editor.json, ...), each with its own top-level key, merged per language.
const files = import.meta.glob<Record<string, unknown>>('./*/*.json', { eager: true, import: 'default' })
const resources: Record<string, { translation: Record<string, unknown> }> = {}
for (const [path, data] of Object.entries(files)) {
  const lng = path.split('/')[1]
  resources[lng] ??= { translation: {} }
  Object.assign(resources[lng].translation, data)
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
