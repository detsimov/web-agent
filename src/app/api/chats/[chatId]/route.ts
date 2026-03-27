import * as z from "zod";
import { chatService } from "@/lib/chat/ChatService";
import { AppError } from "@/lib/error/AppError";

type Params = { chatId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const chat = await chatService.getWithMessages(Number(chatId));

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let turnCount = 0;

    const messages = chat.messages.map((m) => {
      const usage = m.usage;
      if (usage) {
        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
        totalTokens += usage.totalTokens;
        totalCost += usage.cost ?? 0;
        turnCount++;
      }
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        usage: usage
          ? {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
              cost: usage.cost,
            }
          : null,
      };
    });

    const summaryState = await chatService.loadSummaryState(Number(chatId));

    return Response.json({
      chat: {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        summarizationStrategy: chat.summarizationStrategy ?? null,
        summarizationModel: chat.summarizationModel ?? null,
        summarizationEvery: chat.summarizationEvery ?? null,
        summarizationRatio: chat.summarizationRatio ?? null,
        summarizationKeep: chat.summarizationKeep ?? null,
        messages,
      },
      usage: {
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCost,
        turnCount,
      },
      summary: {
        core: summaryState.core,
        context: summaryState.context,
        summarizedUpTo: summaryState.summarizedUpTo,
      },
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

const PatchSchema = z.object({
  name: z.string().nonempty().optional(),
  summarizationStrategy: z.enum(["window", "percentage"]).nullable().optional(),
  summarizationModel: z.string().nullable().optional(),
  summarizationEvery: z.number().int().positive().nullable().optional(),
  summarizationRatio: z.number().min(0).max(1).nullable().optional(),
  summarizationKeep: z.number().int().nonnegative().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const data = PatchSchema.parse(body);
    const chat = await chatService.updateChat(Number(chatId), data);

    return Response.json({ chat });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    await chatService.deleteChat(Number(chatId));
    return Response.json({ success: true });
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
