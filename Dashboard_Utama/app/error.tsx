'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F6F8FB' }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Terjadi Kesalahan</h1>
        <p className="text-slate-500 text-sm mb-6">
          Maaf, terjadi kesalahan yang tidak terduga. Tim kami sudah diberitahu.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors hover:opacity-90"
          style={{ backgroundColor: '#167A3A' }}
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
