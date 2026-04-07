import { mcpManager } from "@/lib/mcp/manager";

type Params = { id: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const resources = await mcpManager.listResources(Number(id));
    return Response.json({ resources });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const { uri } = await request.json();
    if (!uri || typeof uri !== "string") {
      return Response.json({ error: "uri is required" }, { status: 400 });
    }
    const contents = await mcpManager.readResource(Number(id), uri);
    return Response.json({ contents });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read resource",
      },
      { status: 500 },
    );
  }
}
