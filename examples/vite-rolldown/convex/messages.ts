import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { channel: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_channel', q => q.eq('channel', args.channel))
      .order('asc')
      .take(50)
  },
})

export const send = mutation({
  args: {
    channel: v.string(),
    body: v.string(),
    author: v.optional(v.string()),
    delayMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.delayMs && args.delayMs > 0) {
      await ctx.scheduler.runAfter(args.delayMs, internal.messages.insertMessage, {
        channel: args.channel,
        body: args.body,
        author: args.author,
      })
      return
    }

    await ctx.db.insert('messages', {
      channel: args.channel,
      body: args.body,
      author: args.author,
      createdAt: Date.now(),
    })
  },
})

export const insertMessage = internalMutation({
  args: {
    channel: v.string(),
    body: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      channel: args.channel,
      body: args.body,
      author: args.author,
      createdAt: Date.now(),
    })
  },
})
