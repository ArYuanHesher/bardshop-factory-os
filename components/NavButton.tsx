'use client'

import Link from 'next/link'

type NavButtonProps = {
  href?: string
  onClick?: () => void
  direction?: 'home' | 'back'
  title: string
  className?: string
}

export function NavButton({ href, onClick, direction = 'home', title, className = '' }: NavButtonProps) {
  const base = 'inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold border border-slate-700 text-slate-300 bg-slate-900/70 hover:bg-slate-800 hover:border-cyan-500 hover:text-white transition-all shadow-sm'
  const icon = direction === 'home'
    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" /></svg>
    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>

  const content = (
    <span className={`${base} ${className}`} onClick={onClick}>
      {direction === 'back' ? icon : icon}
      {title}
    </span>
  )

  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`}>
        {icon}
        {title}
      </Link>
    )
  }

  return content
}
