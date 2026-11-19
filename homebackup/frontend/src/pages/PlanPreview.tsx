import { useTranslation } from 'react-i18next'

export function PlanPreview() {
  const { t } = useTranslation()
  return <p className="text-faint">{t('common.coming')}</p>
}
