# HeyGen Interactive Avatar Next.js Demo

This Next.js 15 sample bootstraps a live HeyGen streaming avatar, mints access tokens through a serverless route, and renders the video feed alongside voice-chat status and diagnostics for easy experimentation.

![HeyGen Interactive Avatar NextJS Demo Screenshot](./public/demo.png)

## Highlights

- **URL-driven avatar overrides** – The page accepts `avatarId` (or `avatar_id`) query parameters, trims them, and forwards the value into the avatar start request so Recall-style integrations can still select the persona from the URL while ignoring knowledge-base prompts.
- **Configurable narration modes** – Choose between conversational voice chat (system prompt + microphone streaming) or webhook-driven narration; mode selection flows through context so the UI, banners, and speech queue stay in sync.
- **Secure token exchange** – Access tokens are fetched on demand from the `/api/get-access-token` route, which calls the HeyGen Streaming API with your `HEYGEN_API_KEY`.
- **Session diagnostics overlay** – The video overlay reports connection quality and webhook messages while keeping the layout focused on the avatar feed.
- **Hook-based session state** – Reusable hooks wrap the Streaming Avatar SDK to manage media streams, message assembly, connection quality, and voice chat in React context.
- **Composable control surfaces** – Ready-made components for avatar/voice configuration, text chat, and microphone toggles can be embedded when you need operator controls.
- **Text task helpers** – Utility hooks expose `TaskType.TALK` and `TaskType.REPEAT` flows for synchronous or asynchronous text-driven interactions.

## Features

### Narration modes: Conversational chat or webhook playback

- **Feature name:** Dual narration modes.
- **Purpose / What it does:** Lets operators toggle between the classic conversational experience (system prompt + microphone streaming) and a webhook playback mode where the avatar simply narrates payloads pushed over SSE.
- **Usage example:**

  ```text
  https://your-demo-host?narrationMode=conversational    # conversational chat with microphone capture
  https://your-demo-host?narrationMode=webhook           # webhook-driven narration (default)
  ```

  While in webhook mode, push narration via the existing SSE webhook endpoint:

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"Agenda item one","botId":"meeting-host"}' \
    https://your-demo-host/api/webhook
  ```

- **Dependencies / breaking changes:** The conversational mode reinstates automatic `startVoiceChat` and knowledge-base prompts; webhook mode keeps microphone and text chat disabled, ignores system prompts, and queues each payload through `/api/webhook/stream` before dispatching a `streaming.task` call with `task_type=repeat` and synchronous delivery so the avatar repeats the text verbatim.

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

- **Feature name:** Seamless expert transitions with consistent agent overlay.
- **Purpose / What it does:** Ensures any active streaming session is stopped before a new expert preset starts and surfaces a uniform “connecting agent…” banner while the new video feed comes online.
- **Usage example:**

  ```text
  https://your-demo-host?expert=finance → switch to …?expert=marketing
  ```

- **Dependencies / breaking changes:** No breaking changes; the connecting banner remains consistent regardless of the selected expert preset.

### Streamlined session layout

- **Feature name:** Streamlined session layout.
- **Purpose / What it does:** Removes the side documentation panel, transcript footer, and stop button so the default experience centers the avatar feed and important status banners without auxiliary controls.
- **Usage example:** Load the home page and interact with the avatar; only the video canvas and warning banners are shown by default.
- **Dependencies / breaking changes:** Operators who need manual stop or transcript controls can wire custom UI by consuming the existing context hooks (`useStreamingAvatarSession`, `useMessageHistory`).

### Webhook overlay messages

- **Feature name:** Webhook overlay messages beside the video feed.
- **Purpose / What it does:** Listens to `/api/webhook/stream` via Server-Sent Events (SSE) inside the `StreamingAvatarProvider`, tracks the most recent payload, and surfaces it in the video overlay so operators see the latest `message` and `botId` without expanding the transcript.
- **Usage example:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"Webhook hello!","botId":"support-bot"}' \
    https://your-demo-host/api/webhook
  ```

- **Dependencies / breaking changes:** Requires the demo to be running so the SSE subscription at `/api/webhook/stream` stays open; webhook payloads are no longer appended to the transcript.

### Agent response overlay toggle

- **Feature name:** Agent response overlay toggle.
- **Purpose / What it does:** Lets operators decide whether the on-video agent response card appears by gating the overlay behind an environment variable.
- **Usage example:**

  ```bash
  NEXT_PUBLIC_DISPLAY_AGENT_RESPONSE=true pnpm dev
  ```

- **Dependencies / breaking changes:** Disabled by default; set `NEXT_PUBLIC_DISPLAY_AGENT_RESPONSE=true` (or `DISPLAY_AGENT_RESPONSE=true` in environments that inject server-side variables into the client bundle) to re-enable the overlay.

## How it works

1. **Query parameters are resolved on the server** and passed into the `InteractiveAvatar` provider before the page renders.
2. **The client requests a streaming token** from `/api/get-access-token`, which calls `v1/streaming.create_token` using your HeyGen API key and base URL.
3. **A `StreamingAvatar` instance is created**, listeners are attached for stream readiness, connection drops, voice activity, and message events, and the session enters the connecting state.
4. **Message events are coalesced per speaker** and stored in context so integrators can wire custom transcripts or analytics without duplicated rows.
5. **Narration mode steers speech delivery**; in conversational mode the SDK opens microphone streaming and uses the supplied system prompt, while webhook mode queues each payload, then triggers `streaming.task` with `task_type=repeat` so the avatar reads the text synchronously with mic capture disabled.
6. **The media stream binds to the `<video>` tag** and displays connection quality overlays so operators can monitor call health.

