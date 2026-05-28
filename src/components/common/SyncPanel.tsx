"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateCode,
  getSyncCode,
  saveSyncCode,
  buildPayload,
  applyPayload,
  pushSync,
  pullSync,
  getLocalSummary,
  type BankSummary,
} from "@/lib/sync";

const BANKS = ["A", "B", "C"];
const AUTO_SYNC_INTERVAL_MS = 60_000;

type OpStatus = { type: "idle" | "loading" | "success" | "error"; message?: string };

function formatRelativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 5) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  return `${Math.floor(diff / 60)} 分钟前`;
}

function SummaryRow({ s }: { s: BankSummary }) {
  const hasExam = s.examOngoing;
  const hasPractice = s.practiceTotal > 0;
  return (
    <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
      <span className="font-medium text-foreground">{s.bank} 类</span>
      <span className="flex gap-3">
        {hasPractice ? (
          <span>
            练习 {s.practiceAnswered}/{s.practiceTotal}
            {s.practiceOrder === "random" ? " 随机" : " 顺序"}
          </span>
        ) : (
          <span>练习未开始</span>
        )}
        {hasExam && (
          <span className="text-amber-600">
            考试进行中 {s.examAnswered}/{s.examTotal}
          </span>
        )}
      </span>
    </div>
  );
}

export function SyncPanel() {
  const [code, setCode] = React.useState("");
  const [summary, setSummary] = React.useState<BankSummary[]>([]);
  const [pushStatus, setPushStatus] = React.useState<OpStatus>({ type: "idle" });
  const [pullStatus, setPullStatus] = React.useState<OpStatus>({ type: "idle" });
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [relativeTime, setRelativeTime] = React.useState<string>("");
  const codeRef = React.useRef(code);
  codeRef.current = code;

  // Load saved code and initial summary
  React.useEffect(() => {
    const saved = getSyncCode();
    if (saved) setCode(saved);
    setSummary(getLocalSummary(BANKS));
  }, []);

  // Update relative time label every 10s
  React.useEffect(() => {
    if (!lastSyncedAt) return;
    setRelativeTime(formatRelativeTime(lastSyncedAt));
    const t = setInterval(() => setRelativeTime(formatRelativeTime(lastSyncedAt)), 10_000);
    return () => clearInterval(t);
  }, [lastSyncedAt]);

  // Auto-sync every 1 minute
  React.useEffect(() => {
    const t = setInterval(async () => {
      const c = codeRef.current.trim();
      if (c.length !== 6) return;
      try {
        await pushSync(c, buildPayload(BANKS));
        setLastSyncedAt(Date.now());
        setSummary(getLocalSummary(BANKS));
      } catch {
        // silently ignore auto-sync failures
      }
    }, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  function handleCodeChange(v: string) {
    setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  }

  function handleGenerate() {
    const c = generateCode();
    setCode(c);
    saveSyncCode(c);
    setPushStatus({ type: "idle" });
    setPullStatus({ type: "idle" });
  }

  async function handlePush() {
    const c = code.trim();
    if (c.length !== 6) { setPushStatus({ type: "error", message: "请输入 6 位同步码" }); return; }
    saveSyncCode(c);
    setPushStatus({ type: "loading" });
    try {
      await pushSync(c, buildPayload(BANKS));
      setLastSyncedAt(Date.now());
      setSummary(getLocalSummary(BANKS));
      setPushStatus({ type: "success", message: "已推送到云端" });
    } catch (e) {
      setPushStatus({ type: "error", message: e instanceof Error ? e.message : "推送失败" });
    }
  }

  async function handlePull() {
    const c = code.trim();
    if (c.length !== 6) { setPullStatus({ type: "error", message: "请输入 6 位同步码" }); return; }
    saveSyncCode(c);
    setPullStatus({ type: "loading" });
    try {
      const payload = await pullSync(c);
      if (!payload) { setPullStatus({ type: "error", message: "未找到该同步码的数据" }); return; }
      applyPayload(payload);
      setSummary(getLocalSummary(BANKS));
      setPullStatus({ type: "success", message: "已从云端恢复，刷新页面生效" });
    } catch (e) {
      setPullStatus({ type: "error", message: e instanceof Error ? e.message : "拉取失败" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">多设备同步</div>

      {/* Local state summary */}
      <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground mb-1">本地进度</div>
        {summary.map((s) => <SummaryRow key={s.bank} s={s} />)}
      </div>

      {/* Sync code input */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="sync-code" className="text-xs text-muted-foreground">
            同步码（6 位）
          </Label>
          <Input
            id="sync-code"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="例：AB3X9Z"
            className="font-mono tracking-widest"
            maxLength={6}
          />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            生成
          </Button>
        </div>
      </div>

      {/* Push / Pull buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={pushStatus.type === "loading"}
          onClick={handlePush}
        >
          {pushStatus.type === "loading" ? "推送中…" : "推送到云端"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={pullStatus.type === "loading"}
          onClick={handlePull}
        >
          {pullStatus.type === "loading" ? "拉取中…" : "从云端恢复"}
        </Button>
      </div>

      {/* Auto-sync indicator */}
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>自动同步：每 1 分钟</span>
        {lastSyncedAt && <span>上次同步：{relativeTime}</span>}
      </div>

      {/* Status messages */}
      {pushStatus.type !== "idle" && pushStatus.type !== "loading" && (
        <p className={`text-xs ${pushStatus.type === "success" ? "text-green-600" : "text-destructive"}`}>
          推送：{pushStatus.message}
        </p>
      )}
      {pullStatus.type !== "idle" && pullStatus.type !== "loading" && (
        <p className={`text-xs ${pullStatus.type === "success" ? "text-green-600" : "text-destructive"}`}>
          拉取：{pullStatus.message}
        </p>
      )}
    </div>
  );
}
