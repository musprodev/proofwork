# ProofWork

A tamper-evident, timestamped attestation log for AI coding agent actions.

## Problem

AI coding agents write code, run tests, and deploy contracts unattended. When a deployment fails or a bug appears, you need to know exactly what the agent did and when. Standard git commits do not guarantee the timeline, and terminal logs are easily lost. There is no reliable way to prove that a specific agent took a specific action at an exact time.

## Solution

ProofWork logs agent actions onchain. Agents register their identity and submit hashes of their actions—like commits, test results, or deployments—to a smart contract. The contract stores the hash and a timestamp. 

Because the logs are onchain, they are permanent. If an agent claims it ran tests at 3 AM and the hash is on the contract, you know it happened.

## Architecture

ProofWork consists of three parts:

1. **Smart contract (`src/ProofWork.sol`)**: A Solidity contract deployed on Monad Testnet. It handles agent registration and stores action hashes using events to save gas.
2. **CLI (`cli/`)**: A Node.js command-line tool using `viem` to interact with the contract. Agents use this to register their IDs and log actions. It includes a git hook (`post-commit`) to automatically log commits.
3. **Dashboard (`web/`)**: A Next.js web interface that reads events directly from the contract. It shows a timeline of all agent actions and lets you export the logs.

## Setup

You need Node.js and Foundry installed.

1. Install the dependencies for both the CLI and the web dashboard:
   ```bash
   npm install --prefix cli
   npm install --prefix web
   ```

2. The CLI requires a keystore or a private key to sign transactions. You can use Foundry's keystore:
   ```bash
   # In a project using the CLI
   proofwork register --agent-id my-agent-name
   ```
   The CLI prompts for your password interactively. It never reads private keys from environment variables.

3. To run the dashboard locally:
   ```bash
   npm run dev --prefix web
   ```
   Open `http://localhost:3000` to see the live attestation timeline.

## Contract

ProofWork is live on Monad Testnet. 

- **Address**: `0x41bdE1a2bbdF8859E82E163bb4b38E57f22C2ae0`
- **Explorer**: [View on Monad Explorer](https://testnet.monadexplorer.com/address/0x41bdE1a2bbdF8859E82E163bb4b38E57f22C2ae0)

## Demo

Agents automatically log their commits using the provided git hook. To see the workflow in action, register an agent and commit a change:

```bash
proofwork register --agent-id my-build-agent
git commit -m "fix: update dependency"
```

The CLI logs the commit hash to the contract. The web dashboard updates immediately to show the new attestation in the timeline.