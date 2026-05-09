import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function NavItem(input: {
  to: string
  icon: LucideIcon
  label: string
}) {
  const Icon = input.icon

  return (
    <NavLink
      to={input.to}
      className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
    >
      <Icon size={18} />
      <span>{input.label}</span>
    </NavLink>
  )
}
