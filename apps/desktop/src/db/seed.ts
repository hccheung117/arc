import { db } from './client'
import { providers, models, conversations, messages } from './schema'

export async function seedModels() {
  const existingProviders = await db.select().from(providers).limit(1)

  if (existingProviders.length > 0) {
    return
  }

  db.transaction((tx) => {
    tx.insert(providers)
      .values([
        { id: 'anthropic', name: 'Anthropic', type: 'anthropic' },
        { id: 'openai', name: 'OpenAI', type: 'openai' },
        { id: 'google', name: 'Google', type: 'google' },
        { id: 'mistral', name: 'Mistral', type: 'mistral' },
      ])
      .run()

    tx.insert(models)
      .values([
        {
          id: 'claude-3-5-sonnet',
          name: 'Claude 3.5 Sonnet',
          providerId: 'anthropic',
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          providerId: 'anthropic',
        },
        {
          id: 'claude-3-5-haiku',
          name: 'Claude 3.5 Haiku',
          providerId: 'anthropic',
        },
        {
          id: 'claude-3-haiku',
          name: 'Claude 3 Haiku',
          providerId: 'anthropic',
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          providerId: 'openai',
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          providerId: 'openai',
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          providerId: 'openai',
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          providerId: 'openai',
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          providerId: 'google',
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          providerId: 'google',
        },
        {
          id: 'gemini-1.0-pro',
          name: 'Gemini 1.0 Pro',
          providerId: 'google',
        },
        {
          id: 'mistral-large',
          name: 'Mistral Large',
          providerId: 'mistral',
        },
        {
          id: 'mistral-medium',
          name: 'Mistral Medium',
          providerId: 'mistral',
        },
        {
          id: 'mistral-small',
          name: 'Mistral Small',
          providerId: 'mistral',
        },
      ])
      .run()
  })
}

export async function seedConversations() {
  const existingConversations = await db.select().from(conversations).limit(1)

  if (existingConversations.length > 0) {
    return
  }

  db.transaction((tx) => {
    tx.insert(conversations)
      .values([
        {
          id: '1',
          title: 'Greeting exchange',
          createdAt: '2025-01-15T10:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: null,
          createdAt: '2025-01-14T14:30:00Z',
          updatedAt: '2025-01-14T14:30:00Z',
        },
        {
          id: '3',
          title: null,
          createdAt: '2025-01-13T09:15:00Z',
          updatedAt: '2025-01-13T09:15:00Z',
        },
      ])
      .run()
  })
}

export async function seedMessages() {
  const existingMessages = await db.select().from(messages).limit(1)

  if (existingMessages.length > 0) {
    return
  }

  db.transaction((tx) => {
    tx.insert(messages)
      .values([
        {
          id: '1',
          conversationId: '1',
          role: 'user',
          content: 'Hello! Can you help me understand how React hooks work?',
          createdAt: '2025-01-15T10:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          conversationId: '1',
          role: 'assistant',
          content:
            "I'd be happy to help you understand React hooks!\n\nReact hooks are functions that let you use state and other React features in functional components. Here are the most commonly used hooks:\n\n• useState - Manages component state\n• useEffect - Handles side effects and lifecycle events\n• useContext - Accesses context values\n• useCallback - Memoizes callback functions\n• useMemo - Memoizes computed values\n\nHooks follow two main rules: only call them at the top level of your component, and only call them from React functions. Would you like me to explain any specific hook in more detail?",
          createdAt: '2025-01-15T10:00:05Z',
          updatedAt: '2025-01-15T10:00:05Z',
        },
        {
          id: '3',
          conversationId: '1',
          role: 'user',
          content: 'Yes, can you explain useState with an example?',
          createdAt: '2025-01-15T10:01:00Z',
          updatedAt: '2025-01-15T10:01:00Z',
        },
        {
          id: '4',
          conversationId: '1',
          role: 'assistant',
          content:
            "Absolutely! useState is one of the most fundamental hooks. Here's how it works:\n\nThe useState hook returns an array with two elements: the current state value and a function to update it. Here's a simple example:\n\n```jsx\nconst [count, setCount] = useState(0)\n```\n\nIn this example:\n• count is the current state value (initialized to 0)\n• setCount is the function you call to update the state\n• The argument to useState (0) is the initial state value\n\nWhen you call setCount with a new value, React re-renders the component with the updated state. This is how you add reactivity to functional components!",
          createdAt: '2025-01-15T10:01:10Z',
          updatedAt: '2025-01-15T10:01:10Z',
        },
        {
          id: '5',
          conversationId: '2',
          role: 'user',
          content: 'What are the key considerations for planning a new software project?',
          createdAt: '2025-01-14T14:30:00Z',
          updatedAt: '2025-01-14T14:30:00Z',
        },
        {
          id: '6',
          conversationId: '2',
          role: 'assistant',
          content:
            'When planning a new software project, consider these key areas:\n\n**Requirements & Scope**\n• Define clear objectives and success criteria\n• Identify stakeholders and their needs\n• Document functional and non-functional requirements\n\n**Technical Architecture**\n• Choose appropriate technologies and frameworks\n• Design scalable and maintainable architecture\n• Plan for security and performance from the start\n\n**Timeline & Resources**\n• Break down work into phases or sprints\n• Estimate effort realistically\n• Allocate team resources effectively\n\n**Risk Management**\n• Identify potential technical and business risks\n• Create mitigation strategies\n• Plan for regular checkpoints and reviews',
          createdAt: '2025-01-14T14:30:15Z',
          updatedAt: '2025-01-14T14:30:15Z',
        },
        {
          id: '7',
          conversationId: '3',
          role: 'user',
          content: 'Can you review this TypeScript interface and suggest improvements?',
          createdAt: '2025-01-13T09:15:00Z',
          updatedAt: '2025-01-13T09:15:00Z',
        },
        {
          id: '8',
          conversationId: '3',
          role: 'assistant',
          content:
            "I'd be happy to review your TypeScript interface! However, I don't see the interface code in your message. Could you please share the interface you'd like me to review?\n\nIn the meantime, here are some general best practices for TypeScript interfaces:\n\n• Use clear, descriptive names\n• Prefer readonly properties when data shouldn't change\n• Use optional properties (?) sparingly and intentionally\n• Consider using type unions for discriminated unions\n• Document complex properties with JSDoc comments",
          createdAt: '2025-01-13T09:15:08Z',
          updatedAt: '2025-01-13T09:15:08Z',
        },
      ])
      .run()
  })
}
