import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import i18n from '@/i18n'
import { mockApi } from '@/test/render'
import { FolderTree } from './FolderPicker'
import { SchedulePicker } from './SchedulePicker'

beforeAll(() => i18n.changeLanguage('en'))

function Schedule({ initial, onCron }: { initial: string; onCron: (c: string) => void }) {
  const [cron, setCron] = useState(initial)
  return <SchedulePicker value={cron} onChange={(c) => { setCron(c); onCron(c) }} />
}

test('schedule radios turn into cron and keep the time', async () => {
  const seen: string[] = []
  render(<Schedule initial="30 1 * * *" onCron={(c) => seen.push(c)} />)
  expect(screen.getByRole('radio', { name: 'Every day' })).toBeChecked()
  expect(screen.getByLabelText('At')).toHaveValue('01:30')

  await userEvent.click(screen.getByRole('radio', { name: 'Every week' }))
  expect(seen.at(-1)).toBe('30 1 * * 0')
  await userEvent.click(screen.getByRole('button', { name: 'Wednesday' }))
  expect(seen.at(-1)).toBe('30 1 * * 0,3')
  await userEvent.click(screen.getByRole('button', { name: 'Sunday' }))
  expect(seen.at(-1)).toBe('30 1 * * 3')
  await userEvent.click(screen.getByRole('button', { name: 'Wednesday' })) // the last day cannot be removed
  expect(seen.at(-1)).toBe('30 1 * * 3')

  await userEvent.click(screen.getByRole('radio', { name: 'Custom (cron)' }))
  expect(screen.getByLabelText('Cron expression')).toHaveValue('30 1 * * 3')
})

test('folder tree opens folders lazily, shows files and selects folders only', async () => {
  mockApi()
  let picked = ''
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FolderTree selected="" onSelect={(p) => { picked = p }} />
    </QueryClientProvider>,
  )
  const tree = await screen.findByRole('tree', { name: 'Source folders' })
  expect((await within(tree).findAllByRole('treeitem')).map((i) => i.querySelector('.font-mono')?.textContent))
    .toEqual(['/homeassistant', '/backup', '/media', '/share'])
  await userEvent.click(screen.getByRole('button', { name: 'Open media' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Open music' }))
  expect(await screen.findByText('Daft Punk')).toBeInTheDocument()
  await userEvent.click(screen.getByText('music'))
  expect(picked).toBe('/media/music')

  await userEvent.click(screen.getByRole('button', { name: 'Open homeassistant' }))
  expect(await screen.findByText('configuration.yaml')).toBeInTheDocument() // files are listed, not selectable
})
