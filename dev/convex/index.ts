import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

/**
 * Create a user with a given name.
 */
export const createUser = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('users', { name: args.name })
  },
})

/**
 * Create a channel with a given name.
 */
export const createChannel = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id('channels'),
  handler: async (ctx, args) => {
    // Check if channel already exists
    const existing = await ctx.db
      .query('channels')
      .filter(q => q.eq(q.field('name'), args.name))
      .first()

    if (existing) {
      return existing._id
    }

    return await ctx.db.insert('channels', { name: args.name })
  },
})

/**
 * List all channels.
 */
export const listChannels = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('channels'),
      _creationTime: v.number(),
      name: v.string(),
    }),
  ),
  handler: async ctx => {
    return await ctx.db.query('channels').collect()
  },
})

/**
 * Get a channel by name.
 */
export const getChannelByName = query({
  args: { name: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('channels'),
      _creationTime: v.number(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('channels')
      .filter(q => q.eq(q.field('name'), args.name))
      .first()
  },
})

/**
 * List the 10 most recent messages from a channel in descending creation order.
 */
export const listMessages = query({
  args: {
    channelId: v.id('channels'),
  },
  returns: v.array(
    v.object({
      _id: v.id('messages'),
      _creationTime: v.number(),
      channelId: v.id('channels'),
      authorId: v.optional(v.id('users')),
      content: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_channel', (q: any) => q.eq('channelId', args.channelId))
      .order('desc')
      .take(10)
    return messages
  },
})

/**
 * Send a message to a channel and schedule a response from the AI.
 */
export const sendMessage = mutation({
  args: {
    channelId: v.id('channels'),
    authorId: v.id('users'),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (!channel) {
      throw new Error('Channel not found')
    }
    const user = await ctx.db.get(args.authorId)
    if (!user) {
      throw new Error('User not found')
    }
    await ctx.db.insert('messages', {
      channelId: args.channelId,
      authorId: args.authorId,
      content: args.content,
    })
    // Simulate AI response generation
    await ctx.scheduler.runAfter(1000, internal.index.generateResponse, {
      channelId: args.channelId,
    })
    return null
  },
})

/**
 * Generate a mock AI response for a given channel.
 */
export const generateResponse = internalAction({
  args: {
    channelId: v.id('channels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.index.loadContext, {
      channelId: args.channelId,
    })

    // Mock AI response generation
    const responses = [
      "That's an interesting point!",
      'I see what you mean.',
      'Could you elaborate on that?',
      'Thanks for sharing!',
      'That makes sense.',
      'I agree with your perspective.',
      'Tell me more about that.',
      'How fascinating!',
    ]

    const content = responses[Math.floor(Math.random() * responses.length)]

    await ctx.runMutation(internal.index.writeAgentResponse, {
      channelId: args.channelId,
      content,
    })
    return null
  },
})

export const loadContext = internalQuery({
  args: {
    channelId: v.id('channels'),
  },
  returns: v.array(
    v.object({
      role: v.union(v.literal('user'), v.literal('assistant')),
      content: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (!channel) {
      throw new Error('Channel not found')
    }
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_channel', (q: any) => q.eq('channelId', args.channelId))
      .order('desc')
      .take(10)

    const result = []
    for (const message of messages) {
      if (message.authorId) {
        const user = await ctx.db.get(message.authorId)
        if (!user) {
          throw new Error('User not found')
        }
        result.push({
          role: 'user' as const,
          content: `${user.name}: ${message.content}`,
        })
      } else {
        result.push({ role: 'assistant' as const, content: message.content })
      }
    }
    return result
  },
})

export const writeAgentResponse = internalMutation({
  args: {
    channelId: v.id('channels'),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      channelId: args.channelId,
      content: args.content,
    })
    return null
  },
})
