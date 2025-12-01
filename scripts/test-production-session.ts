#!/usr/bin/env node

/**
 * Production Session Test Script
 *
 * Simulates a production session flow:
 * 1. Opens browser session with custom sessionId
 * 2. Performs 5 iterations of avatar reconfiguration and message sending
 * 3. Closes the session via REST API
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const AVATAR_IDS = [
  "Ann_Therapist_public",
  "Shawn_Therapist_public",
  "Bryan_FitnessCoach_public",
  "Dexter_Doctor_Standing2_public",
  "Elenora_IT_Sitting_public",
];

const SAMPLE_MESSAGES = [
  "Welcome to our interactive avatar demonstration. Today we'll explore the capabilities of our streaming avatar technology, which enables real-time conversational experiences with lifelike digital personas. This technology combines advanced AI with high-quality video streaming to create engaging interactions.",
  "The avatar system supports multiple conversation modes, including webhook-driven narration and conversational voice chat. Each mode is optimized for different use cases, from automated presentations to interactive customer service scenarios. The flexibility allows for seamless integration into various business workflows.",
  "Our platform provides robust session management capabilities, allowing external systems to track and control avatar sessions using custom identifiers. This enables sophisticated orchestration of avatar interactions across multiple clients and browser sessions, with automatic cleanup and timeout handling.",
  "The avatar configuration system supports dynamic updates during active sessions, enabling real-time changes to avatar appearance, voice characteristics, and behavioral parameters. This flexibility is essential for creating adaptive and responsive user experiences that can adjust to context and user preferences.",
  "Thank you for participating in this demonstration. The session management system ensures reliable operation with automatic cleanup, session mapping, and event-driven updates. These features make the platform production-ready for enterprise deployments requiring high availability and scalability.",
];

interface ApiResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

class TestError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = "TestError";
  }
}

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${message}`, ...args);
}

function logError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();

  console.error(`[${timestamp}] ERROR: ${message}`, error);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function apiCall(
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<ApiResponse> {
  const url = `${BASE_URL}${endpoint}`;

  log(`API ${method} ${url}`, body ? { body } : "");

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = (await response.json()) as ApiResponse;

    if (!response.ok) {
      throw new TestError(
        data.error || data.message || `HTTP ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  } catch (error) {
    if (error instanceof TestError) {
      throw error;
    }
    throw new TestError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}

async function reconfigureSession(
  sessionId: string,
  avatarId: string,
): Promise<void> {
  log(`Reconfiguring session ${sessionId} with avatar ${avatarId}`);
  await apiCall("/api/avatar/reconfigure-session", "POST", {
    sessionId,
    config: {
      avatarId,
    },
  });
  log(`Session reconfigured successfully`);
}

async function sendMessage(sessionId: string, message: string): Promise<void> {
  log(`Sending message to session ${sessionId}`);
  await apiCall("/api/avatar/send-message", "POST", {
    sessionId,
    message,
    taskType: "REPEAT",
    taskMode: "SYNC",
  });
  log(`Message sent successfully`);
}

async function closeSession(sessionId: string): Promise<void> {
  log(`Closing session ${sessionId}`);
  await apiCall("/api/avatar/close-session", "POST", {
    sessionId,
  });
  log(`Session closed successfully`);
}

function generateSessionId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getBrowserUrl(sessionId: string): string {
  return `${BASE_URL}?sessionId=${encodeURIComponent(sessionId)}`;
}

async function waitForSessionConnection(
  sessionId: string,
  waitSeconds: number = 15,
): Promise<void> {
  log(`Waiting ${waitSeconds} seconds for session ${sessionId} to connect...`);
  log("(Session registration happens client-side when the browser page loads)");

  // Wait for the browser to load and register the session
  // The session registration happens automatically when the InteractiveAvatar component
  // connects to HeyGen and calls the register-session endpoint
  for (let i = 0; i < waitSeconds; i++) {
    await sleep(1);
    if ((i + 1) % 3 === 0) {
      log(`  ... ${i + 1}/${waitSeconds} seconds elapsed`);
    }
  }

  log("Session connection wait complete. Proceeding with test...");
}

async function runTest(): Promise<void> {
  const sessionId = generateSessionId();
  const browserUrl = getBrowserUrl(sessionId);

  log("=".repeat(60));
  log("Starting Production Session Test");
  log("=".repeat(60));
  log(`Session ID: ${sessionId}`);
  log(`Browser URL: ${browserUrl}`);
  log("");

  try {
    // Step 1: Open browser (this will be done manually or via browser automation)
    log("STEP 1: Open browser session");
    log(`Please open the following URL in your browser: ${browserUrl}`);
    log("Waiting for session to connect...");
    log("");

    // Wait for session to be established
    await waitForSessionConnection(sessionId, 30);

    // Step 2: Perform 5 iterations
    log(
      "STEP 2: Starting 5 iterations of avatar reconfiguration and messaging",
    );
    log("");

    for (let i = 0; i < 5; i++) {
      const iteration = i + 1;
      const avatarId = AVATAR_IDS[i % AVATAR_IDS.length];
      const message = SAMPLE_MESSAGES[i];

      log(`--- Iteration ${iteration}/5 ---`);
      log(`Avatar ID: ${avatarId}`);
      log(`Message preview: ${message.substring(0, 50)}...`);
      log("");

      // Change avatar configuration
      log(`[${iteration}.1] Reconfiguring avatar...`);
      await reconfigureSession(sessionId, avatarId);
      log(`[${iteration}.1] Waiting 8 seconds...`);
      await sleep(8);

      // Send message
      log(`[${iteration}.2] Sending message...`);
      await sendMessage(sessionId, message);
      log(`[${iteration}.2] Waiting 20 seconds...`);
      await sleep(20);

      log(`--- Iteration ${iteration}/5 completed ---`);
      log("");
    }

    // Step 3: Close session
    log("STEP 3: Closing session");
    await closeSession(sessionId);

    log("=".repeat(60));
    log("Test completed successfully!");
    log("=".repeat(60));
  } catch (error) {
    logError("Test failed", error);

    // Attempt cleanup
    log("Attempting to close session on error...");
    try {
      await closeSession(sessionId);
    } catch (cleanupError) {
      logError("Failed to close session during cleanup", cleanupError);
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runTest().catch((error) => {
    logError("Unhandled error", error);
    process.exit(1);
  });
}

export { runTest, generateSessionId, getBrowserUrl };
