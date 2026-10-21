/*
    Copyright (c) 2026 Roblox Chat Launcher Developers & Contributors <https://github.com/RobloxChatLauncher>

    Source: https://github.com/RobloxChatLauncher/RobloxChatLauncher-Integrations

    Licensed under the MPL 2.0 license.
    See https://www.mozilla.org/en-US/MPL/2.0/ for full text.
*/
const HttpService = game.GetService("HttpService");

//-----------------------------
// Configuration
//-----------------------------
const BASE_URL = "https://RobloxChatLauncher.onrender.com";
/*
    How to set your API key:
    1. Navigate to your [Creator Dashboard](https://create.roblox.com/dashboard/creations).
    2. Select your Experience (Universe).
    3. Go to **Settings** > **Secrets** (or navigate directly to `https://create.roblox.com/dashboard/creations/experiences/<your-universe-id>/secrets`).
    4. Click **Create Secret**.
    5. Set the Name to **`RCL_API_KEY`**.
    6. Paste your provided API key into the Value field and save.
*/
const API_KEY = HttpService.GetSecret("RCL_API_KEY");
const UNIVERSE_ID = tostring(game.GameId); // game.GameId is the UniverseId. The game must be published or game.GameId will return 0 and requests will fail with 403.

// Helper to format URLs consistently
function formatUrl(path: string): string {
    if (path.sub(1, 4) === "http") return path;
    if (path.sub(1, 1) !== "/") path = "/" + path;
    return BASE_URL + path;
}

//-----------------------------
// Sender (Egress)
//-----------------------------
export function send(url: string, payload: object) {
    const fullUrl = formatUrl(url);
    task.spawn(() => {
        const [success, result] = pcall(() =>
            HttpService.RequestAsync({
                Url: fullUrl,
                Method: "POST",
                Headers: {
                    "x-api-key": API_KEY,
                    "x-universe-id": UNIVERSE_ID,
                    "x-job-id": game.JobId,
                    "Content-Type": "application/json",
                },
                Body: HttpService.JSONEncode(payload),
            }),
        );
        if (!success) warn("[RCL::Egress] Error:", result);
    });
}

//-----------------------------
// Listener (Ingress)
//-----------------------------
const handlers = new Array<(data: unknown) => void>();
let isPolling = false;

export function registerHandler(handler: (data: unknown) => void) {
    handlers.push(handler);

    if (!isPolling) {
        isPolling = true;
        startCentralLoop("/api/v1/commands");
    }
}

function startCentralLoop(endpoint: string) {
    const fullUrl = formatUrl(endpoint);

    // attach headers for auth
    const headers = {
        "x-api-key": API_KEY,
        "x-universe-id": UNIVERSE_ID,
        "x-job-id": game.JobId,
    };

    const MIN_RECONNECT_DELAY = 1; // seconds
    const LONG_POLL_TIMEOUT = 65; // must be higher than server timeout (55 seconds)

    task.spawn(() => {
        while (true) {
            const requestStartedAt = os.clock();

            const [success, response] = pcall(() =>
                HttpService.RequestAsync({
                    Url: fullUrl,
                    Method: "GET",
                    Headers: headers,
                    // Not in @rbxts/types' RequestAsyncRequest, so the literal is asserted.
                    Timeout: LONG_POLL_TIMEOUT,
                } as RequestAsyncRequest),
            );

            const elapsed = os.clock() - requestStartedAt;

            if (success && response.Success) {
                const body = response.Body;

                if (body.size() > 2) {
                    const [ok, decodedData] = pcall(() => HttpService.JSONDecode(body));

                    if (ok) {
                        for (const handlerFunc of handlers) {
                            task.spawn(handlerFunc, decodedData);
                        }
                    } else {
                        warn("[RCL::Ingress] Failed to decode JSON");
                    }
                }
            } else if (!success) {
                warn("[RCL::Ingress] Connection error:", response);
            } else if (response.StatusCode === 403) {
                warn("[RCL::Ingress] Auth Failed: Check API Key and UniverseID");
            } else if (response.StatusCode !== 200) {
                warn("[RCL::Ingress] HTTP Error:", response.StatusCode, response.StatusMessage);
            }

            // Guard against using too much HTTP quota if server always responds instantly
            if (elapsed < MIN_RECONNECT_DELAY) {
                task.wait(MIN_RECONNECT_DELAY - elapsed);
            }
        }
    });
}
