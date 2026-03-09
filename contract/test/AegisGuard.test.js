import hre from "hardhat";
import assert from "assert";
import { parseUnits } from "ethers";
import { deployAegis } from "./helpers/fixtures.js";
import { network } from "hardhat";

const SignalType = {
  TVL_DRAINAGE:           0,
  ORACLE_DEVIATION:       1,
  FLASH_LOAN_SPIKE:       2,
  ACCESS_CONTROL_ANOMALY: 3,
};

describe("AegisGuard", function () {
  let ctx;

  beforeEach(async function () {
    ctx = await deployAegis();
  });


  describe("recordSignal()", function () {
    it("reverts for unauthorized caller", async function () {
      const { guard, alice, lendingAddress } = ctx;

      await assert.rejects(
        guard.connect(alice).recordSignal(
          lendingAddress, SignalType.TVL_DRAINAGE, 200
        ),
        /not authorized/
      );
    });

    it("authorized sentinel can record signal", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      await guard.connect(sentinel).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 200
      );

      const [tvl, , , , total] = await guard.getSignalState(lendingAddress);
      assert.ok(tvl, "TVL_DRAINAGE signal should be active");
      assert.strictEqual(total.toString(), "1");
    });

    it("emits SignalRecorded event on activation", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      const tx      = await guard.connect(sentinel).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 200
      );
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return guard.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "SignalRecorded");

      assert.ok(event, "SignalRecorded event not emitted");
      assert.strictEqual(Number(event.args.signal), SignalType.TVL_DRAINAGE);
    });

    it("signal deactivates when value drops below threshold", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      await guard.connect(sentinel).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 200
      );
      let [tvl, , , , total] = await guard.getSignalState(lendingAddress);
      assert.ok(tvl);
      assert.strictEqual(total.toString(), "1");

      await guard.connect(sentinel).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 50
      );
      [tvl, , , , total] = await guard.getSignalState(lendingAddress);
      assert.ok(!tvl, "Signal should be inactive below threshold");
      assert.strictEqual(total.toString(), "0");
    });
  });


  describe("recordSignals()", function () {
    it("records multiple signals in one tx", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      await guard.connect(sentinel).recordSignals(
        lendingAddress,
        [SignalType.TVL_DRAINAGE, SignalType.ORACLE_DEVIATION],
        [200, 500]
      );

      const [tvl, oracle, , , total] = await guard.getSignalState(lendingAddress);
      assert.ok(tvl,    "TVL_DRAINAGE should be active");
      assert.ok(oracle, "ORACLE_DEVIATION should be active");
      assert.strictEqual(total.toString(), "2");
    });

    it("reverts on length mismatch", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      await assert.rejects(
        guard.connect(sentinel).recordSignals(
          lendingAddress,
          [SignalType.TVL_DRAINAGE],
          [200, 300]
        ),
        /length mismatch/
      );
    });
  });


  describe("checkAndExecute()", function () {
    it("returns false when below threshold", async function () {
      const { guard, keeper, lendingAddress } = ctx;

      await guard.connect(ctx.sentinel).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 200
      );

      const triggered = await guard.connect(keeper)
        .checkAndExecute.staticCall(lendingAddress);

      assert.strictEqual(triggered, false);
    });

    it("triggers emergency when 2+ signals active", async function () {
      const { connection, guard, vault, usdc, sentinel, keeper,
              lendingAddress, treasuryAddress, alice, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await connection.provider.send("evm_increaseTime", [700]);
      await connection.provider.send("evm_mine");
      await vault.rebalance();

      await guard.connect(sentinel).recordSignals(
        lendingAddress,
        [SignalType.TVL_DRAINAGE, SignalType.ORACLE_DEVIATION],
        [200, 500]
      );

      const treasuryBefore = await usdc.balanceOf(treasuryAddress);
      const tx      = await guard.connect(keeper).checkAndExecute(lendingAddress);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return guard.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "EmergencyTriggered");

      assert.ok(event, "EmergencyTriggered event not emitted");
      assert.strictEqual(event.args.caller, keeper.address);
    });

    it("sets isEmergency flag after trigger", async function () {
      const { guard, vault, sentinel, keeper, alice,
              lendingAddress, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await guard.connect(sentinel).recordSignals(
        lendingAddress,
        [SignalType.TVL_DRAINAGE, SignalType.ORACLE_DEVIATION],
        [200, 500]
      );

      await guard.connect(keeper).checkAndExecute(lendingAddress);

      const inEmergency = await guard.isEmergency(lendingAddress);
      assert.ok(inEmergency, "Protocol should be in emergency state");
    });

    it("returns false if already in emergency", async function () {
      const { connection, guard, vault, sentinel, keeper, alice,
              lendingAddress, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await guard.connect(sentinel).recordSignals(
        lendingAddress,
        [SignalType.TVL_DRAINAGE, SignalType.ORACLE_DEVIATION],
        [200, 500]
      );

      await guard.connect(keeper).checkAndExecute(lendingAddress);

      for (let i = 0; i < 15; i++) {
        await connection.provider.send("evm_mine");
      }

      const triggered = await guard.connect(keeper)
        .checkAndExecute.staticCall(lendingAddress);
      assert.strictEqual(triggered, false);
    });

    it("respects block cooldown between calls", async function () {
      const { guard, keeper, lendingAddress } = ctx;

      await guard.connect(keeper).checkAndExecute(lendingAddress);

      await assert.rejects(
        guard.connect(keeper).checkAndExecute(lendingAddress),
        /cooldown active/
      );
    });

    it("isCheckable returns false during cooldown", async function () {
      const { guard, keeper, lendingAddress } = ctx;

      await guard.connect(keeper).checkAndExecute(lendingAddress);

      const checkable = await guard.isCheckable(lendingAddress);
      assert.strictEqual(checkable, false);
    });
  });


  describe("admin", function () {
    it("owner can add and remove signal writers", async function () {
      const { guard, owner, alice, lendingAddress } = ctx;

      await guard.connect(owner).addSignalWriter(alice.address);

      await guard.connect(alice).recordSignal(
        lendingAddress, SignalType.TVL_DRAINAGE, 200
      );

      await guard.connect(owner).removeSignalWriter(alice.address);

      await assert.rejects(
        guard.connect(alice).recordSignal(
          lendingAddress, SignalType.TVL_DRAINAGE, 200
        ),
        /not authorized/
      );
    });

    it("owner can reset emergency state", async function () {
      const { guard, vault, sentinel, keeper, owner, alice,
              lendingAddress, DEPOSIT_AMOUNT } = ctx;

      await vault.connect(alice).deposit(DEPOSIT_AMOUNT);
      await guard.connect(sentinel).recordSignals(
        lendingAddress,
        [SignalType.TVL_DRAINAGE, SignalType.ORACLE_DEVIATION],
        [200, 500]
      );
      await guard.connect(keeper).checkAndExecute(lendingAddress);

      assert.ok(await guard.isEmergency(lendingAddress));

      await guard.connect(owner).resetEmergency(lendingAddress);

      assert.ok(!(await guard.isEmergency(lendingAddress)));
    });

    it("owner can update thresholds", async function () {
      const { guard, owner } = ctx;

      await guard.connect(owner).setThresholds(50, 100, parseUnits("5", 18));

      assert.strictEqual(
        (await guard.tvlDrainageThresholdBps()).toString(), "50"
      );
    });

    it("non-owner cannot update thresholds", async function () {
      const { guard, alice } = ctx;

      await assert.rejects(
        guard.connect(alice).setThresholds(50, 100, parseUnits("5", 18)),
        /not owner/
      );
    });
  });


  describe("ACCESS_CONTROL_ANOMALY signal", function () {
    it("activates on value >= 1", async function () {
      const { guard, sentinel, lendingAddress } = ctx;

      await guard.connect(sentinel).recordSignal(
        lendingAddress, SignalType.ACCESS_CONTROL_ANOMALY, 1
      );

      const [, , , access, total] = await guard.getSignalState(lendingAddress);
      assert.ok(access, "ACCESS_CONTROL_ANOMALY should be active");
      assert.strictEqual(total.toString(), "1");
    });
  });
});