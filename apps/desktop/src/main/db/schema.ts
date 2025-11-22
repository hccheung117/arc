import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type').notNull(),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
})

export const models = sqliteTable('models', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id),
  active: integer('active').notNull().default(1),
})

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
})

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    role: text('role').notNull(),
    content: text('content').notNull(),
    ...timestamps,
  },
  (table) => ({
    conversationIdIdx: index('conversation_id_idx').on(table.conversationId),
  }),
)
