# HeyGen Interactive Avatar NextJS Demo

![HeyGen Interactive Avatar NextJS Demo Screenshot](./public/demo.png)

This project now includes a full control backend and web surfaces to drive a Recall.ai output-media avatar in real time. The Next.js front-end continues to host the original HeyGen demo while adding dedicated routes for the host control panel and the avatar page.

## Control backend & Recall.ai integration

### Environment variables

Create a `.env` file with the following variables (all are required unless stated otherwise):

| Variable | Description |
| --- | --- |
| `JWT_SECRET` | Secret used to sign/verify short-lived WebSocket tokens. |
| `PUBLIC_APP_URL` | Public https:// URL where this app is served (used to mint host/avatar URLs). |
| `WS_PUBLIC_URL` | Public wss:// endpoint that points to `YOUR_DOMAIN/ws` (used in the session response). |
| `ACK_TIMEOUT_MS` | (Optional) Time in milliseconds to wait for an ACK before retrying. Default `5000`. |
| `ACK_MAX_RETRIES` | (Optional) Maximum resend attempts before failing a command. Default `3`. |
| `COMMAND_QUEUE_SIZE` | (Optional) Maximum buffered commands while the avatar is offline. Default `50`. |
| `WS_ALLOWED_ORIGINS` | (Optional) Comma separated list of allowed `Origin` prefixes for WebSocket connections. |

### Install & run

```bash
pnpm install
pnpm dev
```

The `pnpm dev` command boots a custom Express server that embeds Next.js and exposes:

- `POST /session` – creates a new session and returns signed WebSocket URLs plus the ready-to-use host and avatar links.
- `GET /host` – host control panel. Pass `?session=...&wss=...` from the session response.
- `GET /avatar` – avatar experience rendered at 1280×720. Pass the same query parameters.
- `GET /` – existing HeyGen interactive avatar demo.

For production builds run `pnpm build` followed by `pnpm start`. The compiled backend lives in `dist/server/app.js` and serves the prebuilt Next.js app.

### Session bootstrap flow

1. Call `POST /session` from your backend or CLI. The response contains `session`, `ws_host`, `ws_avatar`, `host_panel`, and `avatar_page`.
2. Open `host_panel` in the browser. Buttons send JSON commands (`kind:"cmd"`, `action`, `payload`) through the WebSocket.
3. Configure your Recall.ai bot with `output_media.camera.kind = "webpage"` and set the URL to `avatar_page`.
4. The avatar page connects to the same WebSocket, applies DOM mutations (scene, theme, banner, counters, etc.), emits `ack` for each command, and streams the rendered page back to the meeting.

Commands that arrive while the avatar is offline are buffered (up to `COMMAND_QUEUE_SIZE`) and replayed on reconnection. ACKs are retried up to `ACK_MAX_RETRIES` before returning an error to the host UI.

### Using Recall.ai

```bash
curl -X POST "$CONTROL_BACKEND/session"

# Create the bot with the returned avatar_page URL
curl -X POST https://us-east-1.recall.ai/api/v1/bot/ \
  -H "Authorization: $RECALLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "meeting_url": "ZOOM_MEETING_URL",
        "bot_name": "Avatar Recall",
        "output_media": {
          "camera": {
            "kind": "webpage",
            "config": { "url": "https://YOUR_APP/avatar?session=...&wss=..." }
          }
        },
        "variant": { "zoom": "web_4_core", "google_meet": "web_4_core", "microsoft_teams": "web_4_core" }
      }'
```

The avatar page requests microphone access automatically inside the Recall.ai browser and can be extended to consume the live transcription WebSocket for voice commands.

---

The original HeyGen demo documentation is preserved below for reference.

This is a sample project and was bootstrapped using [NextJS](https://nextjs.org/). Feel free to play around with the existing code and please leave any feedback for the SDK [here](https://github.com/HeyGen-Official/StreamingAvatarSDK/discussions).

## Getting Started FAQ

### Setting up the demo

1. Clone this repo

2. Navigate to the repo folder in your terminal

3. Run `npm install` (assuming you have npm installed. If not, please follow these instructions: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)

4. Enter your HeyGen Enterprise API Token in the `.env` file. Replace `HEYGEN_API_KEY` with your API key. This will allow the Client app to generate secure Access Tokens with which to create interactive sessions.

   You can retrieve either the API Key by logging in to HeyGen and navigating to this page in your settings: [https://app.heygen.com/settings?from=&nav=Subscriptions%20%26%20API]. 

5. (Optional) If you would like to use the OpenAI features, enter your OpenAI Api Key in the `.env` file.

6. Run `npm run dev`

### Starting sessions

NOTE: Make sure you have enter your token into the `.env` file and run `npm run dev`.

To start your 'session' with a Interactive Avatar, first click the 'start' button. If your HeyGen API key is entered into the Server's .env file, then you should see our demo Interactive Avatar appear.

If you want to see a different Avatar or try a different voice, you can close the session and enter the IDs and then 'start' the session again. Please see below for information on where to retrieve different Avatar and voice IDs that you can use.

### Which Avatars can I use with this project?

By default, there are several Public Avatars that can be used in Interactive Avatar. (AKA Interactive Avatars.) You can find the Avatar IDs for these Public Avatars by navigating to [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar) and clicking 'Select Avatar' and copying the avatar id.

You can create your own custom Interactive Avatars at labs.heygen.com/interactive-avatar by clicking 'create interactive avatar' on the top-left of the screen.

### Where can I read more about enterprise-level usage of the Interactive Avatar API?

Please read our Interactive Avatar 101 article for more information on pricing: https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide
