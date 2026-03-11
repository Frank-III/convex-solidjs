import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  messages: defineTable({
    channel: v.string(),
    body: v.string(),
    author: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_channel', ['channel']),
})
