#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { scryptSync, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  defineChain,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Config ────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

const deployment = JSON.parse(
  readFileSync(join(__dirname, '..', 'deployment.json'), 'utf8'),
);
const CONTRACT = deployment.address;
const EXPLORER = 'https://testnet.monadexplorer.com';

const monadTestnet = defineChain({
  id: deployment.chainId,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [deployment.rpcUrl] } },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: EXPLORER },
  },
});

const abi = parseAbi([
  'function registerAgent(bytes32 agentId) external',
  'function attest(bytes32 agentId, bytes32 actionHash, string actionType) external',
  'function getAttestationCount(bytes32 agentId) external view returns (uint256)',
  'function isRegistered(bytes32 agentId) external view returns (bool)',
  'function getController(bytes32 agentId) external view returns (address)',
]);

// ─── Keystore decryption (same V3 format forge uses) ───────────────

function getKeystorePath(accountName) {
  const home = process.env.HOME || process.env.USERPROFILE;
  const ksPath = join(home, '.foundry', 'keystores', accountName);
  if (!existsSync(ksPath)) {
    console.error(`✗ keystore not found: ${ksPath}`);
    process.exit(1);
  }
  return ksPath;
}

async function promptPassword(label) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`Enter keystore password for '${label}': `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function decryptKeystore(raw, password) {
  const ks = JSON.parse(raw);
  const c = ks.crypto || ks.Crypto;
  if (!c) throw new Error('invalid keystore format');

  // derive key
  let dk;
  if (c.kdf === 'scrypt') {
    const p = c.kdfparams;
    dk = scryptSync(Buffer.from(password), Buffer.from(p.salt, 'hex'), p.dklen, {
      cost: p.n, blockSize: p.r, parallelization: p.p,
      maxmem: 256 * 1024 * 1024,
    });
  } else if (c.kdf === 'pbkdf2') {
    const p = c.kdfparams;
    dk = pbkdf2Sync(Buffer.from(password), Buffer.from(p.salt, 'hex'), p.c, p.dklen, 'sha256');
  } else {
    throw new Error(`unsupported KDF: ${c.kdf}`);
  }

  // verify MAC
  const ct = Buffer.from(c.ciphertext, 'hex');
  const macInput = `0x${Buffer.concat([dk.subarray(16, 32), ct]).toString('hex')}`;
  const mac = keccak256(macInput).slice(2);
  if (mac !== c.mac) throw new Error('wrong password (MAC mismatch)');

  // decrypt private key
  const decipher = createDecipheriv(
    c.cipher, dk.subarray(0, 16), Buffer.from(c.cipherparams.iv, 'hex'),
  );
  const pk = Buffer.concat([decipher.update(ct), decipher.final()]);
  return `0x${pk.toString('hex')}`;
}

async function loadAccount(accountName) {
  const ksPath = getKeystorePath(accountName);
  const raw = readFileSync(ksPath, 'utf8');
  const password = await promptPassword(accountName);
  const privateKey = decryptKeystore(raw, password);
  return privateKeyToAccount(privateKey);
}

// ─── Clients ───────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(deployment.rpcUrl),
});

function makeWalletClient(account) {
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(deployment.rpcUrl),
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Hash a plain-text agent name the same way Solidity's keccak256(bytes) does. */
function hashAgentId(name) {
  return keccak256(toHex(name));
}

function txLink(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

// ─── Commands ──────────────────────────────────────────────────────

async function cmdRegister(agentIdStr, accountName) {
  const account = await loadAccount(accountName);
  const client = makeWalletClient(account);
  const agentId = hashAgentId(agentIdStr);

  console.log(`\n  agent   : ${agentIdStr}`);
  console.log(`  agentId : ${agentId}`);
  console.log(`  from    : ${account.address}\n`);

  const hash = await client.writeContract({
    address: CONTRACT,
    abi,
    functionName: 'registerAgent',
    args: [agentId],
  });

  console.log(`  tx      : ${hash}`);
  console.log(`  explorer: ${txLink(hash)}`);

  process.stdout.write('  waiting for receipt…');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(` ${receipt.status}\n`);
}

async function cmdLog(agentIdStr, action, data, accountName) {
  const account = await loadAccount(accountName);
  const client = makeWalletClient(account);
  const agentId = hashAgentId(agentIdStr);
  const actionHash = keccak256(toHex(data));

  console.log(`\n  agent      : ${agentIdStr}`);
  console.log(`  action     : ${action}`);
  console.log(`  data       : ${data}`);
  console.log(`  actionHash : ${actionHash}`);
  console.log(`  from       : ${account.address}\n`);

  const hash = await client.writeContract({
    address: CONTRACT,
    abi,
    functionName: 'attest',
    args: [agentId, actionHash, action],
  });

  console.log(`  tx      : ${hash}`);
  console.log(`  explorer: ${txLink(hash)}`);

  process.stdout.write('  waiting for receipt…');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(` ${receipt.status}\n`);
}

async function cmdCount(agentIdStr) {
  const agentId = hashAgentId(agentIdStr);
  const n = await publicClient.readContract({
    address: CONTRACT,
    abi,
    functionName: 'getAttestationCount',
    args: [agentId],
  });
  console.log(`\n  agent          : ${agentIdStr}`);
  console.log(`  agentId        : ${agentId}`);
  console.log(`  attestationCount: ${n}\n`);
}

// ─── Arg parser ────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(argv[i]);
    }
  }
  return result;
}

// ─── Main ──────────────────────────────────────────────────────────

const USAGE = `
ProofWork CLI — tamper-evident attestation log for AI coding agents

Usage:
  proofwork register  --agent-id <name>  [--account <keystore>]
  proofwork log       --agent-id <name>  --action <commit|test|deploy>  --data <string>  [--account <keystore>]
  proofwork count     --agent-id <name>

Options:
  --account   Foundry keystore name (default: proofwork-deployer)
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const accountName = args.account || 'proofwork-deployer';

  switch (command) {
    case 'register': {
      if (!args['agent-id']) { console.error(USAGE); process.exit(1); }
      await cmdRegister(args['agent-id'], accountName);
      break;
    }
    case 'log': {
      if (!args['agent-id'] || !args.action || !args.data) {
        console.error(USAGE);
        process.exit(1);
      }
      const valid = ['commit', 'test', 'deploy'];
      if (!valid.includes(args.action)) {
        console.error(`✗ invalid action "${args.action}". must be: ${valid.join(', ')}`);
        process.exit(1);
      }
      await cmdLog(args['agent-id'], args.action, args.data, accountName);
      break;
    }
    case 'count': {
      if (!args['agent-id']) { console.error(USAGE); process.exit(1); }
      await cmdCount(args['agent-id']);
      break;
    }
    default:
      console.error(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.shortMessage || err.message}\n`);
  process.exit(1);
});
