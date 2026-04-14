export async function parseFile(
  buffer: ArrayBuffer,
  filename: string,
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return parsePdf(buffer);
    case "md":
    case "markdown":
    case "txt":
    case "csv":
      return new TextDecoder("utf-8").decode(buffer);
    default:
      throw new Error(
        `Unsupported file type: .${ext}. Supported: .pdf, .md, .txt, .csv`,
      );
  }
}

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join("\n\n") : text;
}

export function getSupportedExtensions(): string[] {
  return ["pdf", "md", "markdown", "txt", "csv"];
}
