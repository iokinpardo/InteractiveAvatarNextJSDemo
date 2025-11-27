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

### Responsive avatar switching

- **Feature name:** Responsive avatar switching with consistent agent overlay.
- **Purpose / What it does:** Tears down the previous streaming session before booting a new one whenever `avatarId`, expert presets, or narration inputs change so the video feed never stalls on quick successive swaps, all while keeping the “connecting agent…” banner stable during reconnects.
- **Usage example:**

  ```text
  https://your-demo-host?avatar_id=Graham_Chair_Sitting_public → swap to …?avatar_id=Anastasia_Chair_Sitting_public
  ```

- **Dependencies / breaking changes:** No breaking changes; the consistent connecting banner and webhook disclaimer still apply regardless of how often the avatar profile changes.

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

## Session management

The application supports custom session IDs for tracking and managing avatar sessions across multiple clients or browser tabs.

### Custom session IDs

- **URL parameter:** `sessionId` – A custom identifier for the session that is mapped to HeyGen's internal session ID.
- **Purpose:** Allows external systems to reference and manage sessions using meaningful identifiers instead of HeyGen's generated session IDs.
- **Usage example:**

  ```text
  https://your-demo-host?sessionId=user-123-meeting-456
  ```

### Session mapping behavior

When a session is started with a `customSessionId`:

1. **Session registration:** Once the session connects, the application automatically registers a mapping between the `customSessionId` and HeyGen's `heygenSessionId` in a local database.
2. **Mapping storage:** Mappings are stored with a default TTL of 1 hour (3600 seconds) and are automatically cleaned up when expired.
3. **Idempotent registration:** If the same `customSessionId` and `heygenSessionId` combination is registered again, the operation is idempotent and returns success.

### Handling duplicate session IDs

When a new session is started with a `customSessionId` that is already mapped to a different `heygenSessionId`:

1. **Automatic cleanup:** The system automatically attempts to close the previous HeyGen session via the API.
2. **Mapping replacement:** The old mapping is unregistered from the database, and the new mapping is registered.
3. **No client notification:** The previous client (browser tab/window) that had the session is **not automatically notified**. The old session will be disconnected when:
   - The stream detects the session was closed (via stream state monitoring)
   - The client attempts to interact with the session and discovers it's no longer valid
   - The session times out due to inactivity

**Important considerations:**

- **Race conditions:** If two clients attempt to start sessions with the same `customSessionId` simultaneously, the last one to register will replace the previous mapping.
- **Client state:** The previous client may continue to show a connected state until it detects the stream has been closed.
- **Best practice:** Use unique `customSessionId` values per active session, or implement client-side logic to handle session displacement gracefully.

### Session timeout handling

- **Activity timeout:** Sessions have an `activityIdleTimeout` of 5 minutes (300 seconds). If no activity occurs, HeyGen will automatically close the session.
- **Automatic cleanup:** When a session times out:
  - The stream disconnection is detected by the client
  - The application automatically calls the close session API to clean up the HeyGen session
  - The session mapping is unregistered from the database
  - Local session state is reset

### Window close cleanup

When a browser window or tab is closed:

- **Automatic cleanup:** The application attempts to close the session via the API using `navigator.sendBeacon()` or `fetch()` with `keepalive: true` to ensure the request completes even during page unload.
- **Fallback:** If the API call fails (e.g., network issues), the session mapping will expire after the TTL (1 hour) and be cleaned up automatically.
- **Component unmount:** When the React component unmounts, it also attempts to close the session if a `customSessionId` is present.

### Abandoned sessions and client failures

When a session is abandoned or the client fails unexpectedly:

- **Mapping persistence:** Session mappings remain in the database until they expire (default: 1 hour after registration), even if the client disconnects or crashes.
- **Lazy cleanup:** Expired mappings are automatically removed when:
  - A new session lookup occurs (`getHeyGenSessionId`)
  - The mapping list is queried (`listActiveMappings`)
  - Any database operation checks for active mappings
- **No proactive cleanup:** There is no background job or scheduled task that automatically removes expired mappings. Cleanup only happens "on-demand" when the database is accessed.
- **Orphaned mappings:** If a client crashes or loses network connectivity before cleanup can occur:
  - The mapping will remain in the database until expiration (up to 1 hour)
  - The HeyGen session may timeout independently (5 minutes of inactivity)
  - A new session with the same `customSessionId` can replace the old mapping after the previous one expires or is manually cleaned up

**Important considerations:**

- **Mapping TTL:** The default TTL of 1 hour provides a safety window for reconnection, but also means abandoned sessions may block the `customSessionId` for up to 1 hour.
- **HeyGen session timeout:** HeyGen sessions timeout after 5 minutes of inactivity, but the mapping in the database persists longer (1 hour by default).
- **Race conditions:** If a client reconnects within the TTL window, it may find an expired mapping that hasn't been cleaned up yet, potentially causing conflicts.
- **Best practice:** For production use, consider implementing a background cleanup job or reducing the TTL if faster cleanup is required.

### Session lifecycle

1. **Start:** Session is initiated with optional `customSessionId` from URL parameter
2. **Connect:** Once connected, mapping is registered if `customSessionId` is provided
3. **Active:** Session remains active until:
   - User closes the window/tab
   - Session times out due to inactivity (5 minutes)
   - Stream is disconnected externally
   - New session replaces it with the same `customSessionId`
4. **Cleanup:** On disconnect, the session is closed via API and mapping is unregistered

### API endpoints

- **`POST /api/avatar/register-session`** – Registers a mapping between `customSessionId` and `heygenSessionId`
- **`POST /api/avatar/close-session`** – Closes a session by `customSessionId` (translates to `heygenSessionId` internally)

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

```text
https://interactiveavatarnextjsdemo-rfuq.onrender.com?avatarId=Shawn_Therapist_public
```

Any of the bundled public IDs—such as `Shawn_Therapist_public`, `Bryan_FitnessCoach_public`, or your own custom avatar—will work; the curated list in `app/lib/constants.ts` is a quick reference when you need an ID.

If you want a different default avatar, quality, voice model, or speech-to-text provider for every session, adjust the `createDefaultConfig` implementation (e.g., change `voice.model`, `voice.emotion`, `quality`, or `sttSettings.provider`).

For richer runtime controls you can also compose the existing `AvatarConfig`, `AvatarControls`, `AudioInput`, or `TextInput` components into the UI to expose avatar, voice, and transport settings to operators.

Finally, be sure your deployment still provides the HeyGen API credentials—`HEYGEN_API_KEY` and `NEXT_PUBLIC_BASE_API_URL`—because the client fetches a short-lived access token from `/api/get-access-token` before it starts the stream.

## Testing

⚠️ Not run (QA review only)
