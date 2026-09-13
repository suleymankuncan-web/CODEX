import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { AdminSurfaceHeader } from './admin-surface-primitives'
import './admin-azure-header.css'

/** Opt-in Azure header; the shared surface contract and other admin pages stay intact. */
export function AdminAzureHeader(props: ComponentProps<typeof AdminSurfaceHeader>) {
  return <AdminSurfaceHeader {...props} className={cn('admin-azure-header', props.className)} />
}
