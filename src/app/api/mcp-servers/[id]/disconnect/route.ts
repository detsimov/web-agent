import { mcpManager } from "@/lib/mcp/manager";

type Params = { id: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    await mcpManager.disconnect(Number(id));
    return Response.json({ status: "disconnected" });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
