import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F6F8FB' }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-slate-500 text-sm mb-6">
          Halaman yang Anda cari tidak tersedia. Mungkin sudah dipindahkan atau dihapus.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors hover:opacity-90"
          style={{ backgroundColor: '#167A3A' }}
        >
          <Home className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
