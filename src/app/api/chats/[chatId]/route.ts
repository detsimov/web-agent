import * as z from "zod";
import { AppError } from "@/lib/error/AppError";
import { repo } from "@/lib/repository/DrizzleChatRepository";

type Params = { chatId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const chat = await repo.getChatWithMessages(Number(chatId));

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let turnCount = 0;

    const branches = chat.branches.map((branch) => {
      const messages = branch.messages.map((m) => {
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

      const contextState = branch.contextState;

      return {
        id: branch.id,
        name: branch.name,
        parentBranchId: branch.parentBranchId,
        forkedAtMsgId: branch.forkedAtMsgId,
        contextMode: branch.contextMode,
        model: branch.model,
        slidingWindowSize: branch.slidingWindowSize,
        stickyFactsEnabled: branch.stickyFactsEnabled,
        stickyFactsEvery: branch.stickyFactsEvery,
        stickyFactsModel: branch.stickyFactsModel,
        summarizationTrigger: branch.summarizationTrigger,
        summarizationModel: branch.summarizationModel,
        summarizationEvery: branch.summarizationEvery,
        summarizationRatio: branch.summarizationRatio,
        summarizationKeep: branch.summarizationKeep,
        workingMemoryMode: branch.workingMemoryMode,
        workingMemoryModel: branch.workingMemoryModel,
        workingMemoryEvery: branch.workingMemoryEvery,
        communicationStyle: branch.communicationStyle,
        createdAt: branch.createdAt,
        messages,
        contextState: contextState
          ? {
              facts: JSON.parse(contextState.facts) as Record<string, string>,
              context: contextState.context,
              summarizedUpTo: contextState.summarizedUpTo,
              factsExtractedUpTo: contextState.factsExtractedUpTo,
            }
          : null,
      };
    });

    return Response.json({
      chat: {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        stickyFactsBaseKeys: chat.stickyFactsBaseKeys
          ? JSON.parse(chat.stickyFactsBaseKeys)
          : null,
        stickyFactsRules: chat.stickyFactsRules,
        factsExtractionModel: chat.factsExtractionModel,
        factsExtractionRules: chat.factsExtractionRules,
        branches,
      },
      usage: {
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCost,
        turnCount,
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
  stickyFactsBaseKeys: z.array(z.string()).nullable().optional(),
  stickyFactsRules: z.string().nullable().optional(),
  factsExtractionModel: z.string().nullable().optional(),
  factsExtractionRules: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const data = PatchSchema.parse(body);

    const updateData: {
      name?: string;
      stickyFactsBaseKeys?: string | null;
      stickyFactsRules?: string | null;
      factsExtractionModel?: string | null;
      factsExtractionRules?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.stickyFactsBaseKeys !== undefined) {
      updateData.stickyFactsBaseKeys = data.stickyFactsBaseKeys
        ? JSON.stringify(data.stickyFactsBaseKeys)
        : null;
    }
    if (data.stickyFactsRules !== undefined) {
      updateData.stickyFactsRules = data.stickyFactsRules;
    }
    if (data.factsExtractionModel !== undefined) {
      updateData.factsExtractionModel = data.factsExtractionModel;
    }
    if (data.factsExtractionRules !== undefined) {
      updateData.factsExtractionRules = data.factsExtractionRules;
    }

    const chat = await repo.updateChat(Number(chatId), updateData);
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
    await repo.deleteChat(Number(chatId));
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
