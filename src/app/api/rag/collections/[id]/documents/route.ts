import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { ragCollectionTable, ragDocumentTable } from "@/db/schema";
import { getSupportedExtensions } from "@/lib/rag/parsing";
import {
  DuplicateContentError,
  ingestFile,
  ingestTextContent,
  type ProgressEvent,
} from "@/lib/rag/pipeline";

const TextDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  const documents = await db
    .select()
    .from(ragDocumentTable)
    .where(eq(ragDocumentTable.collectionId, collectionId))
    .orderBy(ragDocumentTable.createdAt);

  // Reverse for descending order (newest first)
  documents.reverse();

  return Response.json(documents);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);

  // Check collection exists
  const [collection] = await db
    .select({ id: ragCollectionTable.id })
    .from(ragCollectionTable)
    .where(eq(ragCollectionTable.id, collectionId));

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const wantsStream = request.headers.get("accept") === "text/event-stream";

  // Non-streaming path (for simple clients / agent tool)
  if (!wantsStream) {
    return handleNonStreaming(request, collectionId, contentType);
  }

  // Streaming path — SSE with progress events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ProgressEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      try {
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            send({ stage: "error", message: "No file provided" });
            controller.close();
            return;
          }

          const ext = file.name.split(".").pop()?.toLowerCase();
          if (!ext || !getSupportedExtensions().includes(ext)) {
            send({
              stage: "error",
              message: `Unsupported file type: .${ext}`,
            });
            controller.close();
            return;
          }

          await ingestFile(collectionId, file, send);
        } else {
          const body = await request.json();
          const data = TextDocumentSchema.parse(body);
          await ingestTextContent(
            collectionId,
            data.title,
            data.content,
            "text",
            send,
          );
        }
      } catch (error) {
        if (error instanceof DuplicateContentError) {
          send({ stage: "error", message: error.message });
        } else {
          console.error(
            "POST /api/rag/collections/[id]/documents error:",
            error,
          );
          send({
            stage: "error",
            message:
              error instanceof Error ? error.message : "Ingestion failed",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleNonStreaming(
  request: Request,
  collectionId: number,
  contentType: string,
) {
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !getSupportedExtensions().includes(ext)) {
        return Response.json(
          {
            error: `Unsupported file type: .${ext}. Supported: ${getSupportedExtensions()
              .map((e) => `.${e}`)
              .join(", ")}`,
          },
          { status: 400 },
        );
      }

      const result = await ingestFile(collectionId, file);
      return Response.json(result);
    }

    const body = await request.json();
    const data = TextDocumentSchema.parse(body);
    const result = await ingestTextContent(
      collectionId,
      data.title,
      data.content,
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof DuplicateContentError) {
      return Response.json(
        { error: error.message, code: "DUPLICATE" },
        { status: 409 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    console.error("POST /api/rag/collections/[id]/documents error:", error);
    const message = error instanceof Error ? error.message : "Ingestion failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
