export const mockMessages = [
  {
    id: '1',
    type: 'user' as const,
    content: 'Hello! Can you help me understand how React hooks work?',
  },
  {
    id: '2',
    type: 'ai' as const,
    content:
      "I'd be happy to help you understand React hooks!\n\nReact hooks are functions that let you use state and other React features in functional components. Here are the most commonly used hooks:\n\n• useState - Manages component state\n• useEffect - Handles side effects and lifecycle events\n• useContext - Accesses context values\n• useCallback - Memoizes callback functions\n• useMemo - Memoizes computed values\n\nHooks follow two main rules: only call them at the top level of your component, and only call them from React functions. Would you like me to explain any specific hook in more detail?",
  },
  {
    id: '3',
    type: 'user' as const,
    content: 'Yes, can you explain useState with an example?',
  },
  {
    id: '4',
    type: 'ai' as const,
    content:
      "Absolutely! useState is one of the most fundamental hooks. Here's how it works:\n\nThe useState hook returns an array with two elements: the current state value and a function to update it. Here's a simple example:\n\n```jsx\nconst [count, setCount] = useState(0)\n```\n\nIn this example:\n• count is the current state value (initialized to 0)\n• setCount is the function you call to update the state\n• The argument to useState (0) is the initial state value\n\nWhen you call setCount with a new value, React re-renders the component with the updated state. This is how you add reactivity to functional components!",
  },
]
