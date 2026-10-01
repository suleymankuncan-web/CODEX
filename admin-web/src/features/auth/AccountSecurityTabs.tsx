import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, KeyRound, Mail, RefreshCw, Shield } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useLocalization } from '../localization/useLocalization'
import { actionToast } from '../../lib/action-toast'
import { accountTimestamp, linkState } from './account-security-format'
import { getAccountSecurity, requestPasswordLink } from './account-security-api'
import type { UserAccount } from './api'

export function AccountSecurityTabs({ user, children }: { user: UserAccount; children: ReactNode }) {
  const { locale } = useLocalization()
  const english = locale === 'en'
  return <Tabs defaultValue="access" className="tw:gap-0">
    <TabsList aria-label={english ? 'User account sections' : 'Kullanıcı hesap alanları'} className="tw:gap-4">
      <TabsTrigger value="access"><Shield className="tw:size-4" aria-hidden="true" />{english ? 'Access' : 'Erişim'}</TabsTrigger>
      <TabsTrigger value="security"><KeyRound className="tw:size-4" aria-hidden="true" />{english ? 'Account & security' : 'Hesap ve güvenlik'}</TabsTrigger>
    </TabsList>
    <TabsContent value="access">{children}</TabsContent>
    <TabsContent value="security"><AccountSecurityPanel user={user} /></TabsContent>
  </Tabs>
}

