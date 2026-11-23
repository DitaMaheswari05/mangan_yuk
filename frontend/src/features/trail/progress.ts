// F08 / PB-15 – Progres trail yang sedang berjalan. Fungsi murni; penyimpanan ada di session.ts.

import type { LatLng } from '@/lib/geo';
import type { Poi, TasteTag } from '@/types/content';
import { checkDwellAlert, planTrail, type TrailPlanResult, type TrailStep } from './planner';

export type TrailStepStatus = 'pending' | 'done' | 'skipped';

type SkipUndo = {
  poiId: string;
  steps: TrailStep[];
  status: Record<string, TrailStepStatus>;
};

export type TrailSession = {
  startedAt: number;
  durationMin: number;
  budget: number;
  preferredTastes: TasteTag[];
  steps: TrailStep[];
  status: Record<string, TrailStepStatus>;
  doneAt: Record<string, number>;
  /** Pengingat overstay dikirim sekali per tenant. */
  overstayNotified: string[];
  /** Rute sebelum lewati terakhir, untuk "Batal lewati". */
  undo: SkipUndo | null;
};

/** PRD F08: toleransi di atas alokasi kunjungan sebelum pengingat muncul. */
export const OVERSTAY_GRACE_MIN = 5;

export function createTrailSession(
  plan: TrailPlanResult,
  params: { durationMin: number; budget: number; preferredTastes: TasteTag[] },
  now: number,
): TrailSession {
  const status: Record<string, TrailStepStatus> = {};
  for (const s of plan.steps) status[s.poi.id] = 'pending';
  return {
    startedAt: now,
    durationMin: params.durationMin,
    budget: params.budget,
    preferredTastes: params.preferredTastes,
    steps: plan.steps,
    status,
    doneAt: {},
    overstayNotified: [],
    undo: null,
  };
}

/** Step aktif = step pending pertama; -1 jika tidak ada. */
export function activeTrailStepIndex(session: TrailSession): number {
  return session.steps.findIndex((s) => session.status[s.poi.id] === 'pending');
}

export function pendingTrailSteps(session: TrailSession): TrailStep[] {
  return session.steps.filter((s) => session.status[s.poi.id] === 'pending');
}

export function doneTrailSteps(session: TrailSession): TrailStep[] {
  return session.steps.filter((s) => session.status[s.poi.id] === 'done');
}

export function remainingTrailBudget(session: TrailSession): number {
  const spent = doneTrailSteps(session).reduce((sum, s) => sum + s.estimatedCostIdr, 0);
  return Math.max(0, session.budget - spent);
}

export function remainingTrailMin(session: TrailSession, now: number): number {
  const elapsedMin = (now - session.startedAt) / 60_000;
  return Math.max(0, Math.floor(session.durationMin - elapsedMin));
}

/**
 * Dwell event → step selesai. Urutan tidak wajib diikuti, jadi tenant pending mana pun bisa selesai.
 * Mengembalikan objek yang sama jika tidak ada perubahan.
 */
export function completeTrailStep(session: TrailSession, poiId: string, at: number): TrailSession {
  if (session.status[poiId] !== 'pending') return session;
  return {
    ...session,
    status: { ...session.status, [poiId]: 'done' },
    doneAt: { ...session.doneAt, [poiId]: at },
    undo: null,
  };
}

export type OverstayAlert = {
  poiId: string;
  poiName: string;
  dwellMin: number;
  remainingMin: number;
  remainingStops: number;
};

/**
 * Tenant trail tempat pengguna berdiam melebihi alokasi + toleransi dan belum diingatkan.
 * `enteredAt` berasal dari state geofence: waktu masuk radius, null jika di luar.
 */
