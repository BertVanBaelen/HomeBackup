import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RunWithLog } from '@/api/client'
import i18n from '@/i18n'
import { api, mockApi, renderPage } from '@/test/render'
import { RunDetail } from './RunDetail'

beforeAll(() => i18n.changeLanguage('en'))

const manualId = api._manual_run_id as string
const manual = api[`runs/${manualId}`] as RunWithLog
const at = (id: string) => renderPage(<RunDetail />, { path: '/runs/:id', url: `/runs/${id}` })

test('a finished manual run shows its result, steps, command and log', async () => {
  mockApi()
  at(manualId)
  expect(await screen.findByRole('heading', { name: 'ha-config' })).toBeInTheDocument()
  expect(screen.getAllByText('Success').length).toBeGreaterThan(0)
  const steps = screen.getByRole('list', { name: 'Steps that ran' })
  expect(within(steps).getAllByRole('listitem')).toHaveLength(4)
  for (const title of ['Mount the target', 'Check free space', 'Copy the source', 'Unmount the target']) {
    expect(within(steps).getByText(title)).toBeInTheDocument()
  }
  const copy = within(steps).getByRole('button', { name: /Copy the source/ })
  expect(copy).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(copy)
  expect(copy).toHaveAttribute('aria-expanded', 'true')
  expect(within(steps).getByText(/^rsync -rt .* \/homeassistant\/ \S*\/tg3\/homeassistant\/$/)).toBeVisible()

  const log = screen.getByRole('region', { name: 'Log lines' })
  expect(within(log).getAllByText('Result: success').length).toBeGreaterThan(0)
  expect(within(log).getAllByText(/^umount /).length).toBeGreaterThan(0)
})

test('log search filters lines and the level filters count them', async () => {
  const log = [...manual.log, { t: manual.log[0].t, level: 'WARN' as const, msg: 'file has vanished: "a.jpg"' },
    { t: manual.log[0].t, level: 'WARN' as const, msg: 'file has vanished: "b.jpg"' }]
  mockApi({ [`runs/${manualId}`]: { ...manual, log } })
  at(manualId)
  const filters = await screen.findByRole('group', { name: 'Filter the log' })
  expect(within(filters).getByRole('button', { name: `All ${log.length}` })).toHaveAttribute('aria-pressed', 'true')
  const warnings = within(filters).getByRole('button', { name: 'Warnings 2' })
  expect(within(filters).getByRole('button', { name: 'Errors 0' })).toBeInTheDocument()

  const region = screen.getByRole('region', { name: 'Log lines' })
  await userEvent.click(warnings)
  expect(warnings).toHaveAttribute('aria-pressed', 'true')
  expect(within(region).getAllByText(/vanished/)).toHaveLength(2)
  expect(within(region).queryByText('Result: success')).not.toBeInTheDocument()

  await userEvent.click(within(filters).getByRole('button', { name: /^All/ }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search the log' }), 'deleted files')
  expect(within(region).getAllByText('Number of deleted files: 0')).toHaveLength(1)
  expect(within(region).queryByText('Avail')).not.toBeInTheDocument()
})

test('a seeded failure explains why and says no steps were kept', async () => {
  mockApi()
  at('it1-202611080400')
  expect(await screen.findByText('Why it failed')).toBeInTheDocument()
  expect(screen.getByText('Drive usb-archive (label HB-ARCHIVE) not found')).toBeInTheDocument()
  expect(screen.getByText('No step details were kept for this run.')).toBeInTheDocument()
  expect(screen.getByText('No log was kept for this run.')).toBeInTheDocument()
})

test('a running run shows progress and a hold-to-cancel button', async () => {
  mockApi()
  at(api._running_run_id as string)
  expect(await screen.findByRole('button', { name: /Cancel/ })).toBeInTheDocument()
  expect(await screen.findByRole('progressbar', { name: 'Progress of this run' })).toHaveAttribute('aria-valuenow', '5')
})

test('an unknown run says so and links back to History', async () => {
  mockApi()
  at('nope')
  expect(await screen.findByText('This run does not exist (anymore)')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to History' })).toHaveAttribute('href', '/history')
})
