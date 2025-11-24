# ArcFS: Semantic Storage System

ArcFS serves as the application's persistence layer—a domain-specific abstraction that decouples business logic from physical storage. It is designed not merely as a file manager but as a **Semantic Storage System** that understands the application's data shape and access patterns.

## Core Philosophy

1.  **Logical over Physical**: The application interacts with logical resources (e.g., "Settings", "Thread History"), not file paths or extensions.
2.  **Intent-Based I/O**: Operations express *intent* (e.g., "Append message", "Update preference") rather than low-level mechanics.
3.  **Safety by Default**: The storage strategy (Atomic vs. Append) is intrinsic to the resource type, shielding the application from data corruption risks.

## Architectural Boundary

ArcFS draws a clear separation of concerns:

*   **Above the Line (Application)**: Expresses business intent (e.g., "Save this message").
*   **The Line (ArcFS)**: Accepts domain objects and identifiers.
*   **Below the Line (Implementation)**: Handles serialization, file I/O, flushing, and atomic guarantees.

This separation empowers the application to move fast with simple mental models while ArcFS handles the complexity of ensuring data integrity.

## Resource Archetypes

ArcFS classifies data into distinct archetypes, each with its own storage strategy tailored to its access pattern:

### 1. The Ledger (Index & Metadata)
*   **Nature**: High-value, frequently accessed, low-volume metadata.
*   **Strategy**: Optimized for **Read Speed**. Loaded entirely into memory on startup. Updates are atomic to guarantee consistency.

### 2. The Stream (Content Logs)
*   **Nature**: High-volume, chronological, append-mostly content (e.g., chat history).
*   **Strategy**: Optimized for **Write Safety**. New data is appended to the end of the log. This ensures that history remains intact even during crashes. It is loaded lazily.

### 3. The Config (State & Cache)
*   **Nature**: Singular, structured state that governs application behavior.
*   **Strategy**: Optimized for **Reliability**. Configuration is treated as a single document that is replaced atomically.

## System Guarantees

*   **Corruption Resistance**: Critical files are rarely modified in place. They are typically re-written to temporary locations and atomically swapped or strictly appended to.
*   **Performance Isolation**: Heavy content is physically separated from the metadata required for startup.
*   **Format Abstraction**: The application code is agnostic to the underlying serialization format, allowing the storage engine to evolve without refactoring business logic.

