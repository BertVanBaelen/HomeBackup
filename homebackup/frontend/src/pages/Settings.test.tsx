import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { mockApi, renderPage } from '@/test/render'
import { Settings } from './Settings'

beforeAll(() => i18n.changeLanguage('en'))

const page = () => renderPage(<Settings />, { path: '/settings', url: '/settings' })

test('renders the saved values', async () => {
  mockApi()
  page()
  expect(await screen.findByRole('combobox', { name: 'When a run succeeds' })).toHaveTextContent('script.backup_ok')
  expect(screen.getByRole('combobox', { name: 'When a run finishes with a warning' })).toHaveTextContent('script.backup_warn')
  expect(screen.getByRole('combobox', { name: 'When a run fails' })).toHaveTextContent('script.backup_failed')
  expect(screen.getByRole('combobox', { name: 'Log level' })).toHaveTextContent(/\S/)
  expect(screen.getByLabelText(/After/)).toHaveValue(7)
  expect(screen.getByLabelText('Runs per item')).toHaveValue(30)
  expect(screen.getByLabelText('Days')).toHaveValue(90)
  expect(screen.getByRole('tab', { name: 'Automatic' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Europe/Brussels')).toBeInTheDocument()
  expect(await screen.findByText('Valid · 5 items · 3 targets')).toBeInTheDocument()
  expect(await screen.findByText('Generic rsync')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
})

test('saves a changed value', async () => {
  const calls = mockApi()
  page()
  const runs = await screen.findByLabelText('Runs per item')
  await userEvent.clear(runs)
  await userEvent.type(runs, '50')
  await userEvent.click(screen.getByRole('combobox', { name: 'When a run fails' }))
  await userEvent.click(await screen.findByRole('option', { name: 'None' }))
  await userEvent.click(screen.getByRole('tab', { name: 'Nederlands' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  const put = calls.find((c) => c.call === 'PUT settings')
  expect(put?.body).toMatchObject({
    keep_runs: 50, keep_days: 90, hook_success: 'script.backup_ok', hook_failure: null, language: 'nl',
  })
})

test('cancel resets the form', async () => {
  mockApi()
  page()
  const runs = await screen.findByLabelText('Runs per item')
  await userEvent.clear(runs)
  await userEvent.type(runs, '50')
  await userEvent.click(screen.getByRole('tab', { name: 'Nederlands' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(runs).toHaveValue(30)
  expect(screen.getByRole('tab', { name: 'Automatic' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
})

test('refreshes types and checks the config file', async () => {
  const calls = mockApi({ 'POST types/refresh': [], 'POST config/check': {} })
  page()
  await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Check again' }))
  expect(calls.map((c) => c.call)).toEqual(expect.arrayContaining(['POST types/refresh', 'POST config/check']))
})
