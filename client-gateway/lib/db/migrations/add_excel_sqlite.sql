-- Migration: Add ExcelSqlite table for Excel SQL functionality
-- Date: 2024-12-19

CREATE TABLE IF NOT EXISTS "ExcelSqlite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "projectId" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "contextFileId" uuid NOT NULL REFERENCES "ContextFile"("id") ON DELETE CASCADE,
  "dbPath" text NOT NULL,
  "tables" json NOT NULL,
  "fileName" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "excel_sqlite_project_id_idx" ON "ExcelSqlite"("projectId");
CREATE INDEX IF NOT EXISTS "excel_sqlite_context_file_id_idx" ON "ExcelSqlite"("contextFileId");
CREATE INDEX IF NOT EXISTS "excel_sqlite_created_at_idx" ON "ExcelSqlite"("createdAt");

-- Add comments for documentation
COMMENT ON TABLE "ExcelSqlite" IS 'Stores Excel SQLite database information for intelligent data processing';
COMMENT ON COLUMN "ExcelSqlite"."tables" IS 'JSON array of TableInfo objects containing schema information';
COMMENT ON COLUMN "ExcelSqlite"."dbPath" IS 'File path to the SQLite database file';
