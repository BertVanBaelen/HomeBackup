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

  const filters = screen.getByRole('group', { name: 'Filter by result' })
  expect(within(filters).getByRole('button', { name: 'All 71' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(filters).getByRole('button', { name: /^Failed/ }))
  expect(within(filters).getByRole('button', { name: /^Failed/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByText('Showing 2 of 2 runs')).toBeInTheDocument()
  expect(screen.getAllByText('Drive usb-archive (label HB-ARCHIVE) not found').length).toBeGreaterThan(0)
})
