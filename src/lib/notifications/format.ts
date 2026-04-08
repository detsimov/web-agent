import { chat } from "@/lib/chat";

type FormatVariables = {
  type: string;
  serverName: string;
  payload: string;
};

function interpolate(template: string, vars: FormatVariables): string {
  return template
    .replace(/\{\{type\}\}/g, vars.type)
    .replace(/\{\{serverName\}\}/g, vars.serverName)
    .replace(/\{\{payload\}\}/g, vars.payload);
}

export async function formatNotification(
  llmModel: string,
  llmPrompt: string,
  variables: FormatVariables,
): Promise<string> {
  const prompt = interpolate(llmPrompt, variables);

  const result = await chat([{ role: "user", content: prompt }], {
    model: llmModel,
  });

  return result.data;
}
