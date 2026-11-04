// Rate limit sliding window di memori. Cukup untuk satu instance server; kalau nanti diskalakan
// horizontal, ganti implementasinya dengan Redis tanpa mengubah pemanggil.
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Detik sampai key boleh dipakai lagi; 0 jika masih di bawah limit. */
  retryAfterSec(key: string): number {
    const recent = this.prune(key);
    if (recent.length < this.limit) return 0;
    return Math.max(1, Math.ceil((recent[0] + this.windowMs - this.now()) / 1000));
  }

  hit(key: string): void {
    const recent = this.prune(key);
    recent.push(this.now());
    this.hits.set(key, recent);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(key: string): number[] {
    const since = this.now() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length) this.hits.set(key, recent);
    else this.hits.delete(key);
    return recent;
  }
}
