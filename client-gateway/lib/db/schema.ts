import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  json,
  integer,
} from 'drizzle-orm/pg-core';


export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;


export const project = pgTable('Project', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: text('name').notNull(),
  userId: uuid('userId').notNull().references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  vectorCollection: text('vector_collection').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type Project = InferSelectModel<typeof project>;


export const contextFile = pgTable('ContextFile', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  projectId: uuid('projectId').notNull().references(() => project.id),

  fileName: text('fileName').notNull(),
  mimeType: text('mimeType').notNull(),
  fileSize: integer('fileSize').notNull(),

  embedded: boolean('embedded').default(false),
  chunkCount: integer('chunkCount'),

  createdAt: timestamp('createdAt').defaultNow(),
});


export type ContextFile = InferSelectModel<typeof contextFile>;


export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
  .notNull()
  .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  projectId: uuid('projectId'),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
  .notNull()
  .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;
