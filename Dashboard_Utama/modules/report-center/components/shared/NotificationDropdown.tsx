'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, X, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Notification {
  id: string
  type: 'new_report' | 'data_sync' | 'export_complete' | 'system_alert'
  title: string
  message: string
  time: string
  read: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'new_report',
    title: 'Laporan Baru',
    message: 'Rekap Penggajian Mei 2026 siap dilihat',
    time: '5 menit lalu',
    read: false,
  },
  {
    id: '2',
    type: 'export_complete',
    title: 'Export Selesai',
    message: 'Stok Persediaan per Gudang berhasil di-export',
    time: '15 menit lalu',
    read: false,
  },
  {
    id: '3',
    type: 'data_sync',
    title: 'Data Sync',
    message: 'Sinkronisasi DB HRIS selesai — 1.247 record',
    time: '1 jam lalu',
    read: true,
  },
  {
    id: '4',
    type: 'system_alert',
    title: 'System Alert',
    message: 'Maintenance terjadwal: 18 Mei 2026, 02:00-04:00',
    time: '2 jam lalu',
    read: true,
  },
  {
    id: '5',
    type: 'new_report',
    title: 'Laporan Baru',
    message: 'Daftar Kehadiran Harian siap dicetak',
    time: '3 jam lalu',
    read: true,
  },
]

const typeConfig = {
  new_report: { icon: FileText, color: 'text-emerald-600 bg-emerald-50', label: 'Laporan' },
  data_sync: { icon: RefreshCw, color: 'text-blue-600 bg-blue-50', label: 'Sync' },
  export_complete: { icon: Check, color: 'text-violet-600 bg-violet-50', label: 'Export' },
  system_alert: { icon: AlertCircle, color: 'text-amber-600 bg-amber-50', label: 'Alert' },
} as const

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function markAllRead() {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167A3A] focus-visible:ring-offset-2'
        )}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#167A3A] text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-950">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#167A3A] hover:text-[#126531] font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto py-1">
            {notifications.map(notif => {
              const cfg = typeConfig[notif.type]
              const Icon = cfg.icon
              return (
                <button
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    'hover:bg-slate-50',
                    !notif.read && 'bg-emerald-50/40'
                  )}
                >
                  <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm font-medium text-slate-950', !notif.read && 'font-semibold')}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#167A3A]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{notif.time}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <button className="w-full text-center text-xs font-medium text-slate-500 hover:text-[#167A3A] transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
