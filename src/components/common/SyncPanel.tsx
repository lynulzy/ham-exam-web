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
} from "@/lib/sync";

const BANKS = ["A", "B", "C"];

type Status = { type: "idle" | "loading" | "success" | "error"; message?: string };

export function SyncPanel() {
  const [code, setCode] = React.useState("");
  const [pushStatus, setPushStatus] = React.useState<Status>({ type: "idle" });
  const [pullStatus, setPullStatus] = React.useState<Status>({ type: "idle" });

  React.useEffect(() => {
    const saved = getSyncCode();
    if (saved) setCode(saved);
  }, []);

  function handleCodeChange(v: string) {
    const upper = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(upper);
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
    if (c.length !== 6) {
      setPushStatus({ type: "error", message: "请输入 6 位同步码" });
      return;
    }
    saveSyncCode(c);
    setPushStatus({ type: "loading" });
    try {
      const payload = buildPayload(BANKS);
      await pushSync(c, payload);
      setPushStatus({ type: "success", message: "已推送到云端" });
    } catch (e) {
      setPushStatus({ type: "error", message: e instanceof Error ? e.message : "推送失败" });
    }
  }

  async function handlePull() {
    const c = code.trim();
    if (c.length !== 6) {
      setPullStatus({ type: "error", message: "请输入 6 位同步码" });
      return;
    }
    saveSyncCode(c);
    setPullStatus({ type: "loading" });
    try {
      const payload = await pullSync(c);
      if (!payload) {
        setPullStatus({ type: "error", message: "未找到该同步码的数据" });
        return;
      }
      applyPayload(payload);
      setPullStatus({ type: "success", message: "已从云端恢复，刷新页面生效" });
    } catch (e) {
      setPullStatus({ type: "error", message: e instanceof Error ? e.message : "拉取失败" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">多设备同步</div>
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
