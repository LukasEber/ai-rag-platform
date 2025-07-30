ALTER TABLE "Chat" ALTER COLUMN "projectId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ContextFile" ADD COLUMN "indexingStatus" varchar DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "isIndexed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE no action ON UPDATE no action;