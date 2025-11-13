import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
})

export const models = sqliteTable('models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id),
})
