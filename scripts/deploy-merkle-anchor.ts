/**
 * deploy-merkle-anchor.ts
 *
 * Compiles MerkleAnchor.sol and deploys it to Ethereum Sepolia testnet.
 *
 * Prerequisites:
 *   - SEPOLIA_RPC_URL env var (e.g., https://sepolia.infura.io/v3/YOUR_KEY)
 *   - SEPOLIA_PRIVATE_KEY env var (deployer wallet private key, without 0x prefix)
 *   - Deployer wallet must have Sepolia ETH (get from faucet)
 *
 * Usage:
 *   npx ts-node scripts/deploy-merkle-anchor.ts
 *
 * On success, prints the deployed contract address.
 * Set MERKLE_ANCHOR_CONTRACT_ADDRESS in .env or docker-compose.yml.
 */
import { ethers, ContractFactory } from 'ethers';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('Error: Set SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY environment variables.');
    console.error('');
    console.error('Example:');
    console.error('  export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY');
    console.error('  export SEPOLIA_PRIVATE_KEY=your-private-key-without-0x');
    process.exit(1);
  }

  // Read the Solidity source
  const solPath = path.join(
    __dirname,
    '..',
    'services',
    'certificate-service',
    'src',
    'blockchain',
    'contracts',
    'MerkleAnchor.sol',
  );
  const source = fs.readFileSync(solPath, 'utf8');

  // Compile with solc
  const input = {
    language: 'Solidity',
    sources: { 'MerkleAnchor.sol': { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
    },
  };

  console.log('Compiling MerkleAnchor.sol...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: { severity: string }) => e.severity === 'error')) {
    console.error('Compilation errors:');
    output.errors.forEach((e: { formattedMessage: string }) => console.error(e.formattedMessage));
    process.exit(1);
  }

  const contract = output.contracts['MerkleAnchor.sol']['MerkleAnchor'];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('Compilation successful.');

  // Connect to Sepolia
  console.log('Connecting to Sepolia...');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer address: ${wallet.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('');
    console.error('Error: Deployer wallet has no Sepolia ETH.');
    console.error('Get test ETH from a faucet:');
    console.error('  - https://sepoliafaucet.com/');
    console.error('  - https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
    process.exit(1);
  }

  // Deploy
  console.log('Deploying MerkleAnchor...');
  const factory = new ContractFactory(abi, bytecode, wallet);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();

  const address = await deployed.getAddress();
  console.log('');
  console.log('=============================================');
  console.log('  MerkleAnchor deployed successfully!');
  console.log(`  Contract address: ${address}`);
  console.log('=============================================');
  console.log('');
  console.log('Add to your .env or docker-compose.yml:');
  console.log(`  MERKLE_ANCHOR_CONTRACT_ADDRESS=${address}`);
  console.log('');
  console.log(`Verify on Etherscan: https://sepolia.etherscan.io/address/${address}`);
}

main().catch((err) => {
  console.error('Deployment failed:', err.message || err);
  process.exit(1);
});