## URL parameters

- `expert` – Chooses a preset avatar profile. Supported values: `marketing` (default) and `finance`.
- `systemPrompt` or `system_prompt` – Applied as a knowledge base when `narrationMode=conversational`; ignored automatically when `narrationMode=webhook`.
- `avatarId` or `avatar_id` – Overrides the default avatar ID before `createStartAvatar` runs.
- `narrationMode` or `narration_mode` – Switches between `conversational` (system prompt + microphone) and `webhook` (payload narration only).

Public avatar IDs such as `Ann_Therapist_public`, `Shawn_Therapist_public`, `Bryan_FitnessCoach_public`, `Dexter_Doctor_Standing2_public`, and `Elenora_IT_Sitting_public` are included for quick testing, and you can substitute any custom ID you own.

## Project structure

- `app/` – Route handlers (`page.tsx`), the streaming token API route, and global layout/font configuration.
- `components/InteractiveAvatar.tsx` – Entry component that wraps the provider, fetches tokens, initializes the avatar, and renders the primary UI shell.
- `components/AvatarSession/` – Video player, optional message history, microphone toggle, text input, and control toggle components for composing the in-session experience.
- `components/logic/` – Context provider and React hooks that expose session lifecycle, voice chat, message history, conversation state, interrupts, and text tasks.
- `components/AvatarConfig/` – Optional configuration panel components (fields, selects, avatar pickers, voice/STT toggles) ready to drop into an admin surface.
- `app/lib/constants.ts` – Shared avatar catalog and STT language options used by the configuration UI.
- `styles/globals.css` & `tailwind.config.js` – Tailwind setup, font aliases, and baseline list styling for the app shell.

## Environment variables

Create a `.env.local` file (or equivalent in your hosting platform) with:

```dotenv
HEYGEN_API_KEY=sk_live_your_key_here      # Required for /api/get-access-token
NEXT_PUBLIC_BASE_API_URL=https://api.heygen.com
NEXT_PUBLIC_DISPLAY_AGENT_RESPONSE=false  # Set to true to surface the agent response overlay
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
- In webhook mode a banner under the video reminds operators that voice chat is disabled; in conversational mode the component surfaces retry messaging if microphone capture cannot start automatically.
- User and avatar utterances continue to stream through context, so custom dashboards can render transcripts even though the default UI omits them for a cleaner look.
- The video canvas displays connection quality and webhook overlays while keeping the chrome minimal—no stop button or auxiliary controls appear by default.
- Optional UI pieces—`AvatarControls`, `AudioInput`, and `TextInput`—remain available if you want to re-enable microphone or scripted interactions in a custom fork.
- The `useVoiceChat`, `useInterrupt`, and `useConversationState` hooks expose imperative helpers for microphone control, cutting off avatar speech, and driving listening indicators in custom UIs.
- All session state—stream handles, voice chat flags, message history, and connection quality—lives inside `StreamingAvatarProvider`, so any component can consume it via the context hooks.

## Extending the experience

- Update `createDefaultConfig` to change the default avatar, video quality, voice rate/emotion/model, target language, or STT provider globally.
- Mount `AvatarConfig` in your UI to offer runtime controls for avatar IDs, voice settings, languages, and transport choices without editing code.
- Expand the preset avatar or language lists by editing `AVATARS` and `STT_LANGUAGE_LIST`.
- Build custom dashboards or overlays by reading from the shared context (messages, voice chat state, connection quality) and styling them with Tailwind utilities or your own CSS.

## Modifying the avatar in a Recall bot configuration

The Next.js entry page still reads both `systemPrompt` and `avatarId` (or `avatar_id`) from the query string, trims them, and hands the values to the `InteractiveAvatar` component before it renders the session. When `narrationMode=webhook`, `systemPrompt` is intentionally ignored while `avatarId` continues to steer which persona boots; with `narrationMode=conversational` the trimmed prompt is forwarded to the Streaming Avatar SDK as the knowledge base.

Inside `createDefaultConfig`, the selected ID is applied to the `avatarName` field (falling back to `Ann_Therapist_public` when no override is provided) and the knowledge base is only attached when the conversational narration mode is active.

To change the avatar for your Recall configuration you can update the URL to something like:

```
https://interactiveavatarnextjsdemo-rfuq.onrender.com?avatarId=Shawn_Therapist_public
```

Any of the bundled public IDs—such as `Shawn_Therapist_public`, `Bryan_FitnessCoach_public`, or your own custom avatar—will work; the curated list in `app/lib/constants.ts` is a quick reference when you need an ID.

If you want a different default avatar, quality, voice model, or speech-to-text provider for every session, adjust the `createDefaultConfig` implementation (e.g., change `voice.model`, `voice.emotion`, `quality`, or `sttSettings.provider`).

For richer runtime controls you can also compose the existing `AvatarConfig`, `AvatarControls`, `AudioInput`, or `TextInput` components into the UI to expose avatar, voice, and transport settings to operators.

Finally, be sure your deployment still provides the HeyGen API credentials—`HEYGEN_API_KEY` and `NEXT_PUBLIC_BASE_API_URL`—because the client fetches a short-lived access token from `/api/get-access-token` before it starts the stream.

## Testing

⚠️ Not run (QA review only)
