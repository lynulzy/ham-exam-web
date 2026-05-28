import type { SavedState } from "@/lib/practice-storage";
import type { ExamSavedState } from "@/lib/exam-storage";

export type SyncPayload = {
  version: 1;
  updatedAt: number;
  practice: Partial<Record<string, SavedState>>;
  exam: Partial<Record<string, ExamSavedState>>;
};

const SYNC_CODE_KEY = "sync:code";

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function getSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SYNC_CODE_KEY);
}

export function saveSyncCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYNC_CODE_KEY, code.toUpperCase());
}

export async function pushSync(code: string, payload: SyncPayload): Promise<void> {
  const res = await fetch(`/api/sync/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "未知错误" }));
    throw new Error(error ?? "推送失败");
  }
}

export async function pullSync(code: string): Promise<SyncPayload | null> {
  const res = await fetch(`/api/sync/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "未知错误" }));
    throw new Error(error ?? "拉取失败");
  }
  return res.json() as Promise<SyncPayload>;
}

export function buildPayload(banks: string[]): SyncPayload {
  const practice: SyncPayload["practice"] = {};
  const exam: SyncPayload["exam"] = {};
  for (const bank of banks) {
    const pRaw = window.localStorage.getItem(`practice:${bank}`);
    if (pRaw) {
      try { practice[bank] = JSON.parse(pRaw); } catch { /* ignore */ }
    }
    const eRaw = window.localStorage.getItem(`exam:savedState:${bank}`);
    if (eRaw) {
      try { exam[bank] = JSON.parse(eRaw); } catch { /* ignore */ }
    }
  }
  return { version: 1, updatedAt: Date.now(), practice, exam };
}

export function applyPayload(payload: SyncPayload): void {
  for (const [bank, state] of Object.entries(payload.practice)) {
    if (state) window.localStorage.setItem(`practice:${bank}`, JSON.stringify(state));
  }
  for (const [bank, state] of Object.entries(payload.exam)) {
    if (state) window.localStorage.setItem(`exam:savedState:${bank}`, JSON.stringify(state));
  }
}

export type BankSummary = {
  bank: string;
  practiceAnswered: number;
  practiceTotal: number;
  practiceOrder: "sequential" | "random" | null;
  examAnswered: number;
  examTotal: number;
  examOngoing: boolean;
};

export function getLocalSummary(banks: string[]): BankSummary[] {
  return banks.map((bank) => {
    let practiceAnswered = 0;
    let practiceTotal = 0;
    let practiceOrder: "sequential" | "random" | null = null;

    const pRaw = window.localStorage.getItem(`practice:${bank}`);
    if (pRaw) {
      try {
        const p = JSON.parse(pRaw) as SavedState;
        practiceTotal = p.total ?? 0;
        practiceAnswered = (p.answersByPosition ?? []).filter(Boolean).length;
        practiceOrder = p.order ?? null;
      } catch { /* ignore */ }
    }

    let examAnswered = 0;
    let examTotal = 0;
    let examOngoing = false;

    const eRaw = window.localStorage.getItem(`exam:savedState:${bank}`);
    if (eRaw) {
      try {
        const e = JSON.parse(eRaw) as ExamSavedState;
        if (e.endAtMs && e.endAtMs > Date.now()) {
          examTotal = e.total ?? 0;
          examAnswered = (e.answersByPosition ?? []).filter(Boolean).length;
          examOngoing = true;
        }
      } catch { /* ignore */ }
    }

    return { bank, practiceAnswered, practiceTotal, practiceOrder, examAnswered, examTotal, examOngoing };
  });
}
