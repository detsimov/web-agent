-- Add ollama_base_url column to personalization (Local Models config)
ALTER TABLE `personalization` ADD `ollama_base_url` text;
