'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Folder, ClipboardList, Star, Clock, Trash2, Search, Bell,
  Plus, HardDrive, LogOut, Menu, X, CheckCircle2, Files,
  LayoutDashboard, ChevronRight,
} from 'lucide-react'

const NAV_KERANI = [
  { href: '/file/home', icon: LayoutDashboard, label: 'Beranda' },
  { href: '/file/tasks', icon: ClipboardList, label: 'Tugas Saya' },
  { href: '/file/drive', icon: Folder, label: 'Drive Saya' },
  { href: '/file/drive?recent=1', icon: Clock, label: 'Terbaru' },
  { href: '/file/drive?starred=1', icon: Star, label: 'Berbintang' },
  { href: '/file/drive?trashed=1', icon: Trash2, label: 'Sampah' },
]
const NAV_MGR = [
  { href: '/file/home', icon: LayoutDashboard, label: 'Beranda' },
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
  const isMgr = ['MANAGER', 'ASISTEN', 'SUPERADMIN'].includes(role)
  const nav = isMgr ? NAV_MGR : NAV_KERANI
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
    if (n.related_task_id) router.push(`/file/tasks`)
  }

  const usedGb = quota ? (quota.used_bytes / 1024 ** 3).toFixed(2) : null
  const capGb = quota ? (quota.cap_bytes / 1024 ** 3).toFixed(0) : null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <aside className={`fixed z-30 inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="h-16 px-4 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-900 grid place-items-center shadow-lg shadow-emerald-500/20"><HardDrive className="w-4.5 h-4.5" /></div>
          <div>
            <p className="text-sm font-bold text-white leading-none">RJ Drive</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Instruksi Kerja &amp; Berkas</p>
          </div>
          <button className="md:hidden ml-auto text-slate-400" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-auto">
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">{isMgr ? 'Atasan / Manager' : 'Menu Kerani'}</p>
          {nav.map((n) => {
            const on = n.href.includes('?') ? false : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${on ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                <n.icon className="w-4 h-4" /> {n.label}
                {on && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {quota && (
          <div className="px-4 pb-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Penyimpanan</span>
                <span>{usedGb} / {capGb} GB</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${Math.min(quota.percent, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 grid place-items-center text-xs font-bold text-slate-900">{initials(me?.full_name || me?.username)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{me?.full_name || me?.username || '—'}</p>
              <p className="text-[10px] text-slate-400">{isMgr ? 'Atasan · Manager' : 'Kerani · Pekerja'}{me?.divisi ? ` · ${me.divisi}` : ''}</p>
            </div>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" title="Keluar"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-20 flex items-center gap-3 px-3 sm:px-6">
          <button className="md:hidden p-2" onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
          <form onSubmit={searchGo} className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari berkas di Drive..." className="w-full pl-9 pr-3 py-2.5 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-emerald-200 focus:ring-2 focus:ring-emerald-100 text-sm outline-none transition" />
          </form>
          <div className="relative">
            <button onClick={() => setShowN(s => !s)} className="relative p-2.5 rounded-full hover:bg-slate-100 text-slate-600">
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">{unread}</span>}
            </button>
            {showN && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowN(false)} />
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-40">
                  <p className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notifikasi</p>
                  {notifs.length === 0 ? <p className="text-sm text-slate-500 p-3">Tidak ada notifikasi</p> : notifs.map((n: any) => (
                    <button key={n.notification_id} onClick={() => markRead(n)} className={`w-full text-left p-2.5 rounded-xl text-sm ${n.is_read ? 'text-slate-500 hover:bg-slate-50' : 'bg-emerald-50/70 hover:bg-emerald-50'}`}>
                      <p className="font-medium text-slate-900 flex items-center gap-1.5">{!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}{n.title}</p>
                      <p className="text-xs line-clamp-2 mt-0.5">{n.message}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
