import type { TranslateFunction } from '../features/localization/dictionary'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { OperatorAction } from './operations-operator-action-model'
import {
  OperationsPanel,
  OperationsStatusBadge,
} from './operations-surface-primitives'

export function OperatorActionListPanel(input: {
  actions: OperatorAction[]
  t: TranslateFunction
}) {
  return (
    <OperationsPanel
      title={input.t('adminOperations.actionTitle')}
      testId="operations-action-list"
      badge={
        <OperationsStatusBadge tone={input.actions.length > 0 ? 'warning' : 'calm'}>
          {input.t('adminOperations.actionCount', { count: input.actions.length })}
        </OperationsStatusBadge>
      }
    >
      <Table className="operations-action-table">
        <TableHeader>
          <TableRow>
            <TableHead>{input.t('adminOperations.actionColumn')}</TableHead>
            <TableHead>{input.t('adminOperations.statusReasonColumn')}</TableHead>
            <TableHead><span className="tw:sr-only">{input.t('adminOperations.openActionDetail')}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {input.actions.map((action) => (
            <TableRow key={action.id}>
              <TableCell>
                <div className="operations-action-title">{action.title}</div>
                <div className="operations-action-meta">{action.subtitle}</div>
              </TableCell>
              <TableCell>
                <OperationsStatusBadge tone={action.tone}>{action.status}</OperationsStatusBadge>
                <p className="operations-action-meta">{action.reason}</p>
              </TableCell>
              <TableCell>
                {action.href ? (
                  <Button asChild size="icon-sm" variant="ghost" aria-label={`${action.title}: ${input.t('adminOperations.openActionDetail')}`}>
                    <Link to={action.href}><ArrowUpRight aria-hidden="true" /></Link>
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </OperationsPanel>
  )
}
