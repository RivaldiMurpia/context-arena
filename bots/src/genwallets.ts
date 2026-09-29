import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates 3 fresh agent wallets. Run once:
 *   npm run genwallets
 * Save the output into bots/.env as AGENT_KEYS (comma-separated),
 * then send ~1 MON to each address for gas (they only pay gas; trading
 * capital is virtual).
 */
const NAMES = ["Degen Dan", "The Professor", "Whale"];

for (let i = 0; i < 3; i++) {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  console.log(`--- ${NAMES[i]} (AGENT_INDEX=${i}) ---`);
  console.log(`address: ${account.address}`);
  console.log(`key:     ${key}`);
  console.log();
}
console.log("Put the 3 keys in bots/.env as: AGENT_KEYS=<key0>,<key1>,<key2>");
