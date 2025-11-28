"use client";

import {
	AvatarQuality,
	StreamingEvents,
	VoiceChatTransport,
	VoiceEmotion,
	StartAvatarRequest,
	STTProvider,
	ElevenLabsModel,
} from "@heygen/streaming-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import {
	NarrationMode,
	StreamingAvatarProvider,
	StreamingAvatarSessionState,
	useStreamingAvatarContext,
} from "./logic";
import { LoadingIcon } from "./Icons";
import { useVoiceChat } from "./logic/useVoiceChat";
import { useSessionReconfiguration } from "./logic/useSessionReconfiguration";
import type { SessionConfigUpdate } from "@/app/lib/sessionConfig";

type CreateDefaultConfigArgs = {
	systemPrompt?: string;
	avatarId?: string;
	voiceOverrides?: VoiceOverrides;
};

export type VoiceOverrides = Partial<
	Pick<
		NonNullable<StartAvatarRequest["voice"]>,
		"voiceId" | "emotion" | "model"
	>
>;

const sanitizeVoiceOverrides = (
	overrides?: VoiceOverrides,
): VoiceOverrides | undefined => {
	if (!overrides) {
		return undefined;
	}

	const sanitized: VoiceOverrides = {};

	if (overrides.voiceId?.trim()) {
		sanitized.voiceId = overrides.voiceId.trim();
	}

	if (overrides.emotion) {
		sanitized.emotion = overrides.emotion;
	}

	if (overrides.model) {
		sanitized.model = overrides.model;
	}

	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const createDefaultConfig = ({
	systemPrompt,
	avatarId,
	voiceOverrides,
}: CreateDefaultConfigArgs): StartAvatarRequest => ({
	quality: AvatarQuality.Medium,
	avatarName: avatarId ?? "Ann_Therapist_public",
	knowledgeId: undefined,
	...(systemPrompt ? { knowledgeBase: systemPrompt } : {}),
	voice: {
		rate: 1.5,
		emotion: voiceOverrides?.emotion ?? VoiceEmotion.EXCITED,
		model: voiceOverrides?.model ?? ElevenLabsModel.eleven_flash_v2_5,
		...(voiceOverrides?.voiceId ? { voiceId: voiceOverrides.voiceId } : {}),
	},
	language: "en",
	voiceChatTransport: VoiceChatTransport.WEBSOCKET,
	sttSettings: {
		provider: STTProvider.DEEPGRAM,
	},
	activityIdleTimeout: 300, // 5 minutes in seconds
});

type InteractiveAvatarProps = {
	systemPrompt?: string;
	avatarId?: string;
	voiceOverrides?: VoiceOverrides;
	expertName?: string;
	narrationMode: NarrationMode;
	sessionId?: string;
};

function InteractiveAvatar({
	systemPrompt,
	avatarId,
	voiceOverrides,
	expertName: _expertName,
	narrationMode,
	sessionId: customSessionId,
}: InteractiveAvatarProps) {
	const {
		initAvatar,
		startAvatar,
		stopAvatar,
		closeSession,
		sessionState,
		stream,
		sessionId: heygenSessionId,
	} = useStreamingAvatarSession();
	const {
		customSessionId: contextCustomSessionId,
		setCustomSessionId,
		pendingConfigUpdate,
		setPendingConfigUpdate,
		isExplicitlyClosed,
	} = useStreamingAvatarContext();
	const { startVoiceChat } = useVoiceChat();

	// Subscribe to session reconfiguration events
	useSessionReconfiguration();

	const mediaStream = useRef<HTMLVideoElement>(null);
	const hasStarted = useRef(false);
	const latestStartRequestIdRef = useRef(0);
	const isStartingRef = useRef(false);
	const [sessionError, setSessionError] = useState<string | null>(null);
	const [voiceChatWarning, setVoiceChatWarning] = useState<string | null>(null);
	const isInitializing = useRef(false);

	// Merge pending config with props (pending config takes precedence)
	const effectiveConfig = useMemo(() => {
		if (!pendingConfigUpdate) {
			return {
				avatarId: avatarId?.trim() || undefined,
				systemPrompt: systemPrompt?.trim() || undefined,
				voiceOverrides: sanitizeVoiceOverrides(voiceOverrides),
				narrationMode,
			};
		}

		// Merge pending config with props
		const merged: {
			avatarId?: string;
			systemPrompt?: string;
			voiceOverrides?: VoiceOverrides;
			narrationMode: NarrationMode;
		} = {
			avatarId:
				pendingConfigUpdate.avatarId?.trim() ||
				avatarId?.trim() ||
				undefined,
			systemPrompt:
				pendingConfigUpdate.systemPrompt?.trim() ||
				systemPrompt?.trim() ||
				undefined,
			narrationMode:
				pendingConfigUpdate.narrationMode === "conversational"
					? NarrationMode.CONVERSATIONAL
					: pendingConfigUpdate.narrationMode === "webhook"
						? NarrationMode.WEBHOOK
						: narrationMode,
		};

		// Merge voice overrides
		const pendingVoiceOverrides = pendingConfigUpdate.voiceOverrides;
		const propsVoiceOverrides = sanitizeVoiceOverrides(voiceOverrides);
		if (pendingVoiceOverrides || propsVoiceOverrides) {
			merged.voiceOverrides = {
				...(propsVoiceOverrides ?? {}),
				...(pendingVoiceOverrides
					? {
							...(pendingVoiceOverrides.voiceId
								? { voiceId: pendingVoiceOverrides.voiceId.trim() }
								: {}),
							...(pendingVoiceOverrides.emotion
								? {
										emotion: pendingVoiceOverrides.emotion as VoiceEmotion,
									}
								: {}),
							...(pendingVoiceOverrides.model
								? {
										model: pendingVoiceOverrides.model as ElevenLabsModel,
									}
								: {}),
						}
					: {}),
			};
		}

		return merged;
	}, [pendingConfigUpdate, avatarId, systemPrompt, voiceOverrides, narrationMode]);

	const sanitizedSystemPrompt = useMemo(
		() => effectiveConfig.systemPrompt,
		[effectiveConfig.systemPrompt],
	);
	const sanitizedAvatarId = useMemo(
		() => effectiveConfig.avatarId,
		[effectiveConfig.avatarId],
	);
	const sanitizedVoiceOverrides = useMemo(
		() => effectiveConfig.voiceOverrides,
		[effectiveConfig.voiceOverrides],
	);
	const effectiveNarrationMode = useMemo(
		() => effectiveConfig.narrationMode,
		[effectiveConfig.narrationMode],
	);

	const sessionInputsSignature = useMemo(
		() =>
			JSON.stringify({
				avatarId: sanitizedAvatarId ?? null,
				systemPrompt:
					effectiveNarrationMode === NarrationMode.CONVERSATIONAL
						? (sanitizedSystemPrompt ?? null)
						: null,
				voiceOverrides: sanitizedVoiceOverrides ?? null,
				narrationMode: effectiveNarrationMode,
				hasPendingConfig: !!pendingConfigUpdate,
			}),
		[
			effectiveNarrationMode,
			sanitizedAvatarId,
			sanitizedSystemPrompt,
			sanitizedVoiceOverrides,
			pendingConfigUpdate,
		],
	);

	const getErrorMessage = (error: unknown) => {
		if (error instanceof Error && error.message) {
			return error.message;
		}

		if (typeof error === "string") {
			return error;
		}

		return "Unknown error occurred.";
	};

	async function fetchAccessToken() {
		try {
			const response = await fetch("/api/get-access-token", {
				method: "POST",
			});
			const token = await response.text();

			return token;
		} catch (error) {
			console.error("Error fetching access token:", error);
			throw error;
		}
	}

	const startSession = useMemoizedFn(async () => {
		const requestId = ++latestStartRequestIdRef.current;

		try {
			setSessionError(null);
			setVoiceChatWarning(null);
			isInitializing.current = true;

			// If there's an active session, stop it first and wait for it to become inactive
			if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
				console.log(
					"Stopping active session before starting new one. Current state:",
					sessionState,
				);
				await stopAvatar();
				
				// Wait a reasonable time for stopAvatar to complete and state to update
				// stopAvatar sets state to DISCONNECTING, then INACTIVE
				// We wait enough time for React to process the state updates
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Check if this request is still valid
				if (latestStartRequestIdRef.current !== requestId) {
					return;
				}
			}

			const tokenPromise = fetchAccessToken();

			if (latestStartRequestIdRef.current !== requestId) {
				return;
			}

			const newToken = await tokenPromise;
			const avatar = initAvatar(newToken);

			avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
				console.log("Avatar started talking", e);
			});
			avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
				console.log("Avatar stopped talking", e);
			});
			avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
				console.log("Stream disconnected");
			});
			avatar.on(StreamingEvents.STREAM_READY, (event) => {
				console.log(">>>>> Stream ready:", event.detail);
			});
			avatar.on(StreamingEvents.USER_START, (event) => {
				console.log(">>>>> User started talking:", event);
			});
			avatar.on(StreamingEvents.USER_STOP, (event) => {
				console.log(">>>>> User stopped talking:", event);
			});
			avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
				console.log(">>>>> User end message:", event);
			});
			avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
				console.log(">>>>> User talking message:", event);
			});
			avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
				console.log(">>>>> Avatar talking message:", event);
			});
			avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
				console.log(">>>>> Avatar end message:", event);
			});

			const startConfig = createDefaultConfig({
				systemPrompt:
					effectiveNarrationMode === NarrationMode.CONVERSATIONAL
						? sanitizedSystemPrompt
						: undefined,
				avatarId: sanitizedAvatarId,
				voiceOverrides: sanitizedVoiceOverrides,
			});

			// Apply additional config from pending update if available
			if (pendingConfigUpdate) {
				if (pendingConfigUpdate.quality) {
					startConfig.quality = pendingConfigUpdate.quality as AvatarQuality;
				}
				if (pendingConfigUpdate.language) {
					startConfig.language = pendingConfigUpdate.language;
				}
				// Add other StartAvatarRequest fields as needed
			}

			if (
				sanitizedSystemPrompt &&
				effectiveNarrationMode === NarrationMode.CONVERSATIONAL
			) {
				console.log(
					"Applying system prompt as knowledgeBase",
					sanitizedSystemPrompt,
				);
			}

			if (sanitizedAvatarId) {
				console.log("Using avatar override", sanitizedAvatarId);
			}

			if (sanitizedVoiceOverrides) {
				console.log("Applying voice overrides", sanitizedVoiceOverrides);
			}

			if (pendingConfigUpdate) {
				console.log("Using pending configuration update", pendingConfigUpdate);
				// Clear pending config after using it
				setPendingConfigUpdate(null);
			}

			if (latestStartRequestIdRef.current !== requestId) {
				return;
			}

			await startAvatar(startConfig);

			if (latestStartRequestIdRef.current !== requestId) {
				return;
			}

			if (effectiveNarrationMode === NarrationMode.CONVERSATIONAL) {
				try {
					await startVoiceChat();
					if (latestStartRequestIdRef.current !== requestId) {
						return;
					}
					setVoiceChatWarning(null);
				} catch (voiceChatError) {
					if (latestStartRequestIdRef.current !== requestId) {
						return;
					}
					const warningMessage =
						"Voice chat could not start automatically. The avatar is running without microphone input.";

					console.warn(warningMessage, voiceChatError);
					setVoiceChatWarning(
						`${warningMessage} (${getErrorMessage(voiceChatError)})`,
					);
				}
			}
		} catch (error) {
			if (latestStartRequestIdRef.current !== requestId) {
				return;
			}

			hasStarted.current = false;
			isInitializing.current = false;
			isStartingRef.current = false; // Reset flag on error
			const message = getErrorMessage(error);

			setSessionError(message);
			console.error("Error starting avatar session:", error);
		}
	});

	const handleRetrySession = useMemoizedFn(() => {
		if (sessionState === StreamingAvatarSessionState.CONNECTING) {
			return;
		}

		hasStarted.current = true;
		startSession();
	});

	const handleRetryVoiceChat = useMemoizedFn(async () => {
		if (effectiveNarrationMode !== NarrationMode.CONVERSATIONAL) {
			return;
		}

		if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
			return;
		}

		try {
			await startVoiceChat();
			setVoiceChatWarning(null);
		} catch (error) {
			const retryMessage = "Voice chat is still unavailable.";

			console.warn(retryMessage, error);
			setVoiceChatWarning(`${retryMessage} (${getErrorMessage(error)})`);
		}
	});

	useEffect(() => {
		// Prevent starting if session is already connecting or connected
		// This prevents race conditions when pending config triggers startSession
		// while the initial session is still starting
		if (
			sessionState === StreamingAvatarSessionState.CONNECTING ||
			sessionState === StreamingAvatarSessionState.CONNECTED
		) {
			// Session is already active or starting, reset flag
			isStartingRef.current = false;
			return;
		}

		// Only auto-start if:
		// 1. There's a customSessionId in props
		// 2. Session state is INACTIVE (no active session)
		// 3. Not explicitly closed (prevents restart after close or timeout)
		// 4. Not already starting (prevents double start from React Strict Mode or race conditions)
		if (!customSessionId) {
			return;
		}

		if (isExplicitlyClosed) {
			// Session was explicitly closed or timed out, don't auto-restart
			return;
		}

		// Prevent multiple simultaneous starts (e.g., from React Strict Mode double mounting)
		if (isStartingRef.current) {
			console.log("Session start already in progress, skipping duplicate start");
			return;
		}

		isStartingRef.current = true;
		startSession()
			.catch((error) => {
				// Error is already handled in startSession, just reset flag
				console.error("Error in startSession from useEffect:", error);
			})
			.finally(() => {
				// Reset flag after start completes (success or failure)
				// Use setTimeout to ensure state has updated
				setTimeout(() => {
					isStartingRef.current = false;
				}, 100);
			});
	}, [sessionInputsSignature, startSession, sessionState, customSessionId, isExplicitlyClosed]);

	useEffect(() => {
		if (
			effectiveNarrationMode === NarrationMode.WEBHOOK &&
			sanitizedSystemPrompt
		) {
			console.info(
				"System prompts are ignored in webhook narration mode. Webhook messages fully control narration.",
			);
		}
	}, [effectiveNarrationMode, sanitizedSystemPrompt]);

	// Set customSessionId in context when available from props
	// This ensures the context has the sessionId for SSE subscription and other operations
	useEffect(() => {
		if (customSessionId) {
			setCustomSessionId(customSessionId);
		}
	}, [customSessionId, setCustomSessionId]);

	// Register session mapping when both customSessionId and heygenSessionId are available
	useEffect(() => {
		if (
			!customSessionId ||
			!heygenSessionId ||
			sessionState !== StreamingAvatarSessionState.CONNECTED
		) {
			return;
		}

		let isCancelled = false;
		let retryCount = 0;
		const MAX_RETRIES = 3;
		const RETRY_DELAY = 1000; // 1 second

		const registerMapping = async () => {
			if (isCancelled) {
				return;
			}

			try {
				const response = await fetch("/api/avatar/register-session", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						customSessionId: customSessionId,
						heygenSessionId: heygenSessionId,
					}),
				});

				if (response.ok) {
					console.log(
						`Registered session mapping: ${customSessionId} -> ${heygenSessionId}`,
					);
				} else if (response.status === 409) {
					// Mapping already exists - this is OK if it's the same mapping
					const data = await response.json().catch(() => ({}));
					console.log(
						`Session mapping already exists: ${customSessionId} -> ${heygenSessionId}`,
						data,
					);
				} else {
					// Retry on other errors
					const errorText = await response.text().catch(() => response.statusText);
					console.warn(
						`Failed to register session mapping (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
						response.status,
						errorText,
					);

					if (retryCount < MAX_RETRIES && !isCancelled) {
						retryCount++;
						setTimeout(() => {
							if (!isCancelled) {
								registerMapping();
							}
						}, RETRY_DELAY);
					} else {
						console.error(
							`Failed to register session mapping after ${MAX_RETRIES} attempts`,
						);
					}
				}
			} catch (error) {
				console.error("Error registering session mapping:", error);

				// Retry on network errors
				if (retryCount < MAX_RETRIES && !isCancelled) {
					retryCount++;
					setTimeout(() => {
						if (!isCancelled) {
							registerMapping();
						}
					}, RETRY_DELAY);
				}
			}
		};

		registerMapping();

		return () => {
			isCancelled = true;
		};
	}, [customSessionId, heygenSessionId, sessionState]);

	// Handle window close cleanup
	useEffect(() => {
		if (!customSessionId) {
			return;
		}

		const cleanupSession = () => {
			if (
				customSessionId &&
				sessionState === StreamingAvatarSessionState.CONNECTED
			) {
				// Use sendBeacon for reliable delivery during page unload
				// sendBeacon doesn't support custom headers, so we'll use FormData or URLSearchParams
				// However, our API expects JSON, so we'll use fetch with keepalive as fallback
				const data = JSON.stringify({ sessionId: customSessionId });
				
				// Try sendBeacon first (works with FormData or Blob)
				const blob = new Blob([data], { type: "application/json" });
				const sent = navigator.sendBeacon(
					"/api/avatar/close-session",
					blob,
				);
				
				// If sendBeacon failed, try fetch with keepalive
				if (!sent) {
					fetch("/api/avatar/close-session", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: data,
						keepalive: true,
					}).catch((error) => {
						// Silently fail - we're in unload, can't do much
						console.error("Error closing session on page unload:", error);
					});
				}
			}
		};

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			cleanupSession();
		};

		const handlePageHide = (event: PageTransitionEvent) => {
			// pagehide fires before beforeunload in some browsers
			cleanupSession();
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		window.addEventListener("pagehide", handlePageHide);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			window.removeEventListener("pagehide", handlePageHide);
		};
	}, [customSessionId, sessionState]);

	useUnmount(() => {
		// Also try to close session on component unmount if customSessionId exists
		if (customSessionId && sessionState === StreamingAvatarSessionState.CONNECTED) {
			closeSession(customSessionId).catch((error) => {
				console.error("Error closing session on unmount:", error);
				// Fallback to just stopping locally
				stopAvatar();
			});
		} else {
			stopAvatar();
		}
		// Clear customSessionId on unmount for cleanup
		if (customSessionId) {
			setCustomSessionId(null);
		}
	});

	useEffect(() => {
		if (stream && mediaStream.current) {
			mediaStream.current.srcObject = stream;
			mediaStream.current.onloadedmetadata = () => {
				mediaStream.current!.play();
			};
			// Mark initialization as complete when stream is ready
			isInitializing.current = false;
		}
	}, [mediaStream, stream]);

	// Reset initialization flag when session state changes to CONNECTED
	useEffect(() => {
		if (sessionState === StreamingAvatarSessionState.CONNECTED) {
			isInitializing.current = false;
		}
	}, [sessionState]);

	return (
		<div className="relative h-full w-full">
			<AvatarVideo ref={mediaStream} />
			{sessionState !== StreamingAvatarSessionState.CONNECTED ? (
				<div
					aria-live="polite"
					className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 px-6 text-center"
				>
					{sessionError ? (
						<>
							<span className="text-sm font-semibold text-red-200">
								Unable to start the avatar session
							</span>
							<p className="text-xs text-red-200/80">{sessionError}</p>
							<button
								className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-100 transition hover:border-red-300 hover:bg-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
								type="button"
								onClick={handleRetrySession}
							>
								Try again
							</button>
						</>
					) : sessionState === StreamingAvatarSessionState.CONNECTING ? (
						<>
							<LoadingIcon className="animate-spin" />
							<span className="text-sm text-zinc-300">connecting agent…</span>
						</>
					) : sessionState === StreamingAvatarSessionState.DISCONNECTING ? (
						<>
							<LoadingIcon className="animate-spin" />
							<span className="text-sm text-zinc-300">Disconnecting…</span>
						</>
					) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
						isInitializing.current ? (
							<>
								<LoadingIcon className="animate-spin" />
								<span className="text-sm text-zinc-300">connecting agent…</span>
							</>
						) : (
							<span className="text-sm text-zinc-300">Disconnected</span>
						)
					) : null}
				</div>
			) : null}
			{effectiveNarrationMode === NarrationMode.WEBHOOK ? (
				<div className="absolute bottom-0 left-0 w-full box-border p-3 flex justify-center items-center">
					<div className="rounded-md border border-slate-800 bg-slate-800 px-2 py-1 text-sm text-slate-300">
						<p className="text-left">
							Voice interactions are disabled. The avatar will response to
							chat-messages only.
						</p>
					</div>
				</div>
			) : null}
			{effectiveNarrationMode === NarrationMode.CONVERSATIONAL && voiceChatWarning ? (
				<div className="absolute bottom-0 left-0 w-full box-border p-3 flex justify-center items-center">
					<div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
						<p className="mb-3 text-left">{voiceChatWarning}</p>
						<button
							className="rounded-full border border-amber-400/40 bg-transparent px-3 py-1 text-xs font-medium text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
							type="button"
							onClick={handleRetryVoiceChat}
						>
							Retry voice chat
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

type InteractiveAvatarWrapperProps = {
	systemPrompt?: string;
	avatarId?: string;
	voiceOverrides?: VoiceOverrides;
	expertName?: string;
	narrationMode?: NarrationMode;
	sessionId?: string;
};

export default function InteractiveAvatarWrapper({
	systemPrompt,
	avatarId,
	voiceOverrides,
	expertName,
	narrationMode = NarrationMode.CONVERSATIONAL,
	sessionId,
}: InteractiveAvatarWrapperProps) {
	return (
		<StreamingAvatarProvider
			basePath={process.env.NEXT_PUBLIC_BASE_API_URL}
			narrationMode={narrationMode}
		>
			<InteractiveAvatar
				avatarId={avatarId}
				expertName={expertName}
				narrationMode={narrationMode}
				systemPrompt={systemPrompt}
				voiceOverrides={voiceOverrides}
				sessionId={sessionId}
			/>
		</StreamingAvatarProvider>
	);
}
