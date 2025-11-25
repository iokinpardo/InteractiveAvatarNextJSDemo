import { getDb } from "./db";

// TTL por defecto: 1 hora (3600 segundos)
const DEFAULT_TTL_SECONDS = 3600;

/**
 * Register a mapping between a custom session ID and HeyGen's session ID
 */
export async function registerSessionMapping(
	customSessionId: string,
	heygenSessionId: string,
	ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
	const trimmedCustom = customSessionId.trim();
	const trimmedHeyGen = heygenSessionId.trim();
	const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

	const db = getDb();
	const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_mappings 
    (custom_session_id, heygen_session_id, expires_at)
    VALUES (?, ?, ?)
  `);

	stmt.run(trimmedCustom, trimmedHeyGen, expiresAt);

	console.log(
		`Registered session mapping: ${trimmedCustom} -> ${trimmedHeyGen}`,
		{
			expiresAt: new Date(expiresAt * 1000).toISOString(),
		},
	);
}

/**
 * Get the HeyGen session ID from a custom session ID
 * Returns the customSessionId if no mapping exists (backward compatibility)
 * Also cleans up expired mappings
 */
export async function getHeyGenSessionId(
	customSessionId: string,
): Promise<string | null> {
	const trimmed = customSessionId.trim();

	const db = getDb();

	// Clean up expired mappings first
	const now = Math.floor(Date.now() / 1000);
	const deleteStmt = db.prepare(`
    DELETE FROM session_mappings 
    WHERE expires_at IS NOT NULL AND expires_at < ?
  `);
	deleteStmt.run(now);

	// Get the mapping
	const stmt = db.prepare(`
    SELECT heygen_session_id 
    FROM session_mappings 
    WHERE custom_session_id = ? 
    AND (expires_at IS NULL OR expires_at >= ?)
  `);

	const result = stmt.get(trimmed, now) as
		| { heygen_session_id: string }
		| undefined;

	if (result) {
		return result.heygen_session_id;
	}

	// If no mapping exists, assume it's already a HeyGen session ID
	// This maintains backward compatibility
	return trimmed;
}

/**
 * Remove a session mapping
 */
export async function unregisterSessionMapping(
	customSessionId: string,
): Promise<void> {
	const trimmed = customSessionId.trim();
	const db = getDb();
	const stmt = db.prepare(
		"DELETE FROM session_mappings WHERE custom_session_id = ?",
	);
	stmt.run(trimmed);
	console.log(`Unregistered session mapping: ${trimmed}`);
}

/**
 * Check if a custom session ID is registered
 */
export async function hasSessionMapping(
	customSessionId: string,
): Promise<boolean> {
	const trimmed = customSessionId.trim();
	const now = Math.floor(Date.now() / 1000);

	const db = getDb();
	const stmt = db.prepare(`
    SELECT 1 
    FROM session_mappings 
    WHERE custom_session_id = ? 
    AND (expires_at IS NULL OR expires_at >= ?)
    LIMIT 1
  `);

	const result = stmt.get(trimmed, now);
	return !!result;
}
