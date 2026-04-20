ALTER TABLE `rag_collection` ADD `vector_threshold` real DEFAULT 0.3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `rerank_enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `rerank_model` text DEFAULT 'cohere/rerank-4-pro' NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `rerank_top_n_input` integer DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `rerank_threshold` real DEFAULT 0.3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `clarification_mode` text DEFAULT 'soft' NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_collection` ADD `knowledge_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rag_document` ADD `slug` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `rag_document_collection_slug` ON `rag_document` (`collection_id`, `slug`);
