/*
    Copyright (c) 2026 Roblox Chat Launcher Developers & Contributors <https://github.com/RobloxChatLauncher>

    Source: https://github.com/RobloxChatLauncher/RobloxChatLauncher-Integrations

    Licensed under the MPL 2.0 license.
    See https://www.mozilla.org/en-US/MPL/2.0/ for full text.
*/
import * as HttpBridge from "ReplicatedStorage/HttpBridge";

const Players = game.GetService("Players");

const ENDPOINT = "/egress/team-payload";

function sendTeamUpdate(player: Player) {
    const myTeam = player.Team;
    if (!myTeam) return;

    const teammates = new Array<{ name: string; userId: number }>();
    for (const p of myTeam.GetPlayers()) {
        teammates.push({ name: p.Name, userId: p.UserId });
    }

    const payload = {
        sender: player.Name,
        teamName: myTeam.Name,
        members: teammates,
        gameId: game.JobId, // Using JobId to identify the specific server instance
    };

    print("[RCL::Egress] Sending team update for:", player.Name);
    HttpBridge.send(ENDPOINT, payload);
}

// Function to set up a player's listeners
function setupPlayer(player: Player) {
    // Initial check if they are already on a team
    if (player.Team) {
        sendTeamUpdate(player);
    }

    // Update whenever their team changes
    player.GetPropertyChangedSignal("Team").Connect(() => {
        sendTeamUpdate(player);
    });
}

// 1. Catch players who joined before the script finished loading
for (const player of Players.GetPlayers()) {
    setupPlayer(player);
}

// 2. Watch for new players joining
Players.PlayerAdded.Connect(setupPlayer);
