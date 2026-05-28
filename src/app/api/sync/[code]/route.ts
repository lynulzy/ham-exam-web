import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "data", "sync");
const MAX_BYTES = 100 * 1024; // 100 KB

function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/i.test(code);
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(code: string): string {
  return path.join(DATA_DIR, `${code.toUpperCase()}.json`);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "无效的同步码" }, { status: 400 });
  }
  try {
    const raw = await fs.readFile(filePath(code), "utf8");
    return new NextResponse(raw, {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "未找到该同步码的数据" }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "无效的同步码" }, { status: 400 });
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "数据超过大小限制" }, { status: 413 });
  }
  try {
    JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  await ensureDir();
  await fs.writeFile(filePath(code), raw, "utf8");
  return NextResponse.json({ ok: true });
}
