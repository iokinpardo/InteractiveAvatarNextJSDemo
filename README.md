# HeyGen Interactive Avatar Next.js Demo

This Next.js 15 sample bootstraps a live HeyGen streaming avatar, mints access tokens through a serverless route, and renders the video feed alongside voice-chat status and diagnostics for easy experimentation.

![HeyGen Interactive Avatar NextJS Demo Screenshot](./public/demo.png)

## Highlights

- **Dynamic session configuration** – The page accepts `systemPrompt` and `avatarId` (or `avatar_id`) query parameters, trims them, and forwards the values into the avatar start request so Recall-style integrations can drive both the knowledge base and the persona from the URL.
- **Secure token exchange** – Access tokens are fetched on demand from the `/api/get-access-token` route, which calls the HeyGen Streaming API with your `HEYGEN_API_KEY`.
- **Voice chat automation** – The client attempts to open microphone streaming immediately after the avatar connects and surfaces a retry banner if permissions or devices fail.
- **Connection diagnostics overlay** – The video canvas surfaces connection quality status while the streamlined layout focuses on the live avatar feed.
- **Hook-based session state** – Reusable hooks wrap the Streaming Avatar SDK to manage media streams, message assembly, connection quality, and voice chat in React context.
- **Composable control surfaces** – Ready-made components for avatar/voice configuration, text chat, and microphone toggles can be embedded when you need operator controls.
- **Text task helpers** – Utility hooks expose `TaskType.TALK` and `TaskType.REPEAT` flows for synchronous or asynchronous text-driven interactions.

## Features

### Expert presets via query parameter

- **Feature name:** Expert presets via `expert` query parameter.
- **Purpose / What it does:** Selects a preconfigured avatar profile for marketing (default) or finance, bundling avatar ID, system prompt, and voice defaults without requiring additional query parameters.
- **Usage example:**

  ```text
  https://your-demo-host?expert=finance
  ```

- **Dependencies / breaking changes:** No breaking changes; `marketing` remains the default preset so existing URLs continue to work without specifying `expert`.

### Voice overrides via query parameters

- **Purpose:** Allow integrators to adjust the ElevenLabs voice used by the avatar without editing code by providing URL parameters.
- **Usage example:**

  ```text
  https://your-demo-host?voiceId=JBFMnGpgU6AHerx5XYvY&voiceEmotion=soothing&voiceModel=eleven_multilingual_v2
  ```

- **Supported emotions:** `excited`, `serious`, `friendly`, `soothing`, `broadcaster`.
- **Supported ElevenLabs models:** `eleven_flash_v2_5`, `eleven_multilingual_v2`.
- **Dependencies / breaking changes:** Relies on the enumerations exported by `@heygen/streaming-avatar`; defaults remain unchanged when parameters are omitted or invalid.

### Seamless expert transitions

- **Feature name:** Seamless expert transitions with auto-cleanup.
- **Purpose / What it does:** Ensures any active streaming session is stopped before a new expert preset starts and surfaces a dynamic “connecting {expert}…” overlay while the new video feed comes online.
- **Usage example:**

  ```text
  https://your-demo-host?expert=finance → switch to …?expert=marketing
  ```

- **Dependencies / breaking changes:** No breaking changes; the fallback “Connecting to the avatar…” message still appears when no expert preset is active.

### Streamlined session canvas

- **Feature name:** Streamlined session canvas.
- **Purpose / What it does:** Presents a distraction-free avatar view by removing auxiliary panels and transcript UI, keeping focus on the live session while still exposing connection diagnostics.
- **Usage example:** Load the page to see only the avatar canvas and any applicable warnings without sidebars or transcripts.
- **Dependencies / breaking changes:** No breaking changes; hooks for transcripts and controls remain available for custom integrations.

## How it works

1. **Query parameters are resolved on the server** and passed into the `InteractiveAvatar` provider before the page renders.
2. **The client requests a streaming token** from `/api/get-access-token`, which calls `v1/streaming.create_token` using your HeyGen API key and base URL.
3. **A `StreamingAvatar` instance is created**, listeners are attached for stream readiness, connection drops, voice activity, and message events, and the session enters the connecting state.
4. **Message events are coalesced per speaker** and stored in context, so downstream UIs can render transcripts without duplicated rows when needed.
5. **Voice chat starts automatically**; if it fails, the UI exposes controls that retry microphone streaming while keeping the avatar session alive.
6. **The media stream binds to the `<video>` tag** and displays connection quality directly within the canvas for quick diagnostics.

## URL parameters

- `expert` – Chooses a preset avatar profile. Supported values: `marketing` (default) and `finance`.
- `systemPrompt` or `system_prompt` – Sent as the session knowledge base so the avatar can follow custom instructions.
- `avatarId` or `avatar_id` – Overrides the default avatar ID before `createStartAvatar` runs.

Public avatar IDs such as `Ann_Therapist_public`, `Shawn_Therapist_public`, `Bryan_FitnessCoach_public`, `Dexter_Doctor_Standing2_public`, and `Elenora_IT_Sitting_public` are included for quick testing, and you can substitute any custom ID you own.

