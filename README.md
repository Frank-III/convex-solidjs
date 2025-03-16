<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=convex-solid&background=tiles&project=%20" alt="convex-solid">
</p>

# convex-solid

[Convex](https://www.convex.dev/) is the typesafe backend-as-a-service with realtime updates, server functions, crons and scheduled jobs, file storage, vector search, and more.

Receive live updates to Convex query subscriptions and call mutations and actions from SolidJS with `convex-solid`.

## Installation

```bash
npm install convex convex-solidjs
```

Run `npx convex init` to get started with Convex.

## Usage

`convex-solid` provides:
- A `ConvexProvider` component to wrap your app
- A `setupConvex()` function which takes a Convex deployment URL
- A `useConvexClient()` hook which returns a [ConvexClient](https://docs.convex.dev/api/classes/browser.ConvexClient) used to set authentication credentials and run Convex mutations and actions
- A `useQuery()` hook for subscribing to Convex queries

### Example

First, wrap your app with `ConvexProvider` and set up the client:

```tsx
import { setupConvex, ConvexProvider } from 'convex-solidjs';

const client = setupConvex(import.meta.env.VITE_CONVEX_URL);

function App() {
  return (
    <ConvexProvider client={client}>
      {/* Your app components */}
    </ConvexProvider>
  );
}
```

Then use `useQuery()` in your components:

```tsx
import { useQuery } from 'convex-solidjs';
import { api } from '../convex/_generated/api';
import { For, Match, Switch } from 'solid-js';

function Chat() {
  const query = useQuery(api.messages.list, { muteWords: [] });

  return (
    <div>
      <Switch>
        <Match when={query.isLoading}>
          <div>Loading...</div>
        </Match>

        <Match when={query.error}>
          <div>Failed to load: {query.error?.toString()}</div>
        </Match>

        <Match when={query.data}>
          <ul>
            <For each={query.data}>
              {(message) => (
                <li>
                  <span>{message.author}</span>
                  <span>{message.body}</span>
                </li>
              )}
            </For>
          </ul>
        </Match>
      </Switch>
    </div>
  );
}
```

Running a mutation:

```tsx
import { useConvexClient } from 'convex-solidjs';
import { createSignal } from 'solid-js';

function MessageForm() {
  const client = useConvexClient();
  const [toSend, setToSend] = createSignal('');
  const [author, setAuthor] = createSignal('me');

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    client.mutation(api.messages.send, {
      author: data.author as string,
      body: data.body as string
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="text" id="author" name="author" value={author()} />
      <input
        type="text"
        id="body"
        name="body"
        value={toSend()}
        onInput={e => setToSend(e.currentTarget.value)}
      />
      <button type="submit" disabled={!toSend()}>Send</button>
    </form>
  );
}
```

### Deploying

In production build pipelines use the build command:

```bash
npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'npm run build'
```

to build your SolidJS app and deploy Convex functions.

## Development

To build the library:

```bash
npm run build
```

## License

MIT
