import {
  createContext,
  createMemo,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { isServer } from '@solidjs/web'
import {
  ConvexClient,
  ConvexHttpClient,
  type ConvexClientOptions,
} from 'convex/browser'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

export type MaybeAccessor<T> = T | Accessor<T>
export type QuerySsrSource = 'server' | 'hybrid' | 'initial' | 'client'

export interface CreateQueryOptions<T> {
  initialValue?: T
  ssrSource?: QuerySsrSource
}

const ConvexClientContext = createContext<ConvexClient | null>(null)

function resolveValue<T>(value: MaybeAccessor<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

function hasOwnInitialValue<T>(
  options: CreateQueryOptions<T> | undefined,
): options is CreateQueryOptions<T> & { initialValue: T } {
  return options != null && Object.prototype.hasOwnProperty.call(options, 'initialValue')
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function missingProviderError(label: string): Error {
  return new Error(`${label} must be used within ConvexProvider`)
}

function missingProviderExecutionError(label: string): Error {
  return new Error(`${label} cannot execute during SSR without ConvexProvider`)
}

function syncThenable<T>(value: T): PromiseLike<T> {
  return {
    then(onfulfilled?: ((current: T) => unknown) | null) {
      return syncThenable(onfulfilled ? onfulfilled(value) : value)
    },
  } as PromiseLike<T>
}

export function ConvexProvider(props: ParentProps<{ client: ConvexClient }>) {
  return (
    <ConvexClientContext value={props.client}>
      {props.children}
    </ConvexClientContext>
  )
}

export function useConvexClient(): ConvexClient {
  const client = useContext(ConvexClientContext)
  if (!client) throw missingProviderError('useConvexClient')
  return client
}

export function createConvexClient(
  address: string,
  options?: ConvexClientOptions,
): ConvexClient {
  return new ConvexClient(address, options)
}

export const setupConvex = createConvexClient

export function createConvexHttpClient(
  address: string,
  options?: ConstructorParameters<typeof ConvexHttpClient>[1],
): ConvexHttpClient {
  return new ConvexHttpClient(address, options)
}

export const setupConvexHttp = createConvexHttpClient

export async function prefetchQuery<Query extends FunctionReference<'query'>>(
  client: ConvexHttpClient,
  query: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  return client.query(query, args)
}

export function createQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: MaybeAccessor<FunctionArgs<Query>>,
  options?: CreateQueryOptions<FunctionReturnType<Query>>,
): Accessor<FunctionReturnType<Query>> {
  const client = useContext(ConvexClientContext)

  if (!client && !isServer) {
    throw missingProviderError('createQuery')
  }

  const hasInitialValue = hasOwnInitialValue(options)
  const initialValue = hasInitialValue ? options.initialValue : undefined
  const ssrSource = options?.ssrSource ?? (hasInitialValue ? 'initial' : undefined)
  let activeDispose: (() => void) | undefined

  const value = createMemo<FunctionReturnType<Query>>(
    () => {
      if (!client) throw missingProviderError('createQuery')

      activeDispose?.()

      const queryArgs = resolveValue(args)
      const queue: FunctionReturnType<Query>[] = []
      let nextResolve: ((result: IteratorResult<FunctionReturnType<Query>>) => void) | null = null
      let nextReject: ((reason?: unknown) => void) | null = null
      let pendingError: Error | null = null
      let closed = false

      const unsubscribe = client.onUpdate(
        query,
        queryArgs,
        result => {
          if (closed) return

          if (nextResolve) {
            const resolve = nextResolve
            nextResolve = null
            nextReject = null
            resolve({ value: result, done: false })
            return
          }

          queue.push(result)
        },
        reason => {
          const error = toError(reason)
          if (closed) return

          if (nextReject) {
            const reject = nextReject
            nextResolve = null
            nextReject = null
            reject(error)
            return
          }

          pendingError = error
        },
      )

      const disposeQuery = () => {
        if (closed) return
        closed = true
        unsubscribe.unsubscribe()
        if (nextResolve) {
          nextResolve({
            value: undefined as FunctionReturnType<Query>,
            done: true,
          })
          nextResolve = null
          nextReject = null
        }
        if (activeDispose === disposeQuery) {
          activeDispose = undefined
        }
      }
      activeDispose = disposeQuery

      const currentValue = unsubscribe.getCurrentValue()
      if (currentValue !== undefined) {
        queue.push(currentValue)
      }

      onCleanup(disposeQuery)

      return ({
        [Symbol.asyncIterator]() {
          return {
            next() {
              if (pendingError) {
                const error = pendingError
                pendingError = null
                return Promise.reject(error)
              }

              if (queue.length > 0) {
                return syncThenable({ value: queue.shift()!, done: false })
              }

              if (closed) {
                return syncThenable({
                  value: undefined as FunctionReturnType<Query>,
                  done: true,
                })
              }

              return new Promise((resolve, reject) => {
                nextResolve = resolve
                nextReject = reject
              })
            },
            return() {
              disposeQuery()
              return syncThenable({
                value: undefined as FunctionReturnType<Query>,
                done: true,
              })
            },
          }
        },
      }) as AsyncIterable<FunctionReturnType<Query>>
    },
    initialValue as FunctionReturnType<Query>,
    {
      name: 'convex-query',
      ssrSource,
    },
  )

  onCleanup(() => activeDispose?.())

  return value
}

export function createMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const client = useContext(ConvexClientContext)

  if (!client) {
    if (!isServer) throw missingProviderError('createMutation')
    return async () => {
      throw missingProviderExecutionError('createMutation')
    }
  }

  return args => client.mutation(mutation, args)
}

export function createConvexAction<ActionRef extends FunctionReference<'action'>>(
  actionReference: ActionRef,
): (args: FunctionArgs<ActionRef>) => Promise<FunctionReturnType<ActionRef>> {
  const client = useContext(ConvexClientContext)

  if (!client) {
    if (!isServer) throw missingProviderError('createConvexAction')
    return async () => {
      throw missingProviderExecutionError('createConvexAction')
    }
  }

  return args => client.action(actionReference, args)
}