## Project structure

- `app/` – Route handlers (`page.tsx`), the streaming token API route, and global layout/font configuration.
- `components/InteractiveAvatar.tsx` – Entry component that wraps the provider, fetches tokens, initializes the avatar, and renders the primary UI shell.
- `components/AvatarSession/` – Video player, transcript, microphone toggle, text input, and control toggle components for composing the in-session experience.
- `components/logic/` – Context provider and React hooks that expose session lifecycle, voice chat, message history, conversation state, interrupts, and text tasks.
- `components/AvatarConfig/` – Optional configuration panel components (fields, selects, avatar pickers, voice/STT toggles) ready to drop into an admin surface.
- `app/lib/constants.ts` – Shared avatar catalog and STT language options used by the configuration UI.
- `styles/globals.css` & `tailwind.config.js` – Tailwind setup, font aliases, and baseline list styling for the app shell.

## Environment variables

Create a `.env.local` file (or equivalent in your hosting platform) with:

```dotenv
HEYGEN_API_KEY=sk_live_your_key_here      # Required for /api/get-access-token
NEXT_PUBLIC_BASE_API_URL=https://api.heygen.com
```

`HEYGEN_API_KEY` authorizes the token-minting route, while `NEXT_PUBLIC_BASE_API_URL` tells the client SDK which HeyGen region to use when opening the WebRTC session.

If you plan to use the optional OpenAI-powered helpers, also define `OPENAI_API_KEY`.

## Getting started

1. Install dependencies with your preferred package manager (`pnpm install`, `npm install`, etc.).
2. Add the environment variables above to `.env.local`.
3. Start the development server:

   ```bash
   npm run dev
   ```

   The script is defined in `package.json`, so `pnpm dev` or `yarn dev` will work as well.

4. Build or lint as needed:

   ```bash
   npm run build   # Production bundle
   npm run start   # Serve the production build
   npm run lint    # ESLint checks
   ```

## Using the demo

- When the page loads it automatically fetches a token, initializes `StreamingAvatar`, attaches SDK event listeners, and transitions to the connected state once media is ready.
- If voice chat fails to start (permissions or device issues), a warning banner explains the issue and offers a retry button; retries only affect voice chat, not the avatar session.
- Conversation state remains available through hooks if you want to embed a transcript elsewhere, even though the default view hides it for a cleaner demo.
- The video canvas displays connection quality so operators can monitor link stability without additional UI chrome.
- Optional UI pieces—`AvatarControls`, `AudioInput`, and `TextInput`—let you toggle voice/text chat, mute or unmute the microphone, and send scripted prompts (async/sync talk or repeat tasks).
- The `useVoiceChat`, `useInterrupt`, and `useConversationState` hooks expose imperative helpers for microphone control, cutting off avatar speech, and driving listening indicators in custom UIs.
- All session state—stream handles, voice chat flags, message history, and connection quality—lives inside `StreamingAvatarProvider`, so any component can consume it via the context hooks.

## Extending the experience

- Update `createDefaultConfig` to change the default avatar, video quality, voice rate/emotion/model, target language, or STT provider globally.
- Mount `AvatarConfig` in your UI to offer runtime controls for avatar IDs, voice settings, languages, and transport choices without editing code.
- Expand the preset avatar or language lists by editing `AVATARS` and `STT_LANGUAGE_LIST`.
- Build custom dashboards or overlays by reading from the shared context (messages, voice chat state, connection quality) and styling them with Tailwind utilities or your own CSS.

## Modifying the avatar in a Recall bot configuration

The Next.js entry page reads both `systemPrompt` and `avatarId` (or `avatar_id`) from the query string, trims them, and hands the values to the `InteractiveAvatar` component before it renders the session.

Inside `createDefaultConfig`, the selected ID is applied to the `avatarName` field (falling back to `Ann_Therapist_public` when no override is provided) and the `systemPrompt` is forwarded as the session knowledge base.

To change the avatar for your Recall configuration you can update the URL to something like:

```
https://interactiveavatarnextjsdemo-rfuq.onrender.com?systemPrompt=you%20speak%20just%20in%20poem%20format&avatarId=Shawn_Therapist_public
```

Any of the bundled public IDs—such as `Shawn_Therapist_public`, `Bryan_FitnessCoach_public`, or your own custom avatar—will work; the curated list in `app/lib/constants.ts` is a quick reference when you need an ID.

If you want a different default avatar, quality, voice model, or speech-to-text provider for every session, adjust the `createDefaultConfig` implementation (e.g., change `voice.model`, `voice.emotion`, `quality`, or `sttSettings.provider`).

For richer runtime controls you can also compose the existing `AvatarConfig`, `AvatarControls`, `AudioInput`, or `TextInput` components into the UI to expose avatar, voice, and transport settings to operators.

Finally, be sure your deployment still provides the HeyGen API credentials—`HEYGEN_API_KEY` and `NEXT_PUBLIC_BASE_API_URL`—because the client fetches a short-lived access token from `/api/get-access-token` before it starts the stream.

## Testing

⚠️ Not run (QA review only)
