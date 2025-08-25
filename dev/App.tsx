import { createSignal, For, Show, onMount } from 'solid-js'
import { ConvexProvider, setupConvex, useQuery, useMutation } from '../src'
import { api } from './convex/_generated/api'
import type { Id } from './convex/_generated/dataModel'
import styles from './App.module.css'

function ChatApp() {
  const [currentUser, setCurrentUser] = createSignal<Id<'users'> | null>(null)
  const [currentChannel, setCurrentChannel] = createSignal<Id<'channels'> | null>(null)
  const [messageInput, setMessageInput] = createSignal('')
  const [userName, setUserName] = createSignal('')

  // Mutations
  const createUser = useMutation(api.index.createUser)
  const createChannel = useMutation(api.index.createChannel)
  const sendMessage = useMutation(api.index.sendMessage)

  // Query messages for current channel with reactive args
  const messages = useQuery(
    api.index.listMessages,
    () => ({ channelId: currentChannel()! }),
    () => ({
      enabled: currentChannel() !== null,
      keepPreviousData: true,
    }),
  )

  const handleCreateUser = async () => {
    if (!userName().trim()) return
    try {
      const userId = await createUser.mutate({ name: userName() })
      setCurrentUser(userId)
      setUserName('')
    } catch (error) {
      console.error('Failed to create user:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput().trim() || !currentUser() || !currentChannel()) return
    try {
      await sendMessage.mutate({
        channelId: currentChannel()!,
        authorId: currentUser()!,
        content: messageInput(),
      })
      setMessageInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  // Create default user and channel on mount
  onMount(async () => {
    try {
      // Create a default user if none exists
      if (!currentUser()) {
        const userId = await createUser.mutate({ name: 'Demo User' })
        setCurrentUser(userId)
      }

      // Always use the "general" channel - createChannel now returns existing if it exists
      const channelId = await createChannel.mutate({ name: 'general' })
      setCurrentChannel(channelId)
    } catch (error) {
      console.error('Failed to create demo data:', error)
    }
  })

  return (
    <div class={styles.App}>
      <header class={styles.header}>
        <h1>Convex SolidJS Chat Demo</h1>
      </header>

      <div class={styles.container}>
        {/* User Section - only show if no user */}
        <Show when={!currentUser()}>
          <div class={styles.section}>
            <h2>Create User</h2>
            <div class={styles.inputGroup}>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName()}
                onInput={e => setUserName(e.currentTarget.value)}
                onKeyPress={e => e.key === 'Enter' && handleCreateUser()}
              />
              <button onClick={handleCreateUser} disabled={createUser.isLoading()}>
                {createUser.isLoading() ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </Show>

        {/* Main Chat Interface */}
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
                (Fixed channel for demo)
              </span>
            </h2>

            <div class={styles.messages} style={{ height: '400px', 'overflow-y': 'auto' }}>
              <Show
                when={!messages.isLoading()}
                fallback={<p class={styles.loading}>Loading messages...</p>}
              >
                <Show when={messages.error()}>
                  <p class={styles.error}>Error: {messages.error()?.message}</p>
                </Show>

                <Show when={!messages.error()}>
                  <Show
                    when={messages.data() && messages.data()!.length > 0}
                    fallback={<p class={styles.empty}>No messages yet. Start the conversation!</p>}
                  >
                    {/* Show messages in chronological order (reverse the array) */}
                    <For each={[...(messages.data() || [])].reverse()}>
                      {message => (
                        <div class={styles.message}>
                          <span class={styles.author}>{message.authorId ? 'User' : 'AI'}:</span>
                          <span class={styles.content}>{message.content}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>

                <Show when={messages.isStale()}>
                  <p class={styles.stale}>Updating...</p>
                </Show>
              </Show>
            </div>

            {/* Message Input */}
            <div class={styles.inputGroup} style={{ 'margin-top': '1rem' }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput()}
                onInput={e => setMessageInput(e.currentTarget.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                disabled={sendMessage.isLoading()}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendMessage.isLoading() || !messageInput().trim()}
              >
                {sendMessage.isLoading() ? 'Sending...' : 'Send'}
              </button>
            </div>
            <Show when={sendMessage.error()}>
              <p class={styles.error}>Error: {sendMessage.error()?.message}</p>
            </Show>
          </div>
        </Show>
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
