import { act, fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { api, mockApi, renderPage } from '@/test/render'
import { PlanPreview } from './PlanPreview'

beforeAll(() => i18n.changeLanguage('en'))
const open = (url: string) => renderPage(<PlanPreview />, { path: '/items/:id/plan', url })

test('shows the four steps of the plan, the allowed programs and what the rsync flags mean', async () => {
  mockApi()
  open('/items/it5/plan')
  const steps = await screen.findByRole('list', { name: 'Steps' })
  const titles = within(steps).getAllByRole('button').map((b) => within(b).getByText(/^(Mount|Check|Copy|Unmount)/).textContent)
  expect(titles).toEqual(['Mount the target', 'Check free space', 'Copy the source', 'Unmount the target'])
  expect(screen.getByText(/rsync -rt --no-perms .* \/homeassistant\//)).toBeInTheDocument()
  expect(screen.getByText('4 steps, 4 commands. Select a step to open or close it.')).toBeInTheDocument()

  const how = screen.getByRole('region', { name: 'How commands run' })
  expect(within(how).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['mount', 'umount', 'blkid', 'df', 'rsync', 'find'])
  const flags = screen.getByRole('region', { name: 'What the rsync flags mean' })
  expect(within(flags).getByText('Create the target folder when it does not exist yet.')).toBeInTheDocument()
  expect(within(flags).getByText('Not used. Delete is off for this item.')).toBeInTheDocument()
  expect(screen.getByText('Steps 1, 2 and 4.')).toBeInTheDocument()
  expect(screen.getByText('Calls script.backup_ok')).toBeInTheDocument()
})

test('selecting a step opens or closes it', async () => {
  mockApi()
  open('/items/it5/plan')
  const copy = await screen.findByRole('button', { name: /Copy the source/ })
  expect(copy).toHaveAttribute('aria-expanded', 'true') // the phone default: only the copy step is open
  fireEvent.click(copy)
  expect(copy).toHaveAttribute('aria-expanded', 'false')
  const mount = screen.getByRole('button', { name: /Mount the target/ })
  expect(mount).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(mount)
  expect(mount).toHaveAttribute('aria-expanded', 'true')
})

test('a type that is not installed shows the error and blocks running', async () => {
  mockApi()
  open('/items/it4/plan')
  expect(await screen.findByRole('alert')).toHaveTextContent('The type immich is not installed.')
  expect(screen.queryByRole('list', { name: 'Steps' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Dry run' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Run now/ })).toBeDisabled()
})

test('Run now needs a hold: a short click does nothing, a full hold starts the run', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const status = api.status as { running: { run_id: string }[] }
  const calls = mockApi({ 'POST items/it5/run': { ...status, running: [{ ...status.running[0], run_id: 'it5-20261110141000' }] } })
  open('/items/it5/plan')
  await screen.findByRole('list', { name: 'Steps' })
  const button = screen.getByRole('button', { name: /Run now/ })

  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.pointerUp(button)
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(calls.map((c) => c.call)).toEqual([])

  fireEvent.pointerDown(button, { button: 0 })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.pointerUp(button)
  await act(() => vi.advanceTimersByTimeAsync(50))
  expect(calls.map((c) => c.call)).toEqual(['POST items/it5/run'])
  expect(await screen.findByText('navigated away')).toBeInTheDocument() // to the new run's live log
  vi.useRealTimers()
})
