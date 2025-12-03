#!/usr/bin/env node

/**
 * Production Session Test Script
 *
 * Simulates a production session flow:
 * 1. Opens browser session with custom sessionId
 * 2. Performs 5 iterations of avatar reconfiguration and message sending
 * 3. Closes the session via REST API
 *
 * Note: All API endpoints are now synchronous:
 * - reconfigure-session: Waits up to 60s for client confirmation (includes full reconnection process)
 * - send-message: With taskMode SYNC, waits for speech duration (extracted from HeyGen response)
 * - close-session: Waits up to 15s for client confirmation
 */

const AVATAR_IDS = [
  "Elenora_IT_Sitting_public",
  "Shawn_Therapist_public",
  "Bryan_FitnessCoach_public",
  "Dexter_Doctor_Standing2_public",
  "Ann_Therapist_public",
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

interface CliArgs {
  host?: string;
  sessionId?: string;
}

function parseCliArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--host=")) {
      args.host = arg.substring(7);
    } else if (arg === "--host" && i + 1 < argv.length) {
      args.host = argv[++i];
    } else if (arg.startsWith("--session-id=")) {
      args.sessionId = arg.substring(13);
    } else if (arg === "--session-id" && i + 1 < argv.length) {
      args.sessionId = argv[++i];
    }
  }

  return args;
}

function getBaseUrl(cliHost?: string): string {
  // Priority: CLI arg > env var > default
  return (
    cliHost ||
    process.env.TEST_BASE_URL ||
    "http://localhost:3000"
  );
}

async function apiCall(
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown,
  baseUrl?: string,
): Promise<ApiResponse> {
  const url = `${baseUrl || getBaseUrl()}${endpoint}`;

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
  baseUrl?: string,
): Promise<void> {
  log(`Reconfiguring session ${sessionId} with avatar ${avatarId}`);
  log("(This will wait up to 60s for the client to confirm reconfiguration)");
  await apiCall(
    "/api/avatar/reconfigure-session",
    "POST",
    {
      sessionId,
      config: {
        avatarId,
      },
    },
    baseUrl,
  );
  log(`Session reconfigured successfully (client confirmed)`);
}

async function sendMessage(
  sessionId: string,
  message: string,
  baseUrl?: string,
): Promise<void> {
  log(`Sending message to session ${sessionId}`);
  log(
    "(With taskMode SYNC, this will wait for the speech duration from HeyGen response)",
  );
  await apiCall(
    "/api/avatar/send-message",
    "POST",
    {
      sessionId,
      message,
      taskType: "REPEAT",
      taskMode: "SYNC",
    },
    baseUrl,
  );
  log(`Message sent successfully (speech duration elapsed)`);
}

async function closeSession(
  sessionId: string,
  baseUrl?: string,
): Promise<void> {
  log(`Closing session ${sessionId}`);
  log("(This will wait up to 15s for the client to confirm closure)");
  await apiCall(
    "/api/avatar/close-session",
    "POST",
    {
      sessionId,
    },
    baseUrl,
  );
  log(`Session closed successfully (client confirmed)`);
}

function generateSessionId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getBrowserUrl(sessionId: string, baseUrl?: string): string {
  return `${baseUrl || getBaseUrl()}?sessionId=${encodeURIComponent(sessionId)}`;
}

async function waitForSessionConnection(
  sessionId: string,
  waitSeconds: number = 20,
): Promise<void> {
  log(`Waiting ${waitSeconds} seconds for session ${sessionId} to connect...`);
  log("(Session registration happens client-side when the browser page loads)");
  log("(This initial wait is only for the browser to load and establish the session)");

  // Wait for the browser to load and register the session
  // The session registration happens automatically when the InteractiveAvatar component
  // connects to HeyGen and calls the register-session endpoint
  // Note: After this initial wait, all API calls are synchronous
  for (let i = 0; i < waitSeconds; i++) {
    await sleep(1);
    if ((i + 1) % 5 === 0) {
      log(`  ... ${i + 1}/${waitSeconds} seconds elapsed`);
    }
  }

  log("Session connection wait complete. Proceeding with test...");
  log("(All subsequent API calls will wait synchronously for completion)");
}

async function runTest(sessionId?: string, baseUrl?: string): Promise<void> {
  // Priority: provided sessionId > env var > generated
  const finalSessionId =
    sessionId || process.env.SESSION_ID || generateSessionId();
  const finalBaseUrl = baseUrl || getBaseUrl();
  const browserUrl = getBrowserUrl(finalSessionId, finalBaseUrl);

  log("=".repeat(60));
  log("Starting Production Session Test");
  log("=".repeat(60));
  log(`Session ID: ${finalSessionId}`);
  log(`Base URL: ${finalBaseUrl}`);
  log(`Browser URL: ${browserUrl}`);
  log("");

  try {
    // Step 1: Perform 5 iterations
    log(
      "STEP 1: Starting 5 iterations of avatar reconfiguration and messaging",
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

      // Change avatar configuration (synchronous - waits for client confirmation)
      log(`[${iteration}.1] Reconfiguring avatar...`);
      await reconfigureSession(finalSessionId, avatarId, finalBaseUrl);
      log(`[${iteration}.1] Reconfiguration complete`);

      // Send message (synchronous with SYNC mode - waits for avatar to finish speaking)
      log(`[${iteration}.2] Sending message...`);
      await sendMessage(finalSessionId, message, finalBaseUrl);
      log(`[${iteration}.2] Message delivery complete`);

      log(`--- Iteration ${iteration}/5 completed ---`);
      log("");
    }

    // Step 2: Close session
    log("STEP 2: Closing session");
    await closeSession(finalSessionId, finalBaseUrl);

    log("=".repeat(60));
    log("Test completed successfully!");
    log("=".repeat(60));
  } catch (error) {
    logError("Test failed", error);

    // Attempt cleanup
    log("Attempting to close session on error...");
    try {
      await closeSession(finalSessionId, finalBaseUrl);
    } catch (cleanupError) {
      logError("Failed to close session during cleanup", cleanupError);
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  const cliArgs = parseCliArgs();
  // Priority: CLI arg > env var > default (handled by getBaseUrl)
  const baseUrl = cliArgs.host ? getBaseUrl(cliArgs.host) : undefined;
  // Priority: CLI arg > env var > generated (handled by runTest)
  const sessionId = cliArgs.sessionId;

  runTest(sessionId, baseUrl).catch((error) => {
    logError("Unhandled error", error);
    process.exit(1);
  });
}

export { runTest, generateSessionId, getBrowserUrl };
