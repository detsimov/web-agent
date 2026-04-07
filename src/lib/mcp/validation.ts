import * as z from "zod";

const StdioConfigSchema = z.object({
  command: z.string().nonempty(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const HttpConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const SseConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const CreateMcpServerSchema = z
  .object({
    name: z.string().nonempty().max(100),
    type: z.enum(["stdio", "http", "sse"]),
    config: z.record(z.string(), z.unknown()),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "stdio")
        return StdioConfigSchema.safeParse(data.config).success;
      if (data.type === "http")
        return HttpConfigSchema.safeParse(data.config).success;
      if (data.type === "sse")
        return SseConfigSchema.safeParse(data.config).success;
      return false;
    },
    { message: "Invalid config for the specified transport type" },
  );

export const UpdateMcpServerSchema = z
  .object({
    name: z.string().nonempty().max(100).optional(),
    type: z.enum(["stdio", "http", "sse"]).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.config && data.type) {
        if (data.type === "stdio")
          return StdioConfigSchema.safeParse(data.config).success;
        if (data.type === "http")
          return HttpConfigSchema.safeParse(data.config).success;
        if (data.type === "sse")
          return SseConfigSchema.safeParse(data.config).success;
      }
      return true;
    },
    { message: "Invalid config for the specified transport type" },
  );
