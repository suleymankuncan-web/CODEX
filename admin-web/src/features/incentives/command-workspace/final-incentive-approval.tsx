import { canApproveIncentives } from './final-incentive-approval-permission'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuthSessionSummary } from '@/features/auth/api'
import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '@/lib/openapi-client'
import { actionToast } from '@/lib/action-toast'
import type { AppLocale } from '@/lib/i18n'
import { transientQueryRetryOptions } from '@/lib/query-retry'

type Package = ApiGetResponse<'/api/store/incentives/final-approval'>['items'][number]

export function FinalIncentiveApproval(input: { authSummary?: AuthSessionSummary | null; period: string; locale: AppLocale; disabled?: boolean; regionIds?: string[] | undefined }) {
  const enabled = canApproveIncentives(input.authSummary)
  const tr = input.locale === 'tr'
  const client = useQueryClient()
  const [selected, setSelected] = useState<Package | null>(null)
  const query = useQuery({
    queryKey: ['incentive-final-approval', input.authSummary?.user.userId, input.authSummary?.user.authorizationContextVersion, input.period],
    queryFn: () => fetchOpenApiJson('/api/store/incentives/final-approval', { query: new URLSearchParams({ period: input.period }) }),
    enabled,
    ...transientQueryRetryOptions,
  })
  const mutation = useMutation({
    mutationFn: (item: Package) => sendOpenApiJson('/api/store/incentives/final-approval', {
      method: 'POST', body: { period: input.period, regionId: item.regionId, regionPackageId: item.regionPackageId!, submittedAt: item.submittedAt! },
    }),
    onSuccess: async () => {
      setSelected(null)
      actionToast.success(tr ? 'Prim paketi final onayı verildi.' : 'Final incentive approval recorded.')
      await client.invalidateQueries({ predicate: (entry) => entry.queryKey.some((key) => typeof key === 'string' && key.includes('incentive')) })
    },
    onError: async (error) => {
      setSelected(null)
      actionToast.error(error, tr ? 'Onay verilemedi. Güncel paketi ve yetkinizi kontrol edin.' : 'Approval failed. Check the current package and your permission.')
      await query.refetch()
    },
  })
  if (!enabled) return null
  const canConfirm = !input.disabled && !query.isFetching && !query.isError && !mutation.isPending
  const items = (query.data?.items ?? []).filter(item => !input.regionIds || input.regionIds.includes(item.regionId))
  return <>
    <Card>
      <CardHeader>
        <CardTitle>{tr ? 'Prim Onayı' : 'Final incentive approval'}</CardTitle>
        <CardDescription>{tr ? 'Bölge müdürlerinin gönderdiği prim paketlerini inceleyip final onay verin.' : 'Review the packages submitted by regional managers and give final approval.'}</CardDescription>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-col tw:gap-3">
        {query.isPending ? <Skeleton className="tw:h-16 tw:w-full" /> : query.isError ? <div role="alert"><p>{tr ? 'Onay paketleri alınamadı veya yetkiniz kaldırıldı.' : 'Could not load approval packages, or your permission was revoked.'}</p><Button variant="outline" onClick={() => void query.refetch()}>{tr ? 'Yeniden dene' : 'Retry'}</Button></div> : items.length === 0 ? <p>{tr ? 'Bu dönem için prim paketi bulunamadı.' : 'No incentive packages for this period.'}</p> : items.map((item) => (
          <div key={item.regionId} className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-border tw:py-3">
            <div><p className="tw:m-0 tw:font-semibold">{item.regionName ?? (tr ? 'Bölge' : 'Region')}</p><p className="tw:my-1 tw:text-sm tw:text-muted-foreground">{item.submittedByName ?? item.regionManagerName} · {item.submittedStoreCount}/{item.storeCount} {tr ? 'mağaza' : 'stores'}</p></div>
            {item.status === 'submitted' && item.regionPackageId && item.submittedAt && item.submittedByUserId !== input.authSummary?.user.userId ? <Button disabled={!canConfirm} onClick={() => setSelected(item)}><ShieldCheck aria-hidden="true" data-icon="inline-start" />{tr ? 'Final onay ver' : 'Give final approval'}</Button> : <Badge variant="secondary">{item.status === 'admin_approved' ? (tr ? 'Final onaylandı' : 'Approved') : item.status === 'admin_returned' ? (tr ? 'Bölgeye iade edildi' : 'Returned') : item.status === 'submitted' ? (tr ? 'Başka bir yetkili onaylamalı' : 'Another approver is required') : (tr ? 'Bölge onayı bekleniyor' : 'Awaiting regional submission')}</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !mutation.isPending) setSelected(null) }}>
      <DialogContent closeLabel={tr ? 'Kapat' : 'Close'}>
        <DialogHeader><DialogTitle>{tr ? 'Prim final onayı' : 'Final incentive approval'}</DialogTitle><DialogDescription>{selected?.regionName} · {input.period}. {tr ? 'Bu bölgenin gönderilen prim paketini onaylayacaksınız. Onaydan sonra bölge müdürü bu paketi değiştiremez.' : 'You are approving this region’s submitted incentive package. The regional manager cannot edit the approved package.'}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setSelected(null)}>{tr ? 'Vazgeç' : 'Cancel'}</Button><Button disabled={!selected || !canConfirm} onClick={() => selected && mutation.mutate(selected)}>{mutation.isPending ? (tr ? 'Onaylanıyor' : 'Approving') : (tr ? 'Final onayı ver' : 'Confirm final approval')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
