'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Folder, ClipboardList, Star, Clock, Trash2, Search, Bell,
  Plus, HardDrive, LogOut, Menu, X, CheckCircle2, Files,
  LayoutDashboard,
} from 'lucide-react'

// Kebijakan: hanya Manager/Admin/GM (SUPERADMIN) yang boleh membuat tugas.
const TASK_CREATORS = ['MANAGER', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']
// Role setara atasan: boleh review & lihat semua berkas.
const MANAGER_LIKE = ['MANAGER', 'ASISTEN', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']

const NAV_BASE = [
  { href: '/file/home', icon: LayoutDashboard, label: 'Beranda' },
]
const NAV_KERANI = [
  { href: '/file/tasks', icon: ClipboardList, label: 'Tugas Saya' },
  { href: '/file/drive?recent=1', icon: Clock, label: 'Terbaru' },
  { href: '/file/drive?starred=1', icon: Star, label: 'Berbintang' },
  { href: '/file/drive', icon: Folder, label: 'Drive Saya' },
  { href: '/file/drive?trashed=1', icon: Trash2, label: 'Sampah' },
]
const NAV_MGR = [
  { href: '/file/manage', icon: Plus, label: 'Buat Tugas' },
  { href: '/file/tasks', icon: ClipboardList, label: 'Tugas' },
  { href: '/file/review', icon: CheckCircle2, label: 'Review Berkas' },
  { href: '/file/files', icon: Files, label: 'Semua Berkas' },
  { href: '/file/drive', icon: Folder, label: 'Drive Saya' },
]

function initials(name?: string) {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || '?'
}

export default function FileShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [q, setQ] = useState('')
  const [notifs, setNotifs] = useState<any[]>([])
  const [showN, setShowN] = useState(false)
  const [quota, setQuota] = useState<{ percent: number; used_bytes: number; cap_bytes: number } | null>(null)

  useEffect(() => {
    fetch('/api/file/tasks', { cache: 'no-store' }).then(async (r) => {
      if (r.status === 401) { router.replace('/file/login'); return }
    }).catch(() => {})
    fetch('/api/file/meta/notifications', { cache: 'no-store' }).then(r => r.json()).then(j => setNotifs(j.data || [])).catch(() => {})
    try { const u = JSON.parse(localStorage.getItem('rjfm-user') || 'null'); setMe(u) } catch {}
    fetch('/api/file/drive?recent=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.quota) setQuota(j.quota) }).catch(() => {})
  }, [path, router])

  const role = (me?.role_code || me?.role || '').toUpperCase()
  const isMgr = MANAGER_LIKE.includes(role)
  const isCreator = TASK_CREATORS.includes(role)
  const nav = [...NAV_BASE, ...(isMgr ? NAV_MGR.filter(n => n.href !== '/file/manage' || isCreator) : NAV_KERANI)]
  const unread = notifs.filter((n: any) => !n.is_read).length

  const logout = async () => {
    await fetch('/api/file/logout', { method: 'POST' })
    localStorage.removeItem('rjfm-user')
    router.replace('/file/login')
  }

  const searchGo = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/file/drive?q=${encodeURIComponent(q)}`)
  }

  const markRead = async (n: any) => {
    if (!n.is_read) {
      setNotifs((list) => list.map((x: any) => x.notification_id === n.notification_id ? { ...x, is_read: true } : x))
      fetch(`/api/file/meta/notifications/${n.notification_id}/read`, { method: 'POST' }).catch(() => {})
    }
    if (n.related_task_id) router.push('/file/tasks')
  }

  const usedGb = quota ? (quota.used_bytes / 1024 ** 3).toFixed(2) : null
  const capGb = quota ? (quota.cap_bytes / 1024 ** 3).toFixed(0) : null

  return (
    <div className="min-h-screen flex text-[#1b2d22]">
      {/* ===== Sidebar hijau perkebunan ===== */}
      <aside className={`fixed z-40 inset-y-0 left-0 w-72 palm-panel text-emerald-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static overflow-hidden`}>
        <div className="relative h-[72px] px-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 grid place-items-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight leading-none">RJ<span className="text-lime-300">Drive</span></p>
            <p className="text-[9px] text-emerald-100/60 mt-1 uppercase tracking-[0.18em]">Rebinmas Jaya Estate</p>
          </div>
          <button className="md:hidden ml-auto text-emerald-100 hover:text-white" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <nav className="relative p-4 space-y-1 flex-1 overflow-auto">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.2em] text-emerald-200/70 uppercase">
            {isMgr ? 'Manajemen' : 'Operasional'}
          </p>
          {nav.map((n) => {
            const on = n.href.includes('?') ? false : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors duration-150 ${on
                  ? 'bg-white text-green-800 font-semibold'
                  : 'text-emerald-50/85 hover:bg-white/8 hover:text-white'}`}>
                <n.icon className={`w-[17px] h-[17px] ${on ? 'text-green-700' : 'text-emerald-200 group-hover:text-white'} transition-colors`} />
                {n.label}
                {on && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />}
              </Link>
            )
          })}
        </nav>

        {quota && (
          <div className="relative px-5 pb-4">
            <div className="rounded-xl bg-black/20 border border-white/10 px-4 py-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-emerald-100 uppercase">
                <span>Penyimpanan</span>
                <span className="text-lime-300">{usedGb} / {capGb} GB</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full bg-lime-400 transition-all duration-700"
                  style={{ width: `${Math.min(quota.percent, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="relative p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/12 border border-white/12 grid place-items-center text-xs font-bold text-lime-100 shrink-0">{initials(me?.full_name || me?.username)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{me?.full_name || me?.username || '—'}</p>
              <p className="text-[10px] text-emerald-100/60 uppercase tracking-wider">{isCreator ? 'Manager' : isMgr ? 'Asisten' : 'Kerani'}</p>
            </div>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-red-500/25 text-emerald-100 hover:text-red-200 transition-colors" title="Keluar"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* ===== Konten ===== */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[72px] sticky top-0 z-30 bg-paper/85 backdrop-blur-xl border-b border-[#1b2d22]/10 flex items-center gap-3 px-4 sm:px-8">
          <button className="md:hidden p-2 rounded-xl hover:bg-green-50" onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
          <form onSubmit={searchGo} className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari berkas di Drive..."
              className="input-field w-full pl-11 pr-4 py-3 rounded-2xl text-sm" />
          </form>
          <div className="relative">
            <button onClick={() => setShowN(s => !s)} className="relative p-3 rounded-2xl hover:bg-green-50 text-green-900 transition-colors">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-extrabold grid place-items-center anim-pop ring-2 ring-white">
                  {unread}
                </span>
              )}
            </button>
            {showN && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowN(false)} />
                <div className="anim-pop absolute right-0 mt-2 w-96 max-h-[420px] overflow-auto card rounded-2xl shadow-2xl shadow-green-900/20 p-2 z-40">
                  <p className="px-3 py-2 text-xs font-extrabold text-green-700 uppercase tracking-widest">Notifikasi</p>
                  {notifs.length === 0 ? <p className="text-sm text-slate-500 p-4">Tidak ada notifikasi</p> : notifs.map((n: any) => (
                    <button key={n.notification_id} onClick={() => markRead(n)}
                      className={`w-full text-left p-3 rounded-2xl text-sm transition-colors ${n.is_read ? 'text-slate-500 hover:bg-green-50/60' : 'bg-green-50 hover:bg-green-100'}`}>
                      <p className="font-bold text-green-950 flex items-center gap-2">{!n.is_read && <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />}{n.title}</p>
                      <p className="text-xs line-clamp-2 mt-1 text-slate-600">{n.message}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
