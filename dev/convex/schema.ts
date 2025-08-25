import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  channels: defineTable({
    name: v.string(),
  }),

  users: defineTable({
    name: v.string(),
  }),

  messages: defineTable({
    channelId: v.id('channels'),
    authorId: v.optional(v.id('users')),
    content: v.string(),
  }).index('by_channel', ['channelId']),
})
