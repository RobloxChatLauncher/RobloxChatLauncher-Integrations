/*
    Copyright (c) 2026 Roblox Chat Launcher Developers & Contributors <https://github.com/RobloxChatLauncher>

    Source: https://github.com/RobloxChatLauncher/RobloxChatLauncher-Integrations

    Licensed under the MPL 2.0 license.
    See https://www.mozilla.org/en-US/MPL/2.0/ for full text.
*/
import * as Version from "ReplicatedStorage/Version";
import Enums from "ReplicatedStorage/Enums";

const ReplicatedStorage = game.GetService("ReplicatedStorage");
const Players = game.GetService("Players");

const LocalPlayer = Players.LocalPlayer;

//-----------------------------
// 3. Command Handler Map
//-----------------------------
const Handlers: Record<string, (data: { name: string }) => void> = {};

// You can define them directly in the table
Handlers[Enums.CommandType.Emote] = (data) => {
    const character = LocalPlayer.Character;
    if (!character) return;

    const animateScript = character.FindFirstChild("Animate");
    if (animateScript && animateScript.IsA("LocalScript")) {
        const playEmote = animateScript.FindFirstChild("PlayEmote");
        if (playEmote && playEmote.IsA("BindableFunction")) {
            task.spawn(() => {
                playEmote.Invoke(data.name);
            });
        } else {
            warn("[RCL::Client] PlayEmote function not found on this character.");
        }
    }
};

// Adding a new command is just one block of code:
/*
Handlers[Enums.CommandType.Kill] = (data) => {
    print("Handling kill command for:", data.target);
};
*/

//-----------------------------
// 4. Main Dispatcher (Clean & Dynamic)
//-----------------------------
// A top-level `return` is not valid TypeScript, so the startup lives in a function.
function main() {
    const BridgeEvent = ReplicatedStorage.WaitForChild("RCL_Event", 10) as RemoteEvent | undefined;
    if (!BridgeEvent) {
        warn("[RCL::Client] BridgeEvent did not appear in time!");
        return; // Stop the script so it doesn't error later
    }

    print(string.format("[RCL::Client] Initialized Roblox Chat Launcher Integrations %s", Version.Tag));

    BridgeEvent.OnClientEvent.Connect((payload: unknown) => {
        if (!typeIs(payload, "table")) return;
        const command = payload as { type: string; data: { name: string } };

        const handler = Handlers[command.type];

        if (handler) {
            handler(command.data);
        } else {
            warn("[RCL::Client] No handler defined for command type:", command.type);
        }
    });
}

main();
