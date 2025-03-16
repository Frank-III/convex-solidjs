import {
  createContext,
  useContext,
  onCleanup,
  createEffect,
  createMemo,
  getOwner,
  runWithOwner,
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { createStore } from 'solid-js/store'
import { ConvexClient, type ConvexClientOptions } from 'convex/browser'
import {
  type FunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
  getFunctionName,
} from 'convex/server'
import { convexToJson, type Value } from 'convex/values'

const ConvexContext = createContext<ConvexClient>()

export const useConvexClient = (): ConvexClient => {
  const client = useContext(ConvexContext)
  if (!client) {
    throw new Error(
      'No ConvexClient was found in context. Did you forget to wrap your app with ConvexProvider?',
    )
  }
  return client
}

export const ConvexProvider = (props: { client: ConvexClient; children: any }) => {
  return <ConvexContext.Provider value={props.client}>{props.children}</ConvexContext.Provider>
}

export const setupConvex = (url: string, options: ConvexClientOptions = {}) => {
  if (!url || typeof url !== 'string') {
    throw new Error('Expected string url property for setupConvex')
  }
  const optionsWithDefaults = { disabled: isServer, ...options }

  const client = new ConvexClient(url, optionsWithDefaults)
  onCleanup(() => client.close())
  return client
}

type UseQueryOptions<Query extends FunctionReference<'query'>> = {
  initialData?: FunctionReturnType<Query>
  keepPreviousData?: boolean
}

type UseQueryReturn<Query extends FunctionReference<'query'>> =
  | { data: undefined; error: undefined; isLoading: true; isStale: false }
  | { data: undefined; error: Error; isLoading: false; isStale: boolean }
  | { data: FunctionReturnType<Query>; error: undefined; isLoading: false; isStale: boolean }

export function useQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | (() => FunctionArgs<Query>),
  options: UseQueryOptions<Query> | (() => UseQueryOptions<Query>) = {},
): UseQueryReturn<Query> {
  const client = useConvexClient()
  if (typeof query === 'string') {
    throw new Error('Query must be a functionReference object, not a string')
  }

  const owner = getOwner()
  const [state, setState] = createStore({
    result: parseOptions(options).initialData,
    argsForLastResult: undefined as FunctionArgs<Query> | undefined,
    lastResult: undefined as FunctionReturnType<Query> | Error | undefined,
    haveArgsEverChanged: false,
  })

  const parsedArgs = createMemo(() => parseArgs(args))
  const parsedOptions = createMemo(() => parseOptions(options))

  createEffect(() => {
    const argsObject = parsedArgs()
    const unsubscribe = client.onUpdate(
      query,
      argsObject,
      dataFromServer => {
        runWithOwner(owner, () => {
          const copy = structuredClone(dataFromServer)
          setState({
            result: copy,
            argsForLastResult: argsObject,
            lastResult: copy,
          })
        })
      },
      (e: Error) => {
        runWithOwner(owner, () => {
          setState({
            result: e,
            argsForLastResult: argsObject,
            lastResult: structuredClone(e),
          })
        })
      },
    )
    onCleanup(() => unsubscribe())
  })

  const sameArgsAsLastResult = () =>
    !!state.argsForLastResult &&
    JSON.stringify(convexToJson(state.argsForLastResult)) ===
      JSON.stringify(convexToJson(parsedArgs()))

  const staleAllowed = () => !!(parsedOptions().keepPreviousData && state.lastResult)

  const initialArgs = parseArgs(args)
  createEffect(() => {
    if (!state.haveArgsEverChanged) {
      if (
        JSON.stringify(convexToJson(parsedArgs())) !== JSON.stringify(convexToJson(initialArgs))
      ) {
        setState('haveArgsEverChanged', true)
        const opts = parsedOptions()
        if (opts.initialData !== undefined) {
          setState({
            argsForLastResult: initialArgs,
            lastResult: opts.initialData,
          })
        }
      }
    }
  })

  const syncResult = () => {
    const opts = parsedOptions()
    if (opts.initialData && !state.haveArgsEverChanged) {
      return state.result
    }
    let value
    try {
      value = client.disabled
        ? undefined
        : client.client.localQueryResult(getFunctionName(query), parsedArgs())
    } catch (e) {
      if (!(e instanceof Error)) {
        console.error('threw non-Error instance', e)
        throw e
      }
      value = e
    }
    return value
  }

  const result = () =>
    syncResult() !== undefined ? syncResult() : staleAllowed() ? state.lastResult : undefined

  const isStale = () =>
    syncResult() === undefined &&
    staleAllowed() &&
    !sameArgsAsLastResult() &&
    result() !== undefined

  const data = () => {
    const r = result()
    return r instanceof Error ? undefined : r
  }

  const error = () => {
    const r = result()
    return r instanceof Error ? r : undefined
  }

  return {
    get data() {
      return data()
    },
    get isLoading() {
      return error() === undefined && data() === undefined
    },
    get error() {
      return error()
    },
    get isStale() {
      return isStale()
    },
  } as UseQueryReturn<Query>
}

function parseArgs(
  args: Record<string, Value> | (() => Record<string, Value>),
): Record<string, Value> {
  if (typeof args === 'function') {
    return args()
  }
  return args
}

function parseOptions<Query extends FunctionReference<'query'>>(
  options: UseQueryOptions<Query> | (() => UseQueryOptions<Query>),
): UseQueryOptions<Query> {
  if (typeof options === 'function') {
    return options()
  }
  return options
}
