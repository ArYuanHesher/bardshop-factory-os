'use client'

import Link from 'next/link'
import { NavButton } from '../../../components/NavButton'

const CARDS = [
  {
    href: '/qa/options/personnel',
    title: '人員名單',
    desc: '管理回報人、處理人與缺失人員，並可綁定所屬部門。',
    label: 'MANAGE PERSONNEL →',
    hover: 'hover:border-cyan-500 hover:bg-slate-800/60',
    iconBg: 'group-hover:bg-cyan-900/40 group-hover:text-cyan-300',
    labelColor: 'text-cyan-400',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/qa/options/category',
    title: '異常分類',
    desc: '管理異常回報單中可選擇的分類選項清單。',
    label: 'MANAGE CATEGORIES →',
    hover: 'hover:border-amber-500 hover:bg-slate-800/60',
    iconBg: 'group-hover:bg-amber-900/40 group-hover:text-amber-300',
    labelColor: 'text-amber-400',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    href: '/qa/options/department',
    title: '部門選單',
    desc: '管理回報部門與處理部門的下拉清單。',
    label: 'MANAGE DEPARTMENTS →',
    hover: 'hover:border-indigo-500 hover:bg-slate-800/60',
    iconBg: 'group-hover:bg-indigo-900/40 group-hover:text-indigo-300',
    labelColor: 'text-indigo-400',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/qa/options/disposition',
    title: '缺失處置',
    desc: '管理異常單中缺失處置方式的下拉選項。',
    label: 'MANAGE DISPOSITION →',
    hover: 'hover:border-rose-500 hover:bg-slate-800/60',
    iconBg: 'group-hover:bg-rose-900/40 group-hover:text-rose-300',
    labelColor: 'text-rose-400',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function OptionsHubPage() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto min-h-screen space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">下拉選項管理</h1>
          <p className="text-fuchsia-400 mt-1 font-mono text-sm uppercase">QA DROPDOWN OPTION MANAGER</p>
        </div>
        <NavButton href="/qa" direction="back" title="返回品保專區" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group rounded-2xl border border-slate-700 bg-slate-900/50 p-6 ${card.hover} transition-all`}
          >
            <div className={`mb-4 inline-flex p-3 rounded-full bg-slate-800 text-slate-300 transition-colors ${card.iconBg}`}>
              {card.icon}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{card.title}</h2>
            <p className="text-slate-400 text-sm">{card.desc}</p>
            <p className={`text-xs ${card.labelColor} font-mono mt-4`}>{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
