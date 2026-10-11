import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ARENA_ABI, arenaAddress, publicClient } from "./config.js";

/**
 * Liveness watchdog for the bot VPS. Run every 5 min by the
 * context-arena-watchdog.timer systemd unit:
 *
 *   npm run healthcheck
 *
 * Checks:
 *   1. .env is configured (bails quietly on a fresh box).
 *   2. Rounds are progressing onchain (new roundCount since last run,
 *      or the latest round is still active / recently settled).
 *   3. The master systemd unit is active.
 *
 * On stall: restarts all 4 bot units + optional Telegram alert.
 * Always exits 0 so the oneshot timer never reports failure.
 */

const STATE_DIR = "/var/lib/context-arena";
const STATE_FILE = `${STATE_DIR}/watchdog.json`;
// No new round for this long => stall. Normal rounds are 10 min;
// 30 min gives the master room for RPC hiccups.
const STALL_MS = Number(process.env.WATCHDOG_STALL_MS ?? 30 * 60_000);
// Settle tx lands 10-30s after endTime. That lag is the normal SETTLING
// phase (the web UI shows "SETTLING…"), not a stall — grace before
// declaring the round dead. Env-overridable for testing.
const SETTLE_GRACE_S = Number(process.env.WATCHDOG_SETTLE_GRACE_S ?? 120);
const SERVICES = [
  "context-arena-master",
  "context-arena-agent-0",
  "context-arena-agent-1",
  "context-arena-agent-2",
];

type State = { lastRound: number; lastProgress: number };

function loadState(): State {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
  } catch {
    return { lastRound: -1, lastProgress: 0 };
  }
}

function saveState(s: State) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s));
}

function sh(cmd: string): string {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) {
    console.error("telegram alert failed:", (e as Error).message);
  }
}

function restartServices() {
  for (const svc of SERVICES) {
    try {
      sh(`sudo -n /bin/systemctl restart ${svc}`);
      console.log(`watchdog: restarted ${svc}`);
    } catch {
      console.error(`watchdog: failed to restart ${svc}`);
    }
  }
}

function configured(): boolean {
  const a = process.env.ARENA_ADDRESS ?? "";
  return (
    !!a &&
    a !== "0x0000000000000000000000000000000000000000" &&
    !!process.env.GAME_MASTER_KEY
  );
}

async function main() {
  if (!configured()) {
    console.log("watchdog: .env not configured yet, skipping");
    return;
  }

  const pub = publicClient();
  const arena = arenaAddress();
  const state = loadState();
  const now = Date.now();

  let roundCount: number;
  try {
    roundCount = Number(
      (await pub.readContract({
        address: arena,
        abi: ARENA_ABI,
        functionName: "roundCount",
      })) as bigint
    );
  } catch (e) {
    // RPC hiccup — don't touch anything, try again next tick.
    console.error("watchdog: rpc read failed:", (e as Error).message?.slice(0, 120));
    return;
  }

  if (roundCount > state.lastRound) {
    console.log(
      `watchdog: ok — round #${roundCount - 1} live (roundCount: ${roundCount})`
    );
    saveState({ lastRound: roundCount, lastProgress: now });
    return;
  }

  // No new round since last check — is that expected or a stall?
  let stalled = false;
  let detail = "";
  if (roundCount > 0) {
    try {
      const r = (await pub.readContract({
        address: arena,
        abi: ARENA_ABI,
        functionName: "rounds",
        args: [BigInt(roundCount - 1)],
      })) as unknown[];
      const endTime = Number(r[2] as bigint);
      const settled = r[6] as boolean;
      const nowS = Math.floor(now / 1000);
      if (!settled && nowS < endTime) {
        detail = `round #${roundCount - 1} active, ${endTime - nowS}s left`;
        saveState({ ...state, lastProgress: now });
      } else if (!settled && nowS < endTime + SETTLE_GRACE_S) {
        // now past endTime but settle tx hasn't landed yet = normal
        // SETTLING phase (pre-fix this fired ~8 false STALL restarts/day
        // with "ended 0m ago").
        detail = `round #${roundCount - 1} settling, ${nowS - endTime}s past end`;
        saveState({ ...state, lastProgress: now });
      } else if (settled && nowS < endTime + STALL_MS / 1000) {
        detail = `round #${roundCount - 1} settled, next starting soon`;
        saveState({ ...state, lastProgress: now });
      } else {
        stalled = true;
        detail = `round #${roundCount - 1} ended ${Math.max(
          0,
          Math.round((nowS - endTime) / 60)
        )}m ago, no new round`;
      }
    } catch (e) {
      console.error("watchdog: round read failed:", (e as Error).message?.slice(0, 120));
      return;
    }
  } else if (now - state.lastProgress > STALL_MS && state.lastProgress > 0) {
    stalled = true;
    detail = "no rounds started yet";
  }

  // Service-level check: master must be active once we've been running.
  let masterActive = false;
  try {
    masterActive = sh("sudo -n /bin/systemctl is-active context-arena-master") === "active";
  } catch {
    masterActive = false;
  }
  if (!masterActive && state.lastProgress > 0) {
    stalled = true;
    detail += (detail ? " | " : "") + "master service not active";
  }

  if (stalled) {
    console.error(`watchdog: STALL — ${detail}. restarting bots`);
    await telegram(
      `🚨 Contex Arena watchdog: stall detected (${detail}). Restarting bots on the VPS.`
    );
    restartServices();
    saveState({ ...state, lastProgress: now });
  } else {
    console.log(`watchdog: ok — ${detail || "waiting for first round"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(0); // never fail the oneshot timer
  });
