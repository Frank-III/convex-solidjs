import { Loading } from 'solid-js'
import { renderToString } from '@solidjs/web'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createConvexAction,
  createMutation,
  createQuery,
  prefetchQuery,
} from '../src'

const mockQuery = 'mock:query' as any
const mockMutation = 'mock:mutation' as any
const mockAction = 'mock:action' as any

describe('SSR behavior', () => {
  it('renders initial query data without requiring ConvexProvider', () => {
    const html = renderToString(() => {
      const messages = createQuery(mockQuery, {}, { initialValue: ['hello'] })
      return (
        <Loading fallback={<p>loading</p>}>
          <p>{messages().join(',')}</p>
        </Loading>
      )
    })

    expect(html).toContain('hello')
    expect(html).not.toContain('loading')
  })

  it('throws when SSR query access has no provider and no initial value', () => {
    expect(() =>
      renderToString(() => (
        <Loading fallback={<p>loading</p>}>
          <p>{createQuery(mockQuery, {})().join(',')}</p>
        </Loading>
      )),
    ).toThrow('createQuery must be used within ConvexProvider')
  })

  it('returns SSR-safe mutation and action handlers without provider', async () => {
    let mutate!: ReturnType<typeof createMutation>
    let act!: ReturnType<typeof createConvexAction>

    renderToString(() => {
      mutate = createMutation(mockMutation)
      act = createConvexAction(mockAction)
      return null
    })

    await expect(mutate({} as never)).rejects.toThrow(
      'createMutation cannot execute during SSR without ConvexProvider',
    )
    await expect(act({} as never)).rejects.toThrow(
      'createConvexAction cannot execute during SSR without ConvexProvider',
    )
  })

  it('prefetchQuery delegates to ConvexHttpClient.query', async () => {
    const client = {
      query: vi.fn().mockResolvedValue(['ok']),
    } as any

    const result = await prefetchQuery(client, mockQuery, {})
    expect(result).toEqual(['ok'])
    expect(client.query).toHaveBeenCalledWith(mockQuery, {})
  })
})
