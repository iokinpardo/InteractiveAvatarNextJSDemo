import React, { forwardRef } from "react";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({ }, ref) => {

	return (
		<div className="relative w-full h-full overflow-hidden">
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
