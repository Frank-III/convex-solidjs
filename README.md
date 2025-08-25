<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=convex-solid&background=tiles&project=%20" alt="convex-solid">
</p>

# convex-solidjs

[![NPM Version](https://img.shields.io/npm/v/convex-solidjs)](https://www.npmjs.com/package/convex-solidjs)
[![License](https://img.shields.io/npm/l/convex-solidjs)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/convex-solidjs)](https://bundlephobia.com/package/convex-solidjs)

> Type-safe, reactive [Convex](https://www.convex.dev/) client for [SolidJS](https://www.solidjs.com/) with real-time subscriptions and fine-grained reactivity.

[Convex](https://www.convex.dev/) is the typesafe backend-as-a-service with realtime updates, server functions, crons and scheduled jobs, file storage, vector search, and more.

`convex-solidjs` provides a native SolidJS integration with automatic reactivity, type safety, and real-time updates.

## Installation

```bash
npm install convex convex-solidjs
# or
pnpm add convex convex-solidjs
```

Run `npx convex init` to get started with Convex.

## Features

- 🎯 **Zero `any` types** - Fully type-safe with excellent TypeScript support
- ⚡ **SolidJS Native** - Built with SolidJS primitives (createResource, createSignal, createMemo)
- 🔄 **Reactive Arguments** - Pass signals or static values, the choice is yours
- 🔄 **Real-time Updates** - Automatic subscription to Convex queries with live data synchronization
- 📦 **Small Bundle** - Minimal overhead on top of Convex client (~5KB gzipped)
- 🎨 **Clean API** - Intuitive and easy to use
- 💪 **SSR Support** - Server-side rendering ready with `initialData` option
- 🔀 **Stale-While-Revalidate** - Keep showing previous data while loading new results

## Quick Start

### 1. Install Dependencies

```bash
npm install convex convex-solidjs
# or
pnpm add convex convex-solidjs
```

### 2. Initialize Convex

```bash
npx convex init
```

### 3. Setup Your App

Wrap your app with `ConvexProvider`:

```tsx
import { setupConvex, ConvexProvider } from 'convex-solidjs'
import { render } from 'solid-js/web'
import App from './App'

const client = setupConvex(import.meta.env.VITE_CONVEX_URL)

render(
  () => (
    <ConvexProvider client={client}>
      <App />
    </ConvexProvider>
  ),
  document.getElementById('root')!
)
```

## Core Concepts

### Queries with Reactive Arguments

Queries automatically re-run when their arguments change:

```tsx
import { useQuery } from 'convex-solidjs'
import { api } from '../convex/_generated/api'
import { createSignal, For, Show } from 'solid-js'

function Messages() {
  const [channel, setChannel] = createSignal('general')

  // Query re-runs automatically when channel changes
  const messages = useQuery(
    api.messages.list,
    () => ({ channel: channel() }), // Reactive arguments!
    { keepPreviousData: true } // Show old data while loading new
  )

  return (
    <div>
      <select onChange={e => setChannel(e.target.value)}>
        <option value="general">General</option>
        <option value="random">Random</option>
      </select>

      <Show when={!messages.isLoading()} fallback={<div>Loading...</div>}>
        <Show when={messages.error()}>
          <div>Error: {messages.error()?.message}</div>
        </Show>

        <For each={messages.data()}>{message => <div>{message.text}</div>}</For>

        <Show when={messages.isStale()}>
          <span>Updating...</span>
        </Show>
      </Show>
    </div>
  )
}
```

### Mutations with Type-Safe Arguments

Use `useMutation()` for type-safe mutations with loading states:

```tsx
import { useMutation } from 'convex-solidjs'
import { api } from '../convex/_generated/api'

function MessageForm() {
  const [text, setText] = createSignal('')
  const sendMessage = useMutation(api.messages.send)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()

    try {
      await sendMessage.mutate({
        text: text(),
        channel: 'general',
      })
      setText('')
    } catch (error) {
      console.error('Failed to send:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={text()}
        onInput={e => setText(e.currentTarget.value)}
        disabled={sendMessage.isLoading()}
      />
      <button type="submit" disabled={!text() || sendMessage.isLoading()}>
        {sendMessage.isLoading() ? 'Sending...' : 'Send'}
      </button>
      <Show when={sendMessage.error()}>
        <div>Error: {sendMessage.error()?.message}</div>
      </Show>
    </form>
  )
}
```

### Actions

Use `useAction()` for Convex actions (same API as mutations):

```tsx
const generateResponse = useAction(api.ai.generate)

const handleGenerate = async () => {
  const response = await generateResponse.mutate({
    prompt: 'Hello, AI!',
  })
  console.log(response)
}
```

## API Reference

### `setupConvex(url, options?)`

Creates a Convex client instance.

```tsx
const client = setupConvex('https://your-app.convex.cloud', {
  // Optional: disable in SSR
  disabled: isServer,
})
```

### `useQuery(query, args, options?)`

Subscribe to a Convex query with reactive arguments.

```tsx
const query = useQuery(
  api.messages.list,
  () => ({ channel: currentChannel() }), // Can be a function or static value
  {
    enabled: isLoggedIn(), // Conditional fetching
    keepPreviousData: true, // Show stale data while loading
    initialData: [], // SSR/Hydration support
  },
)

// Returns:
query.data() // T | undefined
query.error() // Error | undefined
query.isLoading() // boolean
query.isStale() // boolean
query.refetch() // () => void
```

### `useMutation(mutation)`

Execute Convex mutations with loading states.

```tsx
const mutation = useMutation(api.messages.send)

// Call it
await mutation.mutate({ text: 'Hello' })
// or
await mutation.mutateAsync({ text: 'Hello' })

// State
mutation.data() // Result of last successful mutation
mutation.error() // Error from last failed mutation
mutation.isLoading() // Is mutation in progress
mutation.reset() // Clear data and error
```

### `useAction(action)`

Execute Convex actions (same API as mutations).

```tsx
const action = useAction(api.ai.generate)
await action.mutate({ prompt: '...' })
```

### `useConvexClient()`

Get the raw Convex client for advanced use cases:

```tsx
const client = useConvexClient()

// Set auth
await client.setAuth(token)

// Call functions directly
const result = await client.mutation(api.foo.bar, args)
```

## Key Design Decisions

1. **Reactive Arguments**: Both args and options can be static values or accessor functions
2. **Resource-Based**: Uses SolidJS's `createResource` for optimal performance
3. **Type Safety**: Full TypeScript inference with zero type assertions
4. **Clean Returns**: No property getters, just simple accessor functions

## Advanced Usage

### Conditional Queries

Control when queries run with the `enabled` option:

```tsx
const user = useQuery(
  api.users.current,
  {},
  () => ({ enabled: isAuthenticated() }) // Only fetch when authenticated
)
```

### SSR and Hydration

Support server-side rendering with initial data:

```tsx
const messages = useQuery(
  api.messages.list,
  { channel: 'general' },
  { 
    initialData: serverData, // Data from SSR
    keepPreviousData: true 
  }
)
```

### Direct Client Access

Access the Convex client directly for advanced scenarios:

```tsx
import { useConvexClient } from 'convex-solidjs'

function AuthButton() {
  const client = useConvexClient()
  
  const handleLogin = async () => {
    await client.setAuth(token)
  }
  
  return <button onClick={handleLogin}>Login</button>
}
```

## Differences from Other Frameworks

### vs React (`convex/react`)
- **No hooks rules**: Use anywhere in SolidJS components
- **Fine-grained reactivity**: Only re-runs what changes
- **Accessor pattern**: Returns functions, not values
- **Reactive arguments**: Pass signals directly for automatic updates

### vs Svelte (`convex-svelte-ssr`)
- **Signal-based state**: Uses SolidJS signals instead of Svelte's runes
- **Resource integration**: Built on `createResource` for optimal async handling
- **Batch updates**: Leverages SolidJS's batching for performance

## Example Application

Check out the `/dev` folder for a complete chat application showcasing:
- User and channel creation
- Real-time message updates
- AI response generation with GPT-4
- Optimistic updates
- Error handling
- Loading states

Run the demo:

```bash
cd dev
pnpm install
pnpm run dev
```

## Deploying

In production build pipelines use the build command:

```bash
npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'npm run build'
```

to build your SolidJS app and deploy Convex functions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build the library: `pnpm run build`
4. Run tests: `pnpm test` (if applicable)
5. Run the demo: `cd dev && pnpm run dev`

### Project Structure

```
convex-solidjs/
├── src/
│   └── index.tsx        # Main library code
├── dev/                 # Demo application
│   ├── convex/         # Convex backend
│   └── App.tsx         # Demo UI
├── package.json
└── README.md
```

## Support

- [Documentation](https://docs.convex.dev)
- [Discord Community](https://discord.gg/convex)
- [GitHub Issues](https://github.com/yourusername/convex-solidjs/issues)

## License

MIT © Frank

---

<p align="center">
  Built with ❤️ for the SolidJS and Convex communities
</p>
