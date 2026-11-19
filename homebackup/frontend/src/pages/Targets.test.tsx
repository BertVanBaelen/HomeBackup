import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { mockApi, renderPage } from '@/test/render'
import { Targets } from './Targets'

beforeAll(() => i18n.changeLanguage('en'))

test('lists targets with status and the items that use them', async () => {
  mockApi()
  renderPage(<Targets />, { path: '/targets', url: '/targets' })
  const list = await screen.findByRole('list', { name: 'Targets' })
  const cards = within(list).getAllByRole('article')
  expect(cards).toHaveLength(3)
  expect(within(cards[0]).getByText('USB drive · exFAT')).toBeInTheDocument()
  expect(within(cards[0]).getByText('UUID 3E4F-91AB')).toBeInTheDocument()
  expect(within(cards[0]).getByText('Plugged in · /dev/sda2')).toBeInTheDocument()
  expect(within(cards[1]).getByText('Label HB-ARCHIVE')).toBeInTheDocument()
  expect(within(cards[1]).getByText('Not found. Plug the drive in.')).toBeInTheDocument()
  expect(within(cards[1]).getByText('ha-backups')).toBeInTheDocument()
  expect(within(cards[2]).getByText('Network share · SMB')).toBeInTheDocument()
  expect(within(cards[2]).getByText('//nas.local/backup')).toBeInTheDocument()
  expect(within(cards[2]).getByText(/^Reachable · .* free$/)).toBeInTheDocument()
  expect(within(cards[2]).getByRole('link', { name: 'Edit nas-backup' })).toHaveAttribute('href', '/targets/tg3')
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('editing a used exFAT drive shows its preset and blocks deleting', async () => {
  mockApi()
  renderPage(<Targets />, { path: '/targets/:id', url: '/targets/tg1' })
  expect(await screen.findByRole('heading', { name: 'Edit target usb-stick' })).toBeInTheDocument()
  expect(screen.getByText('Editing')).toBeInTheDocument()
  expect(screen.getByText('exFAT preset')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /rsync flags/ })).toHaveValue('-rt --no-perms --no-owner --no-group --modify-window=2')
  expect(screen.getByText(/keeps times in 2-second steps/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Delete target/ })).toBeDisabled()
  expect(screen.getByText('Used by 2 items. Remove them first.')).toBeInTheDocument()

  // switching the filesystem swaps in that filesystem's preset
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filesystem' }), 'ext4')
  expect(screen.getByRole('textbox', { name: /rsync flags/ })).toHaveValue('-a')
})

test('Test target posts the current form and shows the result', async () => {
  const calls = mockApi()
  renderPage(<Targets />, { path: '/targets/:id', url: '/targets/tg1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Test target' }))
  expect(await screen.findByText(/^Drive found as \/dev\/sda2 · mounts read\/write · .* free$/)).toBeInTheDocument()
  const post = calls.find((c) => c.call === 'POST targets/test')
  expect(post?.body).toMatchObject({ id: 'tg1', kind: 'drive', ident: '3E4F-91AB', min_free_bytes: 10737418240 })
})

test('a new SMB target saves with its password and the SMB preset', async () => {
  const calls = mockApi()
  renderPage(<Targets />, { path: '/targets/:id', url: '/targets/new' })
  expect(await screen.findByRole('heading', { name: 'New target' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Delete target/ })).not.toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'nas2')
  await userEvent.click(screen.getByRole('button', { name: 'Network share' }))
  expect(screen.getByRole('button', { name: 'Network share' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.type(screen.getByRole('textbox', { name: 'Host' }), 'nas.local')
  await userEvent.type(screen.getByRole('textbox', { name: 'Share' }), 'media')
  await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'hb')
  await userEvent.type(screen.getByLabelText('Password'), 's3cret')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('navigated away')).toBeInTheDocument()
  const post = calls.find((c) => c.call === 'POST targets')
  expect(post?.body).toMatchObject({
    id: '', name: 'nas2', kind: 'share', protocol: 'smb', host: 'nas.local', share: 'media', username: 'hb',
    password: 's3cret', rsync_flags: '-rt --no-perms --no-owner --no-group', filesystem: null, ident: null,
  })
})
