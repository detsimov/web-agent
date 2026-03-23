import { OpenRouter } from "@openrouter/sdk";

export const openRouter = new OpenRouter({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  debugLogger: console,
});
