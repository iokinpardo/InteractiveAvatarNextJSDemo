// In-memory session mapping: customSessionId -> heygenSessionId
// In production, consider using Redis or a database for persistence

const sessionMap = new Map<string, string>();

/**
 * Register a mapping between a custom session ID and HeyGen's session ID
 */
export function registerSessionMapping(
  customSessionId: string,
  heygenSessionId: string,
): void {
  sessionMap.set(customSessionId.trim(), heygenSessionId.trim());
  console.log(
    `Registered session mapping: ${customSessionId} -> ${heygenSessionId}`,
  );
}

/**
 * Get the HeyGen session ID from a custom session ID
 * Returns the customSessionId if no mapping exists (backward compatibility)
 */
export function getHeyGenSessionId(
  customSessionId: string,
): string | null {
  const trimmed = customSessionId.trim();
  const heygenId = sessionMap.get(trimmed);

  if (heygenId) {
    return heygenId;
  }

  // If no mapping exists, assume it's already a HeyGen session ID
  // This maintains backward compatibility
  return trimmed;
}

/**
 * Remove a session mapping
 */
export function unregisterSessionMapping(customSessionId: string): void {
  sessionMap.delete(customSessionId.trim());
  console.log(`Unregistered session mapping: ${customSessionId}`);
}

/**
 * Check if a custom session ID is registered
 */
export function hasSessionMapping(customSessionId: string): boolean {
  return sessionMap.has(customSessionId.trim());
}

