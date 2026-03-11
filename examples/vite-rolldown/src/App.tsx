import {
  Errored,
  For,
  Loading,
  Show,
  action,
  createOptimisticStore,
  createSignal,
  isPending,
} from "solid-js";
import {
  ConvexProvider,
  createMutation,
  createQuery,
  setupConvex,
} from "convex-solidjs";
import { api } from "../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type DemoPage = "baseline" | "optimistic";

type ServerMessage = FunctionReturnType<typeof api.messages.list>[number];
type OptimisticMessage = {
  _id: `optimistic-${string}`;
  _creationTime: number;
  body: string;
  author?: string;
  channel: string;
  createdAt: number;
  optimistic: true;
};
type ViewMessage = (ServerMessage & { optimistic?: false }) | OptimisticMessage;

const DEMO_DELAY_MS = 900;

function LoadingMessages() {
  return (
    <ul class="messages">
      <For each={[0, 1, 2]}>{() => <li class="message loading-row" />}</For>
    </ul>
  );
}

function BaselinePage() {
  const [channel, setChannel] = createSignal("general");
  const [draft, setDraft] = createSignal("");
  const [user, setUser] = createSignal("demo");

  const messages = createQuery(api.messages.list, () => ({
    channel: channel(),
  }));
  const send = createMutation(api.messages.send);
  const refreshing = () => isPending(messages);

  const submit = action(function* () {
    const body = draft().trim();
    if (!body) return;

    setDraft("");
    yield send({
      channel: channel(),
      body,
      author: user(),
      delayMs: DEMO_DELAY_MS,
    });
  });

  return (
    <section>
      <h2>Baseline (No Optimistic UI)</h2>
      <p class="hint">
        Message appears after the delayed server write lands, in bottom-growing order.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={user()}
          onInput={(event) => setUser(event.currentTarget.value)}
          placeholder="user"
        />
        <select
          value={channel()}
          onChange={(event) => setChannel(event.currentTarget.value)}
        >
          <option value="general">general</option>
          <option value="random">random</option>
        </select>
        <input
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          placeholder="message"
        />
        <button type="submit" disabled={!draft().trim()}>
          Send
        </button>
      </form>

      <Show when={refreshing()}>
        <p class="status">Refreshing...</p>
      </Show>

      <Errored
        fallback={(error) => <p class="error">{(error as Error).message}</p>}
      >
        <Loading fallback={<LoadingMessages />}>
          <ul class="messages">
            <For each={messages() as ServerMessage[]} keyed={false}>
              {(message) => (
                <li class="message">
                  <strong>{message().author ?? "anon"}:</strong>{" "}
                  {message().body}
                </li>
              )}
            </For>
          </ul>
        </Loading>
      </Errored>
    </section>
  );
}

function OptimisticPage() {
  const [channel, setChannel] = createSignal("general");
  const [draft, setDraft] = createSignal("");
  const [user, setUser] = createSignal("demo");

  const liveMessages = createQuery(api.messages.list, () => ({
    channel: channel(),
  }));
  const [optimisticMessages, setOptimisticMessages] = createOptimisticStore(
    () => liveMessages() as ViewMessage[],
    [] as ViewMessage[],
  );

  const send = createMutation(api.messages.send);
  const refreshing = () => isPending(liveMessages);

  const submit = action(function* () {
    const body = draft().trim();
    if (!body) return;

    setDraft("");
    const now = Date.now();
    setOptimisticMessages((list) => {
      list.push({
        _id: `optimistic-${now}-${Math.random()}`,
        _creationTime: now,
        body,
        author: user(),
        channel: channel(),
        createdAt: now,
        optimistic: true,
      });
    });

    yield send({
      channel: channel(),
      body,
      author: user(),
      delayMs: DEMO_DELAY_MS,
    });
  });

  return (
    <section>
      <h2>Optimistic (Solid Action + createOptimisticStore)</h2>
      <p class="hint">
        Message appears instantly, then reconciles with server data.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={user()}
          onInput={(event) => setUser(event.currentTarget.value)}
          placeholder="user"
        />
        <select
          value={channel()}
          onChange={(event) => setChannel(event.currentTarget.value)}
        >
          <option value="general">general</option>
          <option value="random">random</option>
        </select>
        <input
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          placeholder="message"
        />
        <button type="submit" disabled={!draft().trim()}>
          Send
        </button>
      </form>

      <Show when={refreshing()}>
        <p class="status">Refreshing...</p>
      </Show>

      <Errored
        fallback={(error) => <p class="error">{(error as Error).message}</p>}
      >
        <Loading fallback={<LoadingMessages />}>
          <ul class="messages">
            <For each={optimisticMessages as ViewMessage[]} keyed={false}>
              {(message) => (
                <li class={message().optimistic ? "message optimistic" : "message"}>
                  <strong>{message().author ?? "anon"}:</strong>{" "}
                  {message().body}
                  <Show when={message().optimistic}>
                    <span class="pill">optimistic</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Loading>
      </Errored>
    </section>
  );
}

function DemoSwitch() {
  const [page, setPage] = createSignal<DemoPage>("baseline");

  return (
    <main>
      <h1>convex-solidjs / vite-rolldown</h1>
      <small>
        Compare baseline vs optimistic mutation UX (server delay {DEMO_DELAY_MS}
        ms)
      </small>

      <div class="tabs">
        <button
          class={{ active: page() === "baseline" }}
          onClick={() => setPage("baseline")}
        >
          Baseline
        </button>
        <button
          class={{ active: page() === "optimistic" }}
          onClick={() => setPage("optimistic")}
        >
          Optimistic
        </button>
      </div>

      <Show when={page() === "baseline"} fallback={<OptimisticPage />}>
        <BaselinePage />
      </Show>
    </main>
  );
}

export default function App() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;

  if (!convexUrl) {
    return (
      <main>
        <h1>Missing VITE_CONVEX_URL</h1>
        <p>Create `.env.local` with your Convex deployment URL.</p>
      </main>
    );
  }

  const client = setupConvex(convexUrl);

  return (
    <ConvexProvider client={client}>
      <DemoSwitch />
    </ConvexProvider>
  );
}
