import * as z from "zod";
import { Agent } from "@/lib/agent/Agent";
import { AppError } from "@/lib/error/AppError";
import { AgentPipeline } from "@/lib/pipeline/AgentPipeline";
import { repo } from "@/lib/repository/DrizzleChatRepository";

const ChatRequestSchema = z.object({
  model: z.string().nonempty().optional(),
  maxTokens: z.number().int().positive().max(200000).optional(),
  instructions: z.string().max(4000).optional(),
  chatId: z.number().int().positive().optional(),
  branchId: z.number().int().positive().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().nonempty(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, maxTokens, instructions, chatId, branchId, messages } =
      ChatRequestSchema.parse(body);

    // Streaming pipeline path (branchId or chatId)
    let targetBranchId: number | undefined;

    if (branchId) {
      targetBranchId = branchId;
    } else if (chatId) {
      const mainBranch = await repo.getMainBranch(chatId);
      targetBranchId = mainBranch.id;
    }

    if (targetBranchId) {
      const lastMessage = messages[messages.length - 1];
      const agent = new Agent({ model, maxTokens });
      const pipeline = new AgentPipeline(repo, agent);
      const stream = pipeline.send(targetBranchId, lastMessage.content, {
        model,
        maxTokens,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
              );
            }
          } catch (error) {
            const errorChunk = {
              type: "error",
              error: error instanceof Error ? error.message : "Internal error",
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Stateless path (no branchId/chatId)
    const agent = new Agent({ model, maxTokens, instructions });
    const result = await agent.complete(messages);

    return Response.json({
      content: result.content,
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
