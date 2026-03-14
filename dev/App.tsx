import {
  Errored,
  For,
  Loading,
  Show,
  action,
  createSignal,
  isPending,
  onSettled,
  type Accessor,
} from 'solid-js'
import { ConvexProvider, createMutation, createQuery, setupConvex } from '../src'
import { api } from './convex/_generated/api'
import type { Id } from './convex/_generated/dataModel'
import styles from './App.module.css'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function MessageList(props: { channelId: Accessor<Id<'channels'>> }) {
  const messages = createQuery(api.index.listMessages, () => ({ channelId: props.channelId() }))
  const refreshing = () => isPending(messages)

  return (
    <div class={styles.messages} style={{ height: '400px', 'overflow-y': 'auto' }}>
      {refreshing() && <p class={styles.stale}>Updating…</p>}
      <Errored fallback={error => <p class={styles.error}>{errorMessage(error)}</p>}>
        <Loading fallback={<p class={styles.loading}>Loading messages...</p>}>
          <Show
            when={messages().length > 0}
            fallback={<p class={styles.empty}>No messages yet. Start the conversation.</p>}
          >
            <For each={[...messages()].reverse()} keyed={false}>
              {message => (
                <div class={styles.message}>
                  <span class={styles.author}>{message().authorId ? 'User' : 'AI'}:</span>
                  <span class={styles.content}>{message().content}</span>
                </div>
              )}
            </For>
          </Show>
        </Loading>
      </Errored>
    </div>
  )
}

function ChatApp() {
  const [currentUser, setCurrentUser] = createSignal<Id<'users'> | null>(null)
  const [currentChannel, setCurrentChannel] = createSignal<Id<'channels'> | null>(null)
  const [messageInput, setMessageInput] = createSignal('')
  const [userName, setUserName] = createSignal('')
  const [uiError, setUiError] = createSignal<string | null>(null)

  const createUser = createMutation(api.index.createUser)
  const createChannel = createMutation(api.index.createChannel)
  const sendMessage = createMutation(api.index.sendMessage)

  const ensureDemo = action(function* () {
    setUiError(null)

    try {
      if (!currentUser()) {
        const userId: Id<'users'> = yield createUser({ name: 'Demo User' })
        setCurrentUser(userId)
      }

      if (!currentChannel()) {
        const channelId: Id<'channels'> = yield createChannel({ name: 'general' })
        setCurrentChannel(channelId)
      }
    } catch (error) {
      setUiError(errorMessage(error))
    }
  })

  const registerUser = action(function* () {
    const name = userName().trim()
    if (!name) return

    setUiError(null)

    try {
      const userId: Id<'users'> = yield createUser({ name })
      setCurrentUser(userId)
      setUserName('')
    } catch (error) {
      setUiError(errorMessage(error))
    }
  })

  const submitMessage = action(function* () {
    const channelId = currentChannel()
    const authorId = currentUser()
    const content = messageInput().trim()

    if (!channelId || !authorId || !content) return

    setUiError(null)
    setMessageInput('')

    try {
      yield sendMessage({ channelId, authorId, content })
    } catch (error) {
      setMessageInput(content)
      setUiError(errorMessage(error))
    }
  })

  onSettled(() => {
    void ensureDemo()
  })

  return (
    <div class={styles.App}>
      <header class={styles.header}>
        <h1>Convex SolidJS Chat Demo</h1>
      </header>

      <div class={styles.container}>
        <Show when={!currentUser()}>
          <div class={styles.section}>
            <h2>Create User</h2>
            <div class={styles.inputGroup}>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName()}
                onInput={event => setUserName(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void registerUser()
                }}
              />
              <button onClick={() => void registerUser()} disabled={!userName().trim()}>
                Create User
              </button>
            </div>
          </div>
        </Show>

        <Show when={currentUser() && currentChannel()}>
          <div class={styles.section}>
            <h2>
              Chat - #general
              <span
                style={{
                  'font-weight': 'normal',
                  'font-size': '0.8rem',
                  'margin-left': '1rem',
                  color: '#666',
                }}
              >
                (realtime query, Solid 2 loading boundary)
              </span>
            </h2>

            <Show when={currentChannel()}>{channelId => <MessageList channelId={channelId} />}</Show>

            <div class={styles.inputGroup} style={{ 'margin-top': '1rem' }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput()}
                onInput={event => setMessageInput(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void submitMessage()
                }}
                disabled={!currentUser() || !currentChannel()}
              />
              <button onClick={() => void submitMessage()} disabled={!messageInput().trim()}>
                Send
              </button>
            </div>
          </div>
        </Show>

        <Show when={uiError()}>{message => <p class={styles.error}>{message()}</p>}</Show>
      </div>
    </div>
  )
}

export default function App() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL

  if (!convexUrl) {
    return (
      <div style={{ padding: '2rem', 'text-align': 'center' }}>
        <h1>Missing Convex Configuration</h1>
        <p>Please set VITE_CONVEX_URL in your .env.local file</p>
        <p>
          Run: <code>npx convex dev</code> to get your deployment URL
        </p>
      </div>
    )
  }

  const client = setupConvex(convexUrl)

  return (
    <ConvexProvider client={client}>
      <ChatApp />
    </ConvexProvider>
  )
}