function AccountSecurityPanel({ user }: { user: UserAccount }) {
  const { locale } = useLocalization()
  const english = locale === 'en'
  const client = useQueryClient()
  const [openedAt] = useState(() => Date.now())
  const retryRequest = useRef<{ requestId: string; kind: 'setup' | 'reset' } | null>(null)
  const key = ['auth-management', 'security', user.userId]
  const query = useQuery({ queryKey: key, queryFn: () => getAccountSecurity(user.userId),
    refetchOnWindowFocus: false,
    refetchInterval: (current) => Date.now() - openedAt < 120_000 &&
      current.state.data?.requests.some(request => ['queued', 'sending', 'sent', 'unconfirmed'].includes(request.state)) ? 15_000 : false })
  const mutation = useMutation({
    mutationFn: ({ kind, requestId }: { kind: 'setup' | 'reset'; requestId: string }) => requestPasswordLink(user.userId, kind, requestId),
    onSuccess: async () => {
      retryRequest.current = null
      await client.invalidateQueries({ queryKey: key })
      actionToast.success(english ? 'Link request queued.' : 'Bağlantı isteği kuyruğa alındı.')
    },
    onError: () => actionToast.error(null, english ? 'Request could not be confirmed. Retry or refresh.' : 'İstek doğrulanamadı. Yeniden deneyin veya yenileyin.'),
  })
  const latest = query.data?.requests[0]
  const processing = latest && ['queued', 'sending'].includes(latest.state)
  const kind = query.data?.passwordState === 'absent' ? 'setup' : 'reset'
  const send = () => {
    retryRequest.current ??= { requestId: crypto.randomUUID(), kind }
    mutation.mutate(retryRequest.current)
  }
  return <div className="tw:space-y-5 tw:p-4 tw:sm:p-6">
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
      <div><h3 className="tw:m-0 tw:text-base tw:font-semibold">{english ? 'Password and sign-in' : 'Şifre ve oturum'}</h3><p className="tw:mt-1 tw:mb-0 tw:text-sm tw:text-muted-foreground">{english ? 'Verified account information and link history.' : 'Doğrulanmış hesap bilgisi ve bağlantı geçmişi.'}</p></div>
      <Button className="tw:min-h-11" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw aria-hidden="true" />{english ? 'Refresh' : 'Yenile'}</Button>
    </div>
    {query.isPending ? <p role="status">{english ? 'Loading account information…' : 'Hesap bilgileri yükleniyor…'}</p> : null}
    {query.isError ? <p role="alert" className="tw:text-sm tw:text-destructive">{english ? 'Account information could not be updated. Refresh to retry.' : 'Hesap bilgileri güncellenemedi. Yenileyerek tekrar deneyin.'}</p> : null}
    {query.data ? <>
      <dl className="tw:m-0 tw:grid tw:gap-3 tw:sm:grid-cols-2">
        <AccountFact label={english ? 'Password' : 'Şifre'} value={query.data.passwordState === 'present' ? (english ? 'Password exists' : 'Şifre mevcut') : query.data.passwordState === 'absent' ? (english ? 'Password not created' : 'Şifre oluşturulmamış') : (english ? 'Not verified yet' : 'Henüz doğrulanmadı')} />
        <AccountFact label={english ? 'Last verified password change' : 'Doğrulanan son şifre değişimi'} value={accountTimestamp(query.data.passwordSetAt, english)} />
        <AccountFact label={english ? 'Last sign-in' : 'Son giriş'} value={accountTimestamp(query.data.lastLoginAt, english)} />
        <AccountFact label={english ? 'Last active' : 'Son aktif'} value={accountTimestamp(query.data.lastActiveAt, english)} />
      </dl>
      <p className="tw:m-0 tw:text-xs tw:text-muted-foreground">{english ? 'Last verified' : 'Son doğrulama'}: {accountTimestamp(query.data.observedAt, english)} · Europe/Istanbul</p>
      <div className="tw:rounded-xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3"><p className="tw:m-0 tw:text-sm tw:font-medium">{english ? 'Send a password link by email' : 'E-postayla şifre bağlantısı gönder'}</p>
          <Button className="tw:min-h-11" onClick={send} disabled={!user.isActive || user.authProvider !== 'oidc' || !user.providerSubject || query.isError || mutation.isPending || Boolean(processing)}><Mail aria-hidden="true" />{mutation.isPending || processing ? (english ? 'Processing' : 'İşleniyor') : mutation.isError ? (english ? 'Retry request' : 'İsteği yeniden dene') : latest ? (english ? 'Send again' : 'Tekrar gönder') : (english ? 'Send link' : 'Bağlantı gönder')}</Button>
        </div>
        <p className="tw:mt-2 tw:mb-0 tw:text-xs tw:leading-5 tw:text-muted-foreground">{english ? 'Sent means the email service accepted the request. A verified password change is shown separately; it does not prove which link was clicked.' : 'Gönderildi, e-posta servisinin isteği kabul ettiği anlamına gelir. Doğrulanan şifre değişimi ayrıca gösterilir; hangi bağlantıya tıklandığını kanıtlamaz.'}</p>
      </div>
      <section aria-label={english ? 'Password link history' : 'Şifre bağlantı geçmişi'}>
        <h4 className="tw:mb-3 tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold"><Clock3 className="tw:size-4" aria-hidden="true" />{english ? 'Recent link requests' : 'Son bağlantı istekleri'}</h4>
        {!query.data.requests.length ? <p className="tw:text-sm tw:text-muted-foreground">{english ? 'No link request recorded.' : 'Kayıtlı bağlantı isteği yok.'}</p> : <ol className="tw:m-0 tw:max-h-80 tw:list-none tw:space-y-3 tw:overflow-y-auto tw:p-0">
          {query.data.requests.map(request => <li key={request.requestId} className="tw:rounded-xl tw:border tw:border-border tw:p-3">
            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"><span className="tw:text-sm tw:font-medium">{request.kind === 'setup' ? (english ? 'Account setup' : 'Hesap kurulumu') : (english ? 'Password reset' : 'Şifre yenileme')}</span><Badge variant="outline">{linkState(request.state, english)}</Badge></div>
            <dl className="tw:mt-3 tw:mb-0 tw:grid tw:gap-2 tw:text-xs tw:sm:grid-cols-2">
              <AccountFact label={english ? 'Requested' : 'İstek zamanı'} value={accountTimestamp(request.requestedAt, english)} />
              {request.sentAt ? <AccountFact label={english ? 'Sent' : 'Gönderildi'} value={accountTimestamp(request.sentAt, english)} /> : null}
              {request.expiresAt ? <AccountFact label={english ? 'Tracking window ends' : 'Takip süresi sonu'} value={accountTimestamp(request.expiresAt, english)} /> : null}
              {request.verifiedPasswordSetAt ? <AccountFact label={english ? 'Verified password change' : 'Doğrulanan şifre değişimi'} value={accountTimestamp(request.verifiedPasswordSetAt, english)} /> : null}
            </dl>
          </li>)}
        </ol>}
      </section>
    </> : null}
  </div>
}

function AccountFact({ label, value }: { label: string; value: string }) {
  return <div className="tw:min-w-0"><dt className="tw:text-xs tw:text-muted-foreground">{label}</dt><dd className="tw:mt-1 tw:ml-0 tw:break-words tw:text-sm tw:font-medium">{value}</dd></div>
}
