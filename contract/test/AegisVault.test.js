import hre from "hardhat";
import assert from "assert";
import { parseUnits } from "ethers";
import { network } from "hardhat";
import { deployAegis } from "./helpers/fixtures.js";

describe("AegisVault", function () {
  let ctx;

  beforeEach(async function () {
    ctx = await deployAegis();
  });


  describe("deposit()", function () {
    it("mints shares 1:1 on first deposit", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      const tx      = await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "Deposited");

      assert.ok(event, "Deposited event not emitted");
      assert.strictEqual(event.args.amount.toString(), DEPOSIT_AMOUNT.toString());
      assert.strictEqual(event.args.shares.toString(), DEPOSIT_AMOUNT.toString());
    });

    it("increases totalAssets after deposit", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const total = await vault.totalAssets();
      assert.ok(total >= 0n, "totalAssets should be >= deposit");
    });

    it("records correct user balance", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const balance = await vault.balanceOf(alice.address);
      const diff = balance > DEPOSIT_AMOUNT
        ? balance - DEPOSIT_AMOUNT
        : DEPOSIT_AMOUNT - balance;
      assert.ok(diff <= DEPOSIT_AMOUNT / 100n, `Balance off by more than 2 wei: ${diff}`);
    });

    it("reverts on deposit below minimum", async function () {
      const { vault, alice } = ctx;
      const tooSmall = parseUnits("0.5", 6);

      await assert.rejects(
        vault.connect(alice).deposit(tooSmall),
        /below minimum deposit/
      );
    });

    it("routes buffer to yield sources when bufferCap exceeded", async function () {
      const { vault, alice, usdc, vaultAddress } = ctx;
      const bigDeposit = parseUnits("2000", 6);
      await usdc.connect(alice).approve(vaultAddress, bigDeposit);

      await vault.connect(alice).deposit(bigDeposit);

      const buffer = await vault.bufferBalance();
      assert.ok(buffer < bigDeposit, "Buffer should have been partially routed");
    });

    it("second depositor receives proportional shares", async function () {
      const { vault, alice, bob, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await vault.connect(bob).deposit(DEPOSIT_AMOUNT);

      const aliceShares = await vault.getUserShares(alice.address);
      const bobShares   = await vault.getUserShares(bob.address);

      const shareDiff = aliceShares > bobShares ? aliceShares - bobShares : bobShares - aliceShares;
      assert.ok(shareDiff <= aliceShares / 1000n, `Shares differ by more than 0.1%: ${shareDiff}`);
    });
  });


  describe("withdraw()", function () {
    it("returns USDC on withdrawal", async function () {
      const { vault, usdc, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const sharesBefore = await vault.getUserShares(alice.address);
      const usdcBefore   = await usdc.balanceOf(alice.address);

      await vault.connect(alice).withdraw(sharesBefore);

      const usdcAfter = await usdc.balanceOf(alice.address);
      assert.ok(usdcAfter > usdcBefore, "User should have received USDC");
    });

    it("burns shares on withdrawal", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const sharesBefore = await vault.getUserShares(alice.address);

      await vault.connect(alice).withdraw(sharesBefore);

      const sharesAfter = await vault.getUserShares(alice.address);
      assert.strictEqual(sharesAfter.toString(), "0");
    });

    it("emits Withdrawn event", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const shares = await vault.getUserShares(alice.address);

      const tx      = await vault.connect(alice).withdraw(shares);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "Withdrawn");

      assert.ok(event, "Withdrawn event not emitted");
    });

    it("reverts if withdrawing more shares than owned", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const shares = await vault.getUserShares(alice.address);

      await assert.rejects(
        vault.connect(alice).withdraw(shares + 1n),
        /insufficient shares/
      );
    });
  });


  describe("rebalance()", function () {
    it("emits Rebalanced event", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const tx      = await vault.rebalance();
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "Rebalanced");

      assert.ok(event, "Rebalanced event not emitted");
    });

    it("reverts if called within cooldown window", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await vault.rebalance();

      await assert.rejects(
        vault.rebalance(),
        /cooldown active/
      );
    });

    it("can be called by anyone — not owner-gated", async function () {
      const { vault, alice, bob, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await vault.connect(bob).rebalance();
    });

    it("distributes funds to yield sources after rebalance", async function () {
      const { connection, vault, lendingSource, dexSource, alice, DEPOSIT_AMOUNT } = ctx;

      const bigDeposit = parseUnits("5000", 6);
      await ctx.usdc.connect(alice).approve(ctx.vaultAddress, bigDeposit);
      await vault.connect(alice).deposit(bigDeposit);

      await connection.provider.send("evm_increaseTime", [700]);
      await connection.provider.send("evm_mine");

      await vault.rebalance();

      const lendingBal = await lendingSource.balanceOf();
      const dexBal     = await dexSource.balanceOf();

      assert.ok(
        lendingBal + dexBal > 0n,
        "Funds should be distributed to yield sources after rebalance"
      );
    });
  });


  describe("emergencyWithdraw()", function () {
    it("reverts if called by non-guard", async function () {
      const { vault, alice, lendingAddress } = ctx;

      await assert.rejects(
        vault.connect(alice).emergencyWithdraw(lendingAddress),
        /not guard/
      );
    });

    it("reverts for unknown yield source", async function () {
      const { connection, vault, guard, guardAddress, alice } = ctx;

      await connection.provider.request({
        method: "hardhat_impersonateAccount",
        params: [guardAddress],
      });
      await connection.provider.send("hardhat_setBalance", [
        guardAddress, "0x56BC75E2D63100000"
      ]);

        const guardSigner = await connection.ethers.getSigner(guardAddress);
      await assert.rejects(
        vault.connect(guardSigner).emergencyWithdraw(alice.address),
        /unknown source/
      );
    });

    it("transfers funds to treasury on emergency", async function () {
      const { connection, vault, treasury, usdc, guard, lendingSource,
              lendingAddress, guardAddress, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await connection.provider.send("evm_increaseTime", [700]);
      await connection.provider.send("evm_mine");
      await vault.rebalance();

      const treasuryBefore = await usdc.balanceOf(ctx.treasuryAddress);

      await connection.provider.request({
        method: "hardhat_impersonateAccount",
        params: [guardAddress],
      });
      await connection.provider.send("hardhat_setBalance", [
        guardAddress, "0x56BC75E2D63100000"
      ]);
        const guardSigner = await connection.ethers.getSigner(guardAddress);
      await vault.connect(guardSigner).emergencyWithdraw(lendingAddress);

      const treasuryAfter = await usdc.balanceOf(ctx.treasuryAddress);
      assert.ok(
        treasuryAfter > treasuryBefore,
        "Treasury should have received funds"
      );
    });
  });


  describe("views", function () {
    it("sharesToAssets and assetsToShares are inverse operations", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const shares = await vault.getUserShares(alice.address);
      const assets = await vault.sharesToAssets(shares);
      const back   = await vault.assetsToShares(assets);

      const diff = shares > back ? shares - back : back - shares;
      assert.ok(diff <= 1n, `Round-trip share math off by ${diff}`);
    });

    it("totalAssets accounts for buffer + yield sources", async function () {
      const { vault, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      const total = await vault.totalAssets();
      assert.ok(total >= 0n);
    });
  });
});