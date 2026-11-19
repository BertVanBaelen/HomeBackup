import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { mockApi, renderPage } from '@/test/render'
import { History } from './History'

beforeAll(() => i18n.changeLanguage('en'))

test('lists runs with retention note and filters by result', async () => {
  mockApi()
  renderPage(<History />)
  expect(await screen.findByText(/Keeping the last 30 runs of each item for 90 days\./)).toBeInTheDocument()
  expect(await screen.findByText('Showing 12 of 71 runs')).toBeInTheDocument()

  const filters = screen.getByRole('tablist', { name: 'Filter by result' })
  expect(within(filters).getByRole('tab', { name: 'All 71' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(within(filters).getByRole('tab', { name: /^Failed/ }))
  expect(within(filters).getByRole('tab', { name: /^Failed/ })).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByText('Showing 2 of 2 runs')).toBeInTheDocument()
  expect(screen.getAllByText('Drive usb-archive (label HB-ARCHIVE) not found').length).toBeGreaterThan(0)
})

test('filters by item', async () => {
  mockApi()
  renderPage(<History />)
  const item = await screen.findByRole('combobox', { name: 'Item' })
  expect(item).toHaveTextContent('All items')
  await userEvent.click(item)
  await userEvent.click(await screen.findByRole('option', { name: 'ha-config' }))
  expect(item).toHaveTextContent('ha-config')
  await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.map(([u]) => String(u))).toContain('api/v1/runs?item_id=it5&limit=12'))
})
