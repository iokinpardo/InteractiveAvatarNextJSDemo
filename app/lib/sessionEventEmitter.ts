// Simple in-memory event emitter for session configuration updates
// This allows the reconfigure endpoint to notify the SSE endpoint

import type { SessionConfigUpdate } from "./sessionConfig";

type ConfigUpdateEvent = {
  type: "config-update";
  customSessionId: string;
  config: SessionConfigUpdate;
  operationId?: string; // Optional operation ID for synchronous operations
};

type SessionCloseEvent = {
  type: "session-close";
  customSessionId: string;
  operationId?: string; // Optional operation ID for synchronous operations
};

type SessionEvent = ConfigUpdateEvent | SessionCloseEvent;

type EventListener = (event: SessionEvent) => void;

class SessionEventEmitter {
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * Subscribe to events for a specific customSessionId
   */
  subscribe(customSessionId: string, listener: EventListener): () => void {
    if (!this.listeners.has(customSessionId)) {
      this.listeners.set(customSessionId, new Set());
    }

    this.listeners.get(customSessionId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const sessionListeners = this.listeners.get(customSessionId);

      if (sessionListeners) {
        sessionListeners.delete(listener);
        if (sessionListeners.size === 0) {
          this.listeners.delete(customSessionId);
        }
      }
    };
  }

  /**
   * Emit an event for a specific customSessionId
   */
  emit(customSessionId: string, event: SessionEvent): void {
    const sessionListeners = this.listeners.get(customSessionId);

    if (sessionListeners) {
      sessionListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(
            `Error in event listener for session ${customSessionId}:`,
            error,
          );
        }
      });
    }
  }

  /**
   * Get the number of active listeners for a session
   */
  getListenerCount(customSessionId: string): number {
    return this.listeners.get(customSessionId)?.size ?? 0;
  }
}

// Singleton instance
const globalForEmitter = globalThis as unknown as {
  sessionEventEmitter?: SessionEventEmitter;
};

export const sessionEventEmitter =
  globalForEmitter.sessionEventEmitter ??
  (globalForEmitter.sessionEventEmitter = new SessionEventEmitter());
