// Session confirmation manager for synchronous API operations
// Manages pending confirmations from clients for operations like reconfiguration and session closure

type OperationType = "reconfigure" | "close";

interface PendingConfirmation {
  operationId: string;
  sessionId: string;
  operationType: OperationType;
  resolve: (value: { status: "success" | "error"; error?: string }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

class SessionConfirmationManager {
  private confirmations: Map<string, PendingConfirmation> = new Map();
  private readonly timeouts: Record<OperationType, number> = {
    reconfigure: 30000, // 30 seconds
    close: 15000, // 15 seconds
  };

  /**
   * Wait for a confirmation from the client
   * @param operationId Unique identifier for this operation
   * @param sessionId The custom session ID
   * @param operationType Type of operation (reconfigure or close)
   * @returns Promise that resolves when the client confirms or rejects on timeout
   */
  waitForConfirmation(
    operationId: string,
    sessionId: string,
    operationType: OperationType,
  ): Promise<{ status: "success" | "error"; error?: string }> {
    return new Promise((resolve, reject) => {
      // Clean up any existing confirmation with the same operationId
      const existing = this.confirmations.get(operationId);

      if (existing) {
        clearTimeout(existing.timeout);
        this.confirmations.delete(operationId);
      }

      const timeoutMs = this.timeouts[operationType];

      const timeout = setTimeout(() => {
        this.confirmations.delete(operationId);
        reject(
          new Error(
            `Confirmation timeout after ${timeoutMs}ms for operation ${operationId}`,
          ),
        );
      }, timeoutMs);

      const confirmation: PendingConfirmation = {
        operationId,
        sessionId,
        operationType,
        resolve,
        reject,
        timeout,
        createdAt: Date.now(),
      };

      this.confirmations.set(operationId, confirmation);
    });
  }

  /**
   * Confirm an operation completed successfully
   * @param operationId The operation ID to confirm
   * @param sessionId The session ID (for validation)
   * @returns true if confirmation was found and resolved, false otherwise
   */
  confirm(operationId: string, sessionId: string): boolean {
    const confirmation = this.confirmations.get(operationId);

    if (!confirmation) {
      return false;
    }

    // Validate that the sessionId matches
    if (confirmation.sessionId !== sessionId) {
      console.warn(
        `Confirmation sessionId mismatch for operation ${operationId}. Expected: ${confirmation.sessionId}, got: ${sessionId}`,
      );

      return false;
    }

    clearTimeout(confirmation.timeout);
    this.confirmations.delete(operationId);
    confirmation.resolve({ status: "success" });

    return true;
  }

  /**
   * Reject an operation with an error
   * @param operationId The operation ID to reject
   * @param sessionId The session ID (for validation)
   * @param error Error message
   * @returns true if rejection was found and resolved, false otherwise
   */
  reject(operationId: string, sessionId: string, error: string): boolean {
    const confirmation = this.confirmations.get(operationId);

    if (!confirmation) {
      return false;
    }

    // Validate that the sessionId matches
    if (confirmation.sessionId !== sessionId) {
      console.warn(
        `Rejection sessionId mismatch for operation ${operationId}. Expected: ${confirmation.sessionId}, got: ${sessionId}`,
      );

      return false;
    }

    clearTimeout(confirmation.timeout);
    this.confirmations.delete(operationId);
    confirmation.resolve({ status: "error", error });

    return true;
  }

  /**
   * Get the number of pending confirmations
   */
  getPendingCount(): number {
    return this.confirmations.size;
  }

  /**
   * Clean up expired confirmations (for maintenance)
   * This is called automatically, but can be called manually if needed
   */
	cleanupExpired(): void {
		const now = Date.now();
		const maxAge = Math.max(...Object.values(this.timeouts));

		const entries = Array.from(this.confirmations.entries());
		for (const [operationId, confirmation] of entries) {
			if (now - confirmation.createdAt > maxAge) {
				clearTimeout(confirmation.timeout);
				this.confirmations.delete(operationId);
				confirmation.reject(
					new Error(`Confirmation expired for operation ${operationId}`),
				);
			}
		}
	}

  /**
   * Cancel a pending confirmation (useful for cleanup)
   */
  cancel(operationId: string): boolean {
    const confirmation = this.confirmations.get(operationId);

    if (!confirmation) {
      return false;
    }

    clearTimeout(confirmation.timeout);
    this.confirmations.delete(operationId);
    confirmation.reject(new Error(`Operation ${operationId} was cancelled`));

    return true;
  }
}

// Singleton instance
const globalForConfirmation = globalThis as unknown as {
  sessionConfirmationManager?: SessionConfirmationManager;
};

export const sessionConfirmationManager =
  globalForConfirmation.sessionConfirmationManager ??
  (globalForConfirmation.sessionConfirmationManager =
    new SessionConfirmationManager());

// Cleanup expired confirmations every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      sessionConfirmationManager.cleanupExpired();
    },
    5 * 60 * 1000,
  );
}
