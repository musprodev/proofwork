# ProofWork Demo Script

**Target Length:** 3 minutes

**[0:00 - 0:20] The Problem**
*(Visual: Screen recording of a terminal showing an AI agent rapidly generating code, followed by a failed CI run with confusing logs.)*

**Voiceover:** AI coding agents write code and deploy contracts unattended. When something breaks, figuring out exactly what they did and when is a mess. Git commits can be rewritten, and terminal logs disappear. We need a way to prove that a specific agent took a specific action at an exact time, without relying on easily altered local files.

**[0:20 - 1:50] Live Demo**
*(Visual: Split screen. Left side is a terminal running the CLI. Right side is the web dashboard showing the timeline.)*

**Voiceover:** ProofWork fixes this by putting the agent's action logs onchain. Here is the command-line tool. I run `proofwork register` to register a new build agent. It asks for a keystore password, so keys are never hardcoded. 

*(Visual: Terminal showing the registration transaction succeeding. The dashboard on the right is empty.)*

**Voiceover:** The agent is registered. Now, the agent finishes a task and makes a commit. We use a simple git post-commit hook that calls `proofwork log`. 

*(Visual: Terminal shows `git commit -m "feat: add user auth"`. The hook triggers `proofwork log`, prompts for a password, and outputs a transaction hash.)*

**Voiceover:** The hook takes the commit hash, signs it, and sends it to the ProofWork contract on the Monad testnet. 

*(Visual: The dashboard on the right refreshes. A new timeline entry appears with a "commit" icon, timestamp, and a truncated hash.)*

**Voiceover:** The dashboard reads the contract events directly. You can see the commit logged exactly when it happened. Because it's onchain, the record is permanent. No one can go back and change the timestamp or the hash. 

*(Visual: Clicks the "Export Receipt" button on the dashboard. A JSON file downloads.)*

**Voiceover:** If you need an offline copy, you export a JSON receipt directly from the timeline.

**[1:50 - 2:20] Contract Walkthrough**
*(Visual: Code editor showing `src/ProofWork.sol`.)*

**Voiceover:** The smart contract is written in Solidity. We avoid storing large strings in state variables. Instead, we use events. The `Attested` event logs the agent ID, the action type, and the data hash. Storing this in event logs keeps gas costs extremely low while still providing cryptographic proof that the event occurred. 

**[2:20 - 2:40] Wrap**
*(Visual: Browser showing the Monad explorer page for the contract.)*

**Voiceover:** That is ProofWork. The contract is live on the Monad testnet. If you are building autonomous agents and need accountability for their actions, you need a tamper-evident log. ProofWork gives you one.
