import { act, fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { api, mockApi, renderPage } from '@/test/render'
import { Dashboard } from './Dashboard'

beforeAll(() => i18n.changeLanguage('en'))

test('shows the running card, the overdue item and every backup item as designed', async () => {
  mockApi()
  renderPage(<Dashboard />)
  const running = await screen.findByRole('region', { name: 'Running now' })
  expect(within(running).getByRole('heading', { name: 'music-to-nas' })).toBeInTheDocument()
  expect(within(running).getByText('/media/music → nas-backup/music')).toBeInTheDocument()
  expect(within(running).getByRole('progressbar', { name: 'Progress of music-to-nas' })).toHaveAttribute(
    'aria-valuenow', String(Math.floor((api.status as { running: { percent: number }[] }).running[0].percent)))

  const attention = screen.getByRole('region', { name: 'Needs attention' })
  expect(within(attention).getByText('No successful run for 16 days')).toBeInTheDocument()
  expect(within(attention).getByText(/Sun 8 Nov, 04:00 · Drive usb-archive \(label HB-ARCHIVE\) not found\./)).toBeInTheDocument()

  for (const name of ['ha-backups', 'immich-full-monthly', 'immich-recent', 'ha-config']) {
    expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
  }
  expect(screen.getAllByRole('img', { name: 'Last 14 runs: 12 succeeded, 2 failed' }).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Sundays at 04:00').length).toBeGreaterThan(0)
  expect(screen.getAllByText('mirror · deletes').length).toBeGreaterThan(0)
})

test('Run now needs a hold: a short click does nothing, a full hold starts the run', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const calls = mockApi()
  renderPage(<Dashboard />)
  const [button] = await screen.findAllByRole('button', { name: 'Run ha-config now' })

  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.pointerUp(button)
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(calls.map((c) => c.call)).toEqual([])

  fireEvent.pointerDown(button, { button: 0 })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.pointerUp(button)
  await act(() => vi.advanceTimersByTimeAsync(50))
  expect(calls.map((c) => c.call)).toEqual(['POST items/it5/run'])
  vi.useRealTimers()
})
