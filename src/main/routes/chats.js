import { register } from '../router.js'

const chats = [
  { id: 1, title: "Help me debug React app", date: new Date().toISOString() },
  { id: 2, title: "Write a Python script", date: new Date().toISOString() },
  { id: 3, title: "Explain async/await", date: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, title: "CSS Grid layout help", date: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, title: "Docker compose setup", date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 6, title: "Git rebase tutorial", date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 7, title: "SQL query optimization", date: new Date(Date.now() - 6 * 86400000).toISOString() },
  { id: 8, title: "REST API design", date: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 9, title: "TypeScript generics", date: new Date(Date.now() - 15 * 86400000).toISOString() },
  { id: 10, title: "Kubernetes basics", date: new Date(Date.now() - 25 * 86400000).toISOString() },
]

register('chats:list', () => chats)
