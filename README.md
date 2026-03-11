<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=convex-solid&background=tiles&project=%20" alt="convex-solid">
</p>

# convex-solidjs

[![NPM Version](https://img.shields.io/npm/v/convex-solidjs)](https://www.npmjs.com/package/convex-solidjs)
[![License](https://img.shields.io/npm/l/convex-solidjs)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/convex-solidjs)](https://bundlephobia.com/package/convex-solidjs)

Solid 2-native Convex bindings.

This package is a breaking rewrite for Solid 2 beta. There is no React-style query object, no `createResource`, and no mutation state wrapper. Queries are accessors, loading is handled with `Loading`, background work is exposed through `isPending`, and writes compose with Solid `action(...)`.

## Installation

```bash
pnpm add convex convex-solidjs solid-js
```

## Core Model

- `createQuery(...)` returns a live accessor backed by Convex subscriptions.
- `createMutation(...)` returns a plain async function for Convex mutations.
- `createConvexAction(...)` returns a plain async function for Convex action endpoints.
- Use Solid `Loading` for first render.
- Use `isPending(() => query())` while a stale value is being refreshed.
- Wrap writes in Solid `action(...)` when you want a mutation flow that composes with transitions and optimistic state.

## Quick Start

```tsx
import { render } from 'solid-js/web'
import { ConvexProvider, setupConvex } from 'convex-solidjs'
import App from './App'

const client = setupConvex(import.meta.env.VITE_CONVEX_URL)

render(
  () => (
    <ConvexProvider client={client}>
      <App />
    </ConvexProvider>
  ),
  document.getElementById('root')!,
)
```

## Queries

```tsx
import { Errored, For, Loading, createSignal, isPending } from 'solid-js'
import { createQuery } from 'convex-solidjs'
import { api } from '../convex/_generated/api'

function Messages() {
  const [channel, setChannel] = createSignal('general')
  const messages = createQuery(api.messages.list, () => ({ channel: channel() }))
  const refreshing = () => isPending(messages)

  return (
    <section>
      <select value={channel()} onInput={event => setChannel(event.currentTarget.value)}>
        <option value="general">general</option>
        <option value="random">random</option>
      </select>

      {refreshing() && <p>Refreshing…</p>}

      <Errored fallback={error => <p>{(error as Error).message}</p>}>
        <Loading fallback={<p>Loading…</p>}>
          <ul>
            <For each={messages()} keyed={false}>
              {message => <li>{message().body}</li>}
            </For>
          </ul>
        </Loading>
      </Errored>
    </section>
  )
}
```

`createQuery` is intentionally small:

```ts
const users = createQuery(api.users.list, { team: 'core' })
users() // live query result
```

There is no `isLoading`, `isStale`, `error`, `refetch`, `enabled`, or `keepPreviousData` API. Solid already has the control flow for that.

## Mutations

Convex writes stay as transport functions. Solid `action(...)` is the UI mutation primitive.

```tsx
import { action } from 'solid-js'
import { createMutation } from 'convex-solidjs'
import { api } from '../convex/_generated/api'

const sendMessage = createMutation(api.messages.send)

const submitMessage = action(function* (body: string) {
  yield sendMessage({ channel: 'general', body })
})
```

If you need optimistic UI, pair Solid `action(...)` with `createOptimistic` or `createOptimisticStore`.

In many Convex flows you do not need `refresh(...)` after a mutation because the subscribed query will update over the websocket automatically.

## Convex Actions

```ts
import { action } from 'solid-js'
import { createConvexAction } from 'convex-solidjs'
import { api } from '../convex/_generated/api'

const runGenerateSummary = createConvexAction(api.ai.generateSummary)

const generateSummary = action(function* (documentId: string) {
  return yield runGenerateSummary({ documentId })
})
```

## SSR

Use `prefetchQuery(...)` on the server and pass the result to `createQuery(..., { initialValue })`.

```tsx
import { createQuery, prefetchQuery, setupConvexHttp } from 'convex-solidjs'
import { api } from '../convex/_generated/api'

async function loadMessages() {
  const http = setupConvexHttp(process.env.CONVEX_URL!)
  return await prefetchQuery(http, api.messages.list, { channel: 'general' })
}

function Messages(props: { initialMessages: Awaited<ReturnType<typeof loadMessages>> }) {
  const messages = createQuery(
    api.messages.list,
    { channel: 'general' },
    { initialValue: props.initialMessages },
  )

  return (
    <Loading fallback={<p>Loading…</p>}>
      <ul>
        <For each={messages()} keyed={false}>
          {message => <li>{message().body}</li>}
        </For>
      </ul>
    </Loading>
  )
}
```

`initialValue` is the Solid 2-native hydration path. There is no separate `initialData` query wrapper anymore.

## API

### `ConvexProvider`

Provides a `ConvexClient` to Solid context.

### `setupConvex(url, options?)`
### `createConvexClient(url, options?)`

Create the realtime browser client.

### `setupConvexHttp(url, options?)`
### `createConvexHttpClient(url, options?)`

Create the HTTP client for server-side prefetching.

### `prefetchQuery(client, query, args)`

Runs a Convex query through `ConvexHttpClient.query(...)`.

### `createQuery(query, args, options?)`

Returns a live accessor for a Convex query.

Options:

- `initialValue`: seed SSR or hydration with prefetched data.
- `ssrSource`: override Solid 2 hydration behavior when needed.

### `createMutation(mutation)`

Returns `(args) => Promise<result>` for Convex mutations.

### `createConvexAction(action)`

Returns `(args) => Promise<result>` for Convex action endpoints.

### `useConvexClient()`

Reads the active `ConvexClient` from context.

## Migration Notes

If you were using the pre-Solid-2 API, the mapping is:

- `useQuery(...)` -> `createQuery(...)`
- `useMutation(...).mutate(...)` -> `createMutation(...)(...)`
- `useAction(...).mutate(...)` -> `createConvexAction(...)(...)`
- `query.isLoading()` -> `Loading`
- `query.isStale()` -> `isPending(() => query())`
- `query.error()` -> `Errored`
- `initialData` -> `initialValue`
- `refetch()` -> `refresh(query)` when you really need an explicit refresh

## Examples

- Demo app: [dev/App.tsx](./dev/App.tsx)
- Vite + Rolldown example: [examples/vite-rolldown/src/App.tsx](./examples/vite-rolldown/src/App.tsx)
