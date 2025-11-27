import { getDb } from "./db";

// TTL for configs: 1 hour (3600 seconds)
// Configs are automatically cleaned up after this time
const CONFIG_TTL_SECONDS = 3600;

export type SessionConfigUpdate = {
	avatarId?: string;
	systemPrompt?: string;
	narrationMode?: "conversational" | "webhook";
	voiceOverrides?: {
		voiceId?: string;
		emotion?: string;
		model?: string;
	};
	quality?: string;
	language?: string;
	// Allow other StartAvatarRequest parameters
	[key: string]: unknown;
};

/**
 * Store a configuration update for a session
 */
export async function storeConfigUpdate(
	customSessionId: string,
	config: SessionConfigUpdate,
): Promise<void> {
	const trimmed = customSessionId.trim();
	const db = getDb();
	const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_config_updates 
    (custom_session_id, config, created_at, consumed_at)
    VALUES (?, ?, ?, NULL)
  `);

	const configJson = JSON.stringify(config);
	const now = Math.floor(Date.now() / 1000);

	stmt.run(trimmed, configJson, now);

	console.log(`Stored config update for session: ${trimmed}`, {
		config,
		createdAt: new Date(now * 1000).toISOString(),
	});
}

/**
 * Get a pending configuration update for a session
 * Used when client reconnects and needs to retrieve configs that were stored
 * while the client was disconnected
 */
export async function getConfigUpdate(
	customSessionId: string,
): Promise<SessionConfigUpdate | null> {
	const trimmed = customSessionId.trim();
	const db = getDb();

	// Clean up expired configs first
	await cleanupExpiredConfigs();

	const stmt = db.prepare(`
    SELECT config, created_at
    FROM session_config_updates 
    WHERE custom_session_id = ? 
    AND consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);

	const result = stmt.get(trimmed) as
		| { config: string; created_at: number }
		| undefined;

	if (!result) {
		return null;
	}

	try {
		const config = JSON.parse(result.config) as SessionConfigUpdate;
		return config;
	} catch (error) {
		console.error(
			`Failed to parse config for session ${trimmed}:`,
			error,
		);
		return null;
	}
}

/**
 * Clean up expired configuration updates
 * Configs older than CONFIG_TTL_SECONDS are automatically deleted
 */
export async function cleanupExpiredConfigs(): Promise<void> {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	// Delete configs older than TTL (regardless of consumed_at status)
	const threshold = now - CONFIG_TTL_SECONDS;
	const deleteStmt = db.prepare(`
    DELETE FROM session_config_updates 
    WHERE created_at < ?
  `);
	const deleted = deleteStmt.run(threshold).changes;

	if (deleted > 0) {
		console.log(`Cleaned up ${deleted} expired config(s)`);
	}
}

/**
 * Check if there's a pending configuration update for a session
 */
export async function hasPendingConfigUpdate(
	customSessionId: string,
): Promise<boolean> {
	const trimmed = customSessionId.trim();
	const db = getDb();

	// Clean up expired configs first
	await cleanupExpiredConfigs();

	const stmt = db.prepare(`
    SELECT 1 
    FROM session_config_updates 
    WHERE custom_session_id = ? 
    AND consumed_at IS NULL
    LIMIT 1
  `);

	const result = stmt.get(trimmed);
	return !!result;
}

