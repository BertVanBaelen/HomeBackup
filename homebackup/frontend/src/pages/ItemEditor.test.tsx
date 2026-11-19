import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { api, mockApi, renderPage } from '@/test/render'
import { ItemEditor } from './ItemEditor'

beforeAll(() => i18n.changeLanguage('en'))

const it5 = { path: '/items/:id', url: '/items/it5' }
const writes = (calls: { call: string }[]) => calls.filter((c) => c.call !== 'POST items/check')
const choose = async (label: string, option: string) => {
  await userEvent.click(screen.getByLabelText(label))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

test('loads an existing item into the form with its next runs and checks', async () => {
  mockApi()
  renderPage(<ItemEditor />, it5)
  expect(await screen.findByLabelText('Name')).toHaveValue('ha-config')
  expect(screen.getByRole('heading', { level: 1, name: 'ha-config' })).toBeInTheDocument()
  expect(screen.getByText('Edit item · Generic rsync')).toBeInTheDocument()
  expect(screen.getByLabelText('Source folder')).toHaveValue('/homeassistant')
  expect(screen.getByLabelText('Target')).toHaveTextContent('nas-backup · SMB share')
  expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('button', { name: /Generic rsync/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('On success')).toHaveTextContent('Default · script.backup_ok')
  expect(screen.getByRole('radio', { name: 'Every day' })).toBeChecked()
  expect(screen.getByLabelText('At')).toHaveValue('01:30')
  expect(screen.getByText('Daily at 01:30 · Europe/Brussels')).toBeInTheDocument()
  expect(screen.queryByText('Immich mode')).not.toBeInTheDocument()

  const next = await screen.findByRole('list', { name: 'Next 5 runs' })
  expect(within(next).getAllByRole('listitem')).toHaveLength(5)
  expect(within(next).getByText('Wed 11 Nov 2026 · 01:30')).toBeInTheDocument()
  expect(screen.getByText('Free space 412 GB, minimum 10 GB')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Folders that will sync' })).getByText('/homeassistant/')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Preview plan' })).toHaveAttribute('href', '/items/it5/plan')
})

test('shows the overlap banner when the check reports one', async () => {
  const check = api['POST items/check'] as { checks: unknown[] }
  mockApi({ 'POST items/check': { ...check, checks: [{ level: 'warning', message: { code: 'overlap', params: { item: 'ha-backups' } } }] } })
  renderPage(<ItemEditor />, it5)
  expect(await screen.findByText('Shares a destination with ha-backups')).toBeInTheDocument()
  expect(screen.getByText(/Both write to nas-backup\/homeassistant\./)).toBeInTheDocument()
})

test('Save sends the edited item with PUT and goes back to the dashboard', async () => {
  const calls = mockApi()
  renderPage(<ItemEditor />, it5)
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'ha-config-2' } })
  await choose('On failure', 'None')
  await choose('On warning', 'script.notify_phone')
  await choose('Target', 'usb-stick · USB drive, exFAT')
  fireEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('navigated away')
  expect(writes(calls)).toEqual([{
    call: 'PUT items/it5',
    body: {
      ...(api['items/it5'] as object), name: 'ha-config-2', enabled: false, target_id: 'tg1',
      hooks: { on_success: null, on_warning: 'script.notify_phone', on_failure: '' },
    },
  }])
})

test('picking Every week and a day saves the matching cron', async () => {
  const calls = mockApi()
  renderPage(<ItemEditor />, it5)
  await userEvent.click(await screen.findByRole('radio', { name: 'Every week' }))
  await userEvent.click(screen.getByRole('button', { name: 'Wednesday' }))
  expect(screen.getByText(/Sunday and Wednesday · Europe\/Brussels$/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('navigated away')
  expect(writes(calls)).toEqual([{ call: 'PUT items/it5', body: { ...(api['items/it5'] as object), schedule: '30 1 * * 0,3' } }])
})

test('Browse opens the folder tree and Use this folder sets the source', async () => {
  const calls = mockApi()
  renderPage(<ItemEditor />, it5)
  await userEvent.click(await screen.findByRole('button', { name: 'Browse' }))
  const tree = await screen.findByRole('tree', { name: 'Source folders' })
  await userEvent.click(await within(tree).findByText('/media'))
  expect(screen.getByText('Selected: /media')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Use this folder' }))
  expect(screen.getByLabelText('Source folder')).toHaveValue('/media')
  // vaul keeps the page aria-hidden in jsdom (its close animation never ends there)
  fireEvent.click(screen.getByRole('button', { name: 'Save', hidden: true }))
  await screen.findByText('navigated away')
  expect(writes(calls)).toEqual([{ call: 'PUT items/it5', body: { ...(api['items/it5'] as object), source: '/media' } }])
})

test('a 422 shows the field error next to the field', async () => {
  mockApi()
  const ok = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => init?.method === 'PUT'
    ? new Response(JSON.stringify({ detail: [{ loc: ['body', 'schedule'], msg: 'Bad cron' }] }), { status: 422 })
    : ok(url, init)))
  renderPage(<ItemEditor />, it5)
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Bad cron')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Custom (cron)' }))
  expect(screen.getByLabelText('Cron expression')).toHaveAttribute('aria-invalid', 'true')
})

test('Delete item needs a hold: a short click does nothing', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const calls = mockApi()
  renderPage(<ItemEditor />, it5)
  const button = await screen.findByRole('button', { name: 'Delete item' })

  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.pointerUp(button)
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(writes(calls)).toEqual([])

  fireEvent.pointerDown(button, { button: 0 })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.pointerUp(button)
  await waitFor(() => expect(writes(calls).map((c) => c.call)).toEqual(['DELETE items/it5']))
  vi.useRealTimers()
})

test('a new item starts with the defaults and has no delete, preview or dry run', async () => {
  const calls = mockApi()
  renderPage(<ItemEditor />, { path: '/items/new', url: '/items/new' })
  expect(await screen.findByRole('heading', { level: 1, name: 'New item' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Every day' })).toBeChecked()
  expect(screen.getByLabelText('At')).toHaveValue('03:00')
  expect(screen.getByLabelText('Target')).toHaveTextContent('usb-stick · USB drive, exFAT')
  expect(screen.queryByRole('button', { name: 'Delete item' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dry run' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('navigated away')
  expect(writes(calls).map((c) => c.call)).toEqual(['POST items'])
})
