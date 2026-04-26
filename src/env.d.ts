declare namespace NodeJS {
  interface ProcessEnv {
    OPENROUTER_API_KEY: string;
    DB_FILE_NAME: string;
    QDRANT_URL?: string;
    OLLAMA_BASE_URL?: string;
  }
}
