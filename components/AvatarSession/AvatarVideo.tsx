import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { SessionIdDisplay } from "./SessionIdDisplay";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({ }, ref) => {
	const { connectionQuality } = useConnectionQuality();

	const shouldShowConnectionQuality =
		connectionQuality !== ConnectionQuality.UNKNOWN;

	return (
		<div className="relative w-full h-full overflow-hidden">
			{shouldShowConnectionQuality ? (
				<div className="absolute top-3 left-3 z-10 rounded-md bg-black/60 text-white px-2 py-1">
					<p className="text-xs m-0">Connection Quality: {connectionQuality}</p>
				</div>
			) : null}
			<SessionIdDisplay />
			<video
				ref={ref}
				autoPlay
				playsInline
				className="absolute inset-0 w-full h-full object-contain pointer-events-none"
			>
				<track kind="captions" />
			</video>
		</div>
	);
});
AvatarVideo.displayName = "AvatarVideo";
