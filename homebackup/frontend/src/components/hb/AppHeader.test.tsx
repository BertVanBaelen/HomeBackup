import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import i18n from '@/i18n'
import { AppHeader } from './AppHeader'

beforeAll(() => i18n.changeLanguage('en'))

test('section tabs mark the current section and navigate', async () => {
  render(
    <MemoryRouter initialEntries={['/runs/abc']}>
      <AppHeader />
      <Routes>
        <Route path="/targets" element={<p>targets page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
  const tabs = screen.getByRole('tablist', { name: 'HomeBackup sections' })
  expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true') // run pages sit under History
  await userEvent.click(screen.getByRole('tab', { name: 'Targets' }))
  expect(screen.getByText('targets page')).toBeInTheDocument()
  expect(tabs).toBeInTheDocument()
})
