# Arc: UX Vision, Philosophy, and User Flows

## 1. Vision & Philosophy

Arc is a native, privacy-first AI chat client designed to solve the fragmentation and security concerns of today's cloud-based AI landscape. It's built for everyone from students to AI researchers, providing a seamless and powerful experience across multiple models without the complexity of self-hosting or the limitations of a siloed web interface.

Our design philosophy is simple: **"Feels like ChatGPT, works like a power tool."** The UI prioritizes simplicity for new users while making advanced features accessible through progressive disclosure, catering to users at every level of expertise.

### Design Principles

- **Clean UI First, Keyboard-Driven Power:** The interface is clean and beginner-friendly, but backed by comprehensive keyboard shortcuts for advanced users to enable a fast, fluid workflow.
- **Respect the Desktop:** The application embraces native desktop patterns to feel integrated and familiar on each platform.
- **Three-Layer UX:** Interaction is structured in three layers of progressive disclosure:
    - **Always Visible:** Core functionality that everyone needs is always visible and accessible.
    - **Visible on Hover:** Intermediate actions are revealed on hover, keeping the interface clean but discoverable.
    - **Context Menu:** Advanced, power-user actions are available in context menus.

### Guardrails for “Feels like ChatGPT, Works like a Power Tool”

These are non-negotiable principles to gate all design and development decisions. They must be audited in code reviews, tests, and prototypes.

1. **Keyboard-First Interaction**: Every primary action must have a visible keyboard shortcut (e.g., in tooltips). Tab order must be logical and documented in component specs.
2. **Progressive Disclosure**: Explicitly classify controls as always-visible (core), hover-revealed (intermediate), or context menu (advanced). Document per component.
3. **Desktop-Native Feedback**: Ensure <200 ms feedback on hover/press. Use system cursors, OS-native spellcheck, and selection behaviors.

## 2. User Personas & Experience Levels

We segment our users into three levels, each with distinct needs:

### Level 1: Beginners

- **Student:** "I need a simple, free tool to help me with my homework and essays without a complicated setup."
- **Office Professional:** "I need a reliable AI assistant to help me draft emails and reports quickly, but our company has strict security rules."
- **Content Creator:** "I need a versatile tool to brainstorm ideas and generate social media content without juggling multiple AI websites."

### Level 2: Intermediate Professionals

- **Product Manager:** "I need an efficient way to summarize user feedback and draft specs, with more control than the basic web chats offer."
- **Marketing Analyst:** "I need to compare outputs from different AI models to create the most effective campaign copy and analyze market data."

### Level 3: AI Power Users

- **Academic Researcher:** "I need a powerful tool to analyze research papers, process experimental data, and draft manuscripts using multiple specialized AI models."
- **Innovation Lead:** "I need to evaluate different providers and tuning settings to set organizational standards without the complexity of self-hosting."

## 3. Key User Flows

### 3.1. First Time Open

1. User launches Arc for the first time.
2. The app opens to the main Chat Page (`/`).
3. The Content Area displays an empty state with a muted, sunk Arc logo or name.
4. A primary call-to-action (e.g., "Configure Your First AI Provider") is prominently displayed, directing the user to the Settings Page.
5. User navigates to Settings > AI Providers.
6. User follows the "Provider Setup" flow.
7. After successfullyadding a provider, the "Back to Chat" button returns them to `/`.
8. The Model Selector in the header automatically selects the newly added provider/default model.
9. The user can now start their first chat.

### 3.2. Provider Setup

1. From the Settings Page (`/settings`), user clicks the "AI Providers" tab.
2. User clicks the "Add Provider" button.
3. The Provider Form Dialog (modal) opens. The primary action button is labeled "Test".
4. User inputs their credentials (API Key, Base URL, or both).
    - **Note:** All fields are optional to support corporate proxy configurations or partially-set-up providers.
5. As the user types, the system attempts to auto-detect the provider (e.g., "OpenAI format detected"). A status indicator confirms detection.
6. If the credentials are valid for multiple provider types, a manual selection dropdown appears, prompting the user to clarify.
7. User clicks the "Test" button. The system attempts to connect and validate the credentials, showing a loading state.
8. **On Success:** The "Test" button turns into a "Save" button, and a success message is shown.
9. **On Failure:** An inline error message appears explaining the failure (e.g., "Invalid API Key"), and the button remains "Test".
10. User clicks "Save" (after a successful test).
11. The dialog closes, and the new provider appears in the Provider List with a "Connected" status.

### 3.3. Model Selection (New Chat)

1. In the Main Chat Interface (`/`), the user clicks the Model Selector in the header.
2. A dropdown appears, organized by provider. By default, it shows all available models from all providers.
3. The dropdown includes:
    - A **Search Bar** at the top.
    - A **"Star" icon** next to each model (on hover).
    - A **"Filter" button** (e.g., funnel icon).
4. **Favoriting Flow (L2+):** User clicks the "Star" icon next to their most-used models. A "Favorites" group is created at the top of the list for one-click access.
5. **Whitelisting Flow (L2+):** User clicks the "Filter" button. A new view appears where they can check/uncheck models across all providers to whitelist only the ones they want to see. After applying, the dropdown is much cleaner.
6. **Standard Selection Flow:**
    - User types in the search bar (e.g., "cs4").
    - The list (full or whitelisted) filters using fuzzy matching, showing "Claude Sonnet 4.5".
    - User clicks the desired model.
7. The dropdown closes, and the header now displays the selected model. The *current chat* is now set to use this model.

Unless specified, a chat will use a "default" model from the selected provider.

### 3.4. Per-Message Model Change (Context Switching)

1. The user is in an existing conversation with Model A.
2. Before sending their *next* message, the user clicks the Model Selector in the header and selects Model B.
3. The user types and sends their new message.
4. This message (and all subsequent messages in this chat) will be processed by Model B.
5. The message list clearly indicates which model generated which response, and marks the point of the switch.

Example: A subtle "--- Switched to Claude 3 Sonnet ---" divider appears in the chat list.

### 3.5. Branch Off Conversation

1. User is scrolling through an existing chat.
2. User hovers over a specific message (either their own or an AI response).
3. A set of Message Actions appears (on hover).
4. User clicks the "Branch Off" button.
5. A new chat is instantly created in the Chat History Sidebar.
6. This new chat is an exact duplicate of the original conversation *up to and including* the selected message.
7. The user is automatically switched to this new chat, with the composer focused, ready to continue the conversation from that specific point.

### 3.6. Automatic Chat Titling

1. User starts a new chat and sends the first message (e.g., "how do list comprehensions work in python?").
2. The AI model processes the message and sends its response.
3. After this first round-trip, Arc automatically generates a concise title for the chat (e.g., "Python List Comprehensions").
4. This title immediately replaces the "New Chat" placeholder in the Chat History Sidebar.
5. The system may update this title as the conversation evolves (e.g., after a few more rounds) to better reflect the chat's main topic, always prioritizing brevity for sidebar readability.

### 3.7. In-Chat Message Pinning (for L2+ Users)

1. A user is in a long conversation and finds a key message (e.g., an important code snippet or a core idea).
2. On hover, the user selects a "Pin Message" action.
3. A new "Pinned Messages" bar appears at the top of the chat content area (below the header), showing a compact representation of the pinned message (e.g., "Pin 1: Code snippet...").
4. As the user scrolls, this pin bar remains visible.
5. User clicks on a pin in the bar.
6. The main chat view automatically scrolls to that specific message, highlighting it briefly.
7. Simultaneously, a "Scroll back to last position" button or toast appears, allowing the user to one-click return to where they were before clicking the pin.
