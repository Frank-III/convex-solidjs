import {
  onCleanup,
  createEffect,
  createMemo,
  createSignal,
  createResource,
  batch,
  on,
  type Accessor,
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { createContextProvider } from '@solid-primitives/context'
import { ConvexClient, ConvexHttpClient, type ConvexClientOptions } from 'convex/browser'
import {
  type FunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
  getFunctionName,
} from 'convex/server'

// Type helpers for reactive values
type MaybeAccessor<T> = T | Accessor<T>

function resolve<T>(value: MaybeAccessor<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

// ConvexQueryClient class (matches React's convex-tanstack-query API)
export class ConvexQueryClient {
  client: ConvexClient
  serverHttpClient?: ConvexHttpClient

  constructor(url: string, options?: ConvexClientOptions) {
    if (!url || typeof url !== 'string') {
      throw new Error('ConvexQueryClient requires a valid URL string')
    }

    this.client = new ConvexClient(url, {
      disabled: isServer,
      ...options,
    })

    if (isServer) {
      this.serverHttpClient = new ConvexHttpClient(url)
    }
  }

  close() {
    this.client.close()
  }
}

// Create context with proper typing
export const [ConvexProvider, useConvexClient] = createContextProvider(
  (props: { client: ConvexQueryClient }) => {
    return props.client
  },
)

// Setup function (returns ConvexQueryClient for convenience)
export function setupConvex(url: string, options?: ConvexClientOptions): ConvexQueryClient {
  const convexQueryClient = new ConvexQueryClient(url, options)
  onCleanup(() => convexQueryClient.close())
  return convexQueryClient
}

// Query options
interface QueryOptions<T> {
  enabled?: boolean
  initialData?: T
  keepPreviousData?: boolean
}

// Query return type
interface QueryReturn<T> {
  data: Accessor<T | undefined>
  error: Accessor<Error | undefined>
  isLoading: Accessor<boolean>
  isStale: Accessor<boolean>
  refetch: () => void
}

// Main query hook
export function useQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: MaybeAccessor<FunctionArgs<Query>>,
  options?: MaybeAccessor<QueryOptions<FunctionReturnType<Query>>>,
): QueryReturn<FunctionReturnType<Query>> {
  type Data = FunctionReturnType<Query>

  const convexQueryClient = useConvexClient()
  if (!convexQueryClient) {
    throw new Error('useQuery must be used within ConvexProvider')
  }

  const client = convexQueryClient.client
  const httpClient = convexQueryClient.serverHttpClient

  // Resolve reactive values
  const getArgs = createMemo(() => resolve(args))
  const getOptions = createMemo(() => resolve(options ?? {}))

  // Track real-time updates
  const [version, setVersion] = createSignal(0)
  const [liveData, setLiveData] = createSignal<Data | undefined>()
  const [liveError, setLiveError] = createSignal<Error | undefined>()

  // Resource for data fetching
  const [resource, { refetch }] = createResource<
    Data | undefined,
    { args: FunctionArgs<Query>; version: number }
  >(
    () => {
      const opts = getOptions()
      if (opts.enabled === false) return null
      return { args: getArgs(), version: version() }
    },
    async source => {
      // Server: use HTTP client to actually fetch data (enables Suspense)
      if (isServer && httpClient) {
        return await httpClient.query(query, source.args)
      }

      // Client: check local cache first
      try {
        const result = client.client.localQueryResult(getFunctionName(query), source.args)
        if (result !== undefined) return result as Data
      } catch {
        // Sync query can fail, continue to subscription
      }

      // Use live data if available
      const error = liveError()
      if (error) throw error

      const data = liveData()
      if (data !== undefined) return data

      // Use initial data if nothing else available
      const opts = getOptions()
      if (opts.initialData !== undefined && version() === 0) {
        return opts.initialData
      }

      return undefined
    },
  )

  // Set up subscription
  createEffect(
    on([getArgs, () => getOptions().enabled], ([args, enabled]) => {
      if (enabled === false) return

      const unsubscribe = client.onUpdate(
        query,
        args,
        data => {
          batch(() => {
            setLiveData(() => data as Data)
            setLiveError(undefined)
            setVersion(v => v + 1)
          })
        },
        error => {
          batch(() => {
            setLiveError(() => error)
            setLiveData(undefined)
            setVersion(v => v + 1)
          })
        },
      )

      onCleanup(unsubscribe)
    }),
  )

  // Computed values
  const data = createMemo(() => {
    const opts = getOptions()
    if (opts.keepPreviousData && resource.loading && resource.latest) {
      return resource.latest
    }
    return resource()
  })

  const error = createMemo(() => resource.error)
  const isLoading = createMemo(() => resource.loading && !data())
  const isStale = createMemo(() =>
    Boolean(
      getOptions().keepPreviousData &&
        resource.loading &&
        resource.latest &&
        data() === resource.latest,
    ),
  )

  return { data, error, isLoading, isStale, refetch }
}

// Mutation state
interface MutationState<T> {
  data?: T
  error?: Error
  isLoading: boolean
}

// Mutation return type
interface MutationReturn<TArgs, TResult> {
  mutate: (args: TArgs) => Promise<TResult>
  mutateAsync: (args: TArgs) => Promise<TResult>
  data: Accessor<TResult | undefined>
  error: Accessor<Error | undefined>
  isLoading: Accessor<boolean>
  reset: () => void
}

// Mutation hook
export function useMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
): MutationReturn<FunctionArgs<Mutation>, FunctionReturnType<Mutation>> {
  type Args = FunctionArgs<Mutation>
  type Result = FunctionReturnType<Mutation>

  const convexQueryClient = useConvexClient()
  if (!convexQueryClient) {
    throw new Error('useMutation must be used within ConvexProvider')
  }

  const client = convexQueryClient.client

  const [state, setState] = createSignal<MutationState<Result>>({
    isLoading: false,
  })

  const mutateAsync = async (args: Args): Promise<Result> => {
    setState({ isLoading: true })

    try {
      const result = await client.mutation(mutation, args)
      setState({ data: result, isLoading: false })
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setState({ error: err, isLoading: false })
      throw err
    }
  }

  const reset = () => setState({ isLoading: false })

  return {
    mutate: mutateAsync,
    mutateAsync,
    data: () => state().data,
    error: () => state().error,
    isLoading: () => state().isLoading,
    reset,
  }
}

// Action hook
export function useAction<Action extends FunctionReference<'action'>>(
  action: Action,
): MutationReturn<FunctionArgs<Action>, FunctionReturnType<Action>> {
  type Args = FunctionArgs<Action>
  type Result = FunctionReturnType<Action>

  const convexQueryClient = useConvexClient()
  if (!convexQueryClient) {
    throw new Error('useAction must be used within ConvexProvider')
  }

  const client = convexQueryClient.client

  const [state, setState] = createSignal<MutationState<Result>>({
    isLoading: false,
  })

  const executeAsync = async (args: Args): Promise<Result> => {
    setState({ isLoading: true })

    try {
      const result = await client.action(action, args)
      setState({ data: result, isLoading: false })
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setState({ error: err, isLoading: false })
      throw err
    }
  }

  const reset = () => setState({ isLoading: false })

  return {
    mutate: executeAsync,
    mutateAsync: executeAsync,
    data: () => state().data,
    error: () => state().error,
    isLoading: () => state().isLoading,
    reset,
  }
}
