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

