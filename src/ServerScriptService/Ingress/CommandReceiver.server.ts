/*
    Copyright (c) 2026 Roblox Chat Launcher Developers & Contributors <https://github.com/RobloxChatLauncher>

    Source: https://github.com/RobloxChatLauncher/RobloxChatLauncher-Integrations

    Licensed under the MPL 2.0 license.
    See https://www.mozilla.org/en-US/MPL/2.0/ for full text.
*/
// Import our Bridge and Enums
import * as HttpBridge from "ReplicatedStorage/HttpBridge";
import * as Enums from "ReplicatedStorage/Enums";

const Players = game.GetService("Players");
const ReplicatedStorage = game.GetService("ReplicatedStorage");

// 1. Rojo guarantees this exists based on the JSON file
const BridgeEvent = ReplicatedStorage.WaitForChild("RCL_Event") as RemoteEvent;

interface CommandPayload {
    type: string;
    targetPlayer?: unknown;
    data?: unknown;
}

// 2. Logic for commands that run ONLY on the Server
function handleServerCommand(payload: CommandPayload) {
    // Here we can add any server-specific command handling logic.
}

/*
    Example Emote ingress payload:

    ```json
    {
        "type": "Emote",
        "targetPlayer": "12345",
        "data": {
            "name": "Dance"
        }
    }
    ```

    But it can also be an array:
    ```json
    [
        {
            "type": "Emote",
            "targetPlayer": "12345",
            "data": {
                "name": "Dance"
            }
        },
        {
            "type": "Emote",
            "targetPlayer": "67890",
            "data": {
                "name": "Wave"
            }
        }
    ]
    ```
*/

// 3. The Main Router
function handleIncomingRequest(input: unknown) {
    if (!typeIs(input, "table")) return;

    // Normalize: If it's a single command (no index 1), wrap it in a table
    // If it's already an array, use it as is.
    const commands = (input as unknown[])[0] !== undefined ? (input as unknown[]) : [input];

    for (const entry of commands) {
        // Now we are guaranteed to be looking at individual command objects
        if (!typeIs(entry, "table") || (entry as CommandPayload).type === undefined) {
            warn("[RCL::Ingress] Skipping malformed payload entry");
            continue;
        }
        const payload = entry as CommandPayload;

        const target = payload.targetPlayer;

        //-------------------------------------------------------
        // ROUTING LOGIC
        //-------------------------------------------------------
        const targetUserId = tonumber(target); // Convert to number if it's a string that represents a UserID

        // A. ROUTE TO SERVER: targetPlayer must be explicitly "Server"
        if (target === Enums.Target.Server) {
            handleServerCommand(payload);

            // B. ROUTE TO PLAYER: targetPlayer is a string (username)
        } else if (targetUserId !== undefined) {
            // Use the UserID to find the player object directly
            const player = Players.GetPlayerByUserId(targetUserId);

            if (player) {
                // Send the specific payload to the client
                BridgeEvent.FireClient(player, payload);
            } else {
                warn("[RCL::Ingress] Player with ID " + tostring(targetUserId) + " not found in server.");
            }

            // C. ERROR HANDLING: No target or invalid target type
        } else {
            warn(
                string.format(
                    "[RCL::Ingress] Dropping payload (Type: %s). Missing or invalid 'targetPlayer'. Received: %s",
                    tostring(payload.type),
                    tostring(target),
                ),
            );
        }
    }
}

// 4. Start listening
HttpBridge.registerHandler(handleIncomingRequest);
print("[RCL::Ingress] Bridge is active and listening for commands...");
