CREATE TABLE "ExcelSqlite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"contextFileId" uuid NOT NULL,
	"dbPath" text NOT NULL,
	"tables" json NOT NULL,
	"fileName" text NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ExcelSqlite" ADD CONSTRAINT "ExcelSqlite_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ExcelSqlite" ADD CONSTRAINT "ExcelSqlite_contextFileId_ContextFile_id_fk" FOREIGN KEY ("contextFileId") REFERENCES "public"."ContextFile"("id") ON DELETE no action ON UPDATE no action;