import { mcpManager } from "@/lib/mcp/manager";

type Params = { id: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const prompts = await mcpManager.listPrompts(Number(id));
    return Response.json({ prompts });
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
    const { name, arguments: args } = await request.json();
    if (!name || typeof name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const messages = await mcpManager.getPrompt(Number(id), name, args);
    return Response.json({ messages });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to get prompt",
      },
      { status: 500 },
    );
  }
}
