import { NextResponse } from "next/server";

export function checkDemoPassword(request: Request): NextResponse | null {
  const password = process.env.DEMO_ACCESS_PASSWORD;

  if (!password) {
    console.warn("[auth] DEMO_ACCESS_PASSWORD is not set — skipping password check");
    return null;
  }

  const provided = request.headers.get("x-demo-password");

  if (!provided || provided !== password) {
    return NextResponse.json(
      { error: "演示密码错误" },
      { status: 401 }
    );
  }

  return null;
}
