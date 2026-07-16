# ProofWork — agent rules

Read HUMANIZER.md before writing any README section, UI copy, commit
message, or social post text. Apply it strictly.

Stack: Foundry, Solidity 0.8.28, evm_version prague, targeting Monad
testnet (chain id 10143). Next.js + Tailwind + shadcn for web/, viem
for chain reads. No OpenZeppelin, no external Solidity imports, ever,
unless I explicitly ask for one.

Before touching src/*.sol: run `forge test` and confirm green, before
and after any change. Never weaken a test to make it pass.

Before touching web/*: run /impeccable audit on the changed files
before considering the task done.

Never commit .env, private keys, or keystore files. Never hardcode a
key in a script. Signing always goes through --account and an
interactive password prompt.

Commits: Conventional Commits (feat:, fix:, test:, docs:, ci:). Small,
real, incremental. No "final v2" squash commits.
