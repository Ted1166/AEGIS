/**
 * test/helpers/fixtures.js
 *
 * Shared test setup for all Aegis test files.
 * Deploys the full protocol + two mock yield sources in one call.
 * Each test file calls deployAegis() in a beforeEach to get a clean state.
 */

import hre from "hardhat";
import { parseUnits } from "ethers";
import { network } from "hardhat";
// import { ethers } from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

/**
 * Deploys the full Aegis protocol stack and returns all contracts + signers.
 *
 * @returns {Promise<AegisFixture>}
 */
export async function deployAegis() {
    const connection = await network.connect();
    const ethers = connection.ethers;

  // Use ethers directly for utility functions
  const USDC_DECIMALS  = 6;
  const MINT_AMOUNT    = parseUnits("1000000", USDC_DECIMALS); // $1M
  const DEPOSIT_AMOUNT = parseUnits("10000",   USDC_DECIMALS); // $10k
  const TVL_FLOOR      = parseUnits("500000",  USDC_DECIMALS); // $500k

  // Get signers from hre (not hre.ethers)
const [owner, alice, bob, sentinel, scorer, keeper] = await ethers.getSigners();

  // ── Deploy MockUSDC ───────────────────────────────────────────────────────
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc     = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  // ── Deploy AegisTreasury ──────────────────────────────────────────────────
  const AegisTreasury = await ethers.getContractFactory("AegisTreasury");
  const treasury      = await AegisTreasury.deploy(usdcAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();

  // ── Deploy YieldOracle ────────────────────────────────────────────────────
  const YieldOracle = await ethers.getContractFactory("YieldOracle");
  const oracle      = await YieldOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();

  // ── Deploy AegisGuard (placeholder vault first) ───────────────────────────
  const AegisGuard  = await ethers.getContractFactory("AegisGuard");
//   const guardTemp   = await AegisGuard.deploy(owner.address, treasuryAddress);
//   await guardTemp.waitForDeployment();

  // ── Deploy AegisVault ─────────────────────────────────────────────────────
  const AegisVault = await ethers.getContractFactory("AegisVault");
  const vault = await AegisVault.deploy(usdcAddress, oracleAddress, owner.address, treasuryAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    
    const vaultFinalAddress = vaultAddress;

    const guard = await AegisGuard.deploy(vaultAddress, treasuryAddress);
    await guard.waitForDeployment();
    const guardAddress = await guard.getAddress();

    await (await vault.setGuard(guardAddress)).wait();

  // ── Re-deploy AegisVault with real guard ─────────────────────────────────
//   const vaultFinal = await AegisVault.deploy(
//     usdcAddress,
//     oracleAddress,
//     guardAddress,
//     treasuryAddress
//   );
//   await vaultFinal.waitForDeployment();
//   const vaultFinalAddress = await vaultFinal.getAddress();


  // ── Wire Treasury ─────────────────────────────────────────────────────────
  await (await treasury.setVault(vaultFinalAddress)).wait();
  await (await treasury.setGuard(guardAddress)).wait();
  await (await oracle.setVault(vaultFinalAddress)).wait();

  // ── Authorize AI wallets ──────────────────────────────────────────────────
  await (await guard.addSignalWriter(sentinel.address)).wait();
  await (await oracle.addWriter(scorer.address)).wait();

  // ── Deploy MockYieldSources ───────────────────────────────────────────────
  const MockYieldSource = await ethers.getContractFactory("MockYieldSource");

  // Lending source: 8% APY, $5M TVL — scores ~75 (Sustainable)
  const lendingSource = await MockYieldSource.deploy(
    usdcAddress,
    "Mock Lending",
    800,
    ethers.parseUnits("5000000", USDC_DECIMALS)  // Use ethers directly
  );
  await lendingSource.waitForDeployment();
  const lendingAddress = await lendingSource.getAddress();

  // DEX source: 22% APY, $800k TVL — scores ~52 (Mixed)
  const dexSource = await MockYieldSource.deploy(
    usdcAddress,
    "Mock DEX LP",
    2200,
    ethers.parseUnits("800000", USDC_DECIMALS)  // Use ethers directly
  );
  await dexSource.waitForDeployment();
  const dexAddress = await dexSource.getAddress();

  // ── Register sources in vault + oracle ───────────────────────────────────
  await (await vault.addYieldSource(lendingAddress)).wait();
  await (await vault.addYieldSource(dexAddress)).wait();
  await (await oracle.addProtocol(lendingAddress)).wait();
  await (await oracle.addProtocol(dexAddress)).wait();

  // ── Write initial scores ──────────────────────────────────────────────────
  await (await oracle.connect(scorer).writeScore(
    lendingAddress, 700, 100, 800,
    ethers.parseUnits("5000000", USDC_DECIMALS), TVL_FLOOR  // Use ethers directly
  )).wait();

  await (await oracle.connect(scorer).writeScore(
    dexAddress, 800, 1400, 2200,
    ethers.parseUnits("800000", USDC_DECIMALS), TVL_FLOOR  // Use ethers directly
  )).wait();

  // ── Mint USDC to test wallets ─────────────────────────────────────────────
  for (const wallet of [owner, alice, bob]) {
    await (await usdc.mint(wallet.address, MINT_AMOUNT)).wait();
  }

  // Pre-approve vault for all test wallets
  for (const wallet of [owner, alice, bob]) {
    await (await usdc.connect(wallet).approve(vaultFinalAddress, MINT_AMOUNT)).wait();
  }

  return {
    connection,
    // Contracts
    usdc,
    treasury,
    oracle,
    guard,
    vault: vault,
    lendingSource,
    dexSource,
    // Addresses
    usdcAddress,
    treasuryAddress,
    oracleAddress,
    guardAddress,
    vaultAddress: vaultFinalAddress,
    lendingAddress,
    dexAddress,
    // Signers
    owner,
    alice,
    bob,
    sentinel,
    scorer,
    keeper,
    // Constants
    DEPOSIT_AMOUNT,
    MINT_AMOUNT,
    TVL_FLOOR,
  };
}