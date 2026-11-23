// Format detik → "m:ss" (durasi audio).
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ISO date → "Baru saja", "3 jam lalu", "Kemarin", "5 hari lalu", "2 bulan lalu".
export function formatRelativeTime(dateIso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(dateIso).getTime();
  if (Number.isNaN(diffMs)) return 'Beberapa hari lalu';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays <= 0) {
    if (diffHours <= 0) return 'Baru saja';
    return `${diffHours} jam lalu`;
  }
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return `${Math.floor(diffDays / 30)} bulan lalu`;
}