export function findTrailOverstay(
  session: TrailSession,
  enteredAt: Record<string, number | null | undefined>,
  now: number,
  graceMin: number = OVERSTAY_GRACE_MIN,
): OverstayAlert | null {
  for (const step of session.steps) {
    const id = step.poi.id;
    if (session.status[id] === 'skipped' || session.overstayNotified.includes(id)) continue;
    const since = enteredAt[id];
    if (since == null) continue;
    const dwellMs = now - since;
    if (!checkDwellAlert(dwellMs, step.allocatedVisitMin, graceMin)) continue;
    return {
      poiId: id,
      poiName: step.poi.name,
      dwellMin: Math.floor(dwellMs / 60_000),
      remainingMin: remainingTrailMin(session, now),
      remainingStops: pendingTrailSteps(session).filter((s) => s.poi.id !== id).length,
    };
  }
  return null;
}

export function markOverstayNotified(session: TrailSession, poiId: string): TrailSession {
  if (session.overstayNotified.includes(poiId)) return session;
  return { ...session, overstayNotified: [...session.overstayNotified, poiId] };
}

export type SkipResult = {
  session: TrailSession;
  /** Tenant pengganti yang belum ada di rute sebelumnya. */
  addedPoiIds: string[];
};

/**
 * Lewati tenant, lalu susun ulang semua step pending dari posisi pengguna dengan sisa waktu trail
 * dan sisa budget. Tenant yang sudah selesai atau dilewati tidak dipilih lagi.
 */
export function skipTrailStep(
  session: TrailSession,
  poiId: string,
  allPois: Poi[],
  userPosition: LatLng,
  now: number,
): SkipResult {
  if (session.status[poiId] !== 'pending') return { session, addedPoiIds: [] };

  const res = skipAndReplan(session, [poiId], allPois, userPosition, now);
  return {
    session: { ...res.session, undo: { poiId, steps: session.steps, status: session.status } },
    addedPoiIds: res.addedPoiIds,
  };
}

/** Susun ulang step pending dengan sisa waktu dan budget; tenant selesai atau dilewati tidak dipilih lagi. */
function skipAndReplan(
  session: TrailSession,
  poiIds: string[],
  candidatePois: Poi[],
  userPosition: LatLng,
  now: number,
): SkipResult {
  const status: Record<string, TrailStepStatus> = { ...session.status };
  for (const id of poiIds) status[id] = 'skipped';
  const kept = session.steps.filter((s) => status[s.poi.id] !== 'pending');
  const excluded = new Set(kept.map((s) => s.poi.id));
  const before = new Set(session.steps.map((s) => s.poi.id));

  const replan = planTrail({
    userPosition,
    pois: candidatePois.filter((p) => !excluded.has(p.id)),
    durationMin: remainingTrailMin(session, now),
    budget: remainingTrailBudget(session),
    preferredTastes: session.preferredTastes,
  });

  for (const s of session.steps) if (status[s.poi.id] === 'pending') delete status[s.poi.id];
  for (const s of replan.steps) status[s.poi.id] = 'pending';

  return {
    session: {
      ...session,
      steps: [...kept, ...replan.steps].map((s, i) => ({ ...s, stepNumber: i + 1 })),
      status,
    },
    addedPoiIds: replan.steps.map((s) => s.poi.id).filter((id) => !before.has(id)),
  };
}

/** Hanya lewati terakhir yang bisa dibatalkan, dan hanya jika belum ada progres baru. */
export function undoSkipTrailStep(session: TrailSession, poiId: string): TrailSession {
  if (session.undo?.poiId !== poiId) return session;
  return { ...session, steps: session.undo.steps, status: session.undo.status, undo: null };
}

/** Langsung menuju step tertentu: step pending sebelumnya dilewati tanpa susun ulang. */
export function jumpToTrailStep(session: TrailSession, index: number): TrailSession {
  const status = { ...session.status };
  for (const s of session.steps.slice(0, index)) {
    if (status[s.poi.id] === 'pending') status[s.poi.id] = 'skipped';
  }
  return { ...session, status, undo: null };
}
