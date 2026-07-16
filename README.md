<div align="center">

# 📜 ProofWork

**A tamper-evident, timestamped attestation log for AI coding agent actions.**

Log, sign, and verify commits, test results, and deployments onchain to maintain an immutable timeline of autonomous activity.

[![Solidity](https://img.shields.io/badge/solidity-0.8.28-black?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS-lightgrey?style=for-the-badge)](#)
[![Network](https://img.shields.io/badge/network-Monad%20Testnet-purple?style=for-the-badge)](https://testnet.monadexplorer.com/)

</div>

---

## What is ProofWork?

ProofWork is an onchain logging and attestation system designed for autonomous AI coding agents. When agents run tests, commit code, or deploy smart contracts, they submit cryptographic hashes of their actions to the ProofWork contract on the Monad testnet. 

Because the records are stored on the blockchain, they are permanent and tamper evident. Observers can audit the exact sequence and timing of an agent's work, ensuring that actions cannot be backdated, modified, or deleted.

### Key capabilities

| Feature | Description |
|---|---|
| **Onchain logs** | Action hashes are written directly to Monad Testnet, providing a permanent, cryptographically verified timeline |
| **Gas optimized** | Solidity event logs store data rather than state variables, keeping transaction costs low |
| **CLI integration** | Node.js CLI tool with an automatic Git hook for hands off logging of code changes |
| **Interactive dashboard** | Next.js interface reads events directly from the blockchain to show agent activity |
| **Secure keystores** | Password entry is interactive, preventing raw private keys from being stored in environment variables |

---

## Installation

### Prerequisites

Make sure you have Node.js and Foundry installed.

### CLI setup

Clone the repository and install dependencies for the CLI:

```bash
git clone https://github.com/musprodev/proofwork.git
cd proofwork
npm install --prefix cli
```

To make the `proofwork` command available globally, link the CLI package:

```bash
cd cli
npm link
cd ..
```

### Dashboard setup

Install dependencies for the Next.js web interface:

```bash
npm install --prefix web
```

---

## Quick start

### 1. Register an agent

Register a new agent by choosing an identifier. The CLI will look for a Foundry keystore of the operator and prompt for its password:

```bash
proofwork register --agent-id my-build-agent --account proofwork-deployer
```

### 2. Log actions

You can log any action manually using the `log` command:

```bash
proofwork log --agent-id my-build-agent --action commit --data "feat: add user auth" --account proofwork-deployer
```

Or use the automated Git hook to log commits automatically on every commit.

### 3. Run the dashboard

Start the Next.js development server:

```bash
npm run dev --prefix web
```

Open `http://localhost:3000` to view the timeline of attestations.

---

## Architecture

```
proofwork/
├── src/
│   └── ProofWork.sol      # Solidity smart contract handling agent registries and event logs
├── cli/
│   ├── index.js           # CLI entry point for signing and sending transactions via viem
│   └── hooks/
│       └── post-commit    # Git post commit hook for automated commit logging
├── web/
│   ├── src/
│   │   ├── app/           # Next.js app pages and layouts
│   │   └── data/          # Local datasets like human readable agent mappings
│   └── package.json       # Dependencies for Next.js web application
├── test/
│   ├── ProofWork.t.sol    # Unit and fuzz tests for the Solidity contract
│   └── ProofWorkInvariant.t.sol # Invariant properties and test handler
├── foundry.toml           # Forge configuration for compilation and testing
└── deployment.json        # Contract address, chain ID, and RPC configuration
```

---

## Technical and security details

### How the Git hook works

The post commit hook runs after every successful Git commit. It retrieves the latest commit hash, signs a message containing the hash, and triggers the `proofwork log` command. The command submits the hash to the `attest` function on the smart contract.

To install the hook in your local Git repository:

```bash
cp cli/hooks/post-commit .git/hooks/
chmod +x .git/hooks/post-commit
```

### Keystore and signature security

The CLI avoids reading raw private keys from environment variables. Instead, it relies on Foundry encrypted keystores stored at `~/.foundry/keystores/`. 

When executing a transaction, the CLI:
1. Locates the keystore file by name.
2. Prompts you for the password interactively in the terminal.
3. Decrypts the private key in memory to sign transactions, minimizing exposure.

### Front-running prevention

To prevent an attacker from front running your agent registration, do not register a plain text name directly on a public network. Instead, salt the agent identifier with your deployer address:

```solidity
bytes32 agentId = keccak256(abi.encodePacked(msg.sender, "my-agent-name"));
```

This ensures only your controller address can register and claim ownership of that specific agent ID.

---

## Contract details

The smart contract is deployed on the Monad testnet.

- **Address**: `0x41bdE1a2bbdF8859E82E163bb4b38E57f22C2ae0`
- **Explorer link**: [View on Monad Explorer](https://testnet.monadexplorer.com/address/0x41bdE1a2bbdF8859E82E163bb4b38E57f22C2ae0)

---

## Contributing

Contributions are welcome. Run the test suite before submitting pull requests:

```bash
forge test
```

## License

This project is licensed under the [MIT License](LICENSE).