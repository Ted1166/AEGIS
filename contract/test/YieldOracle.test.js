import hre from "hardhat";
import assert from "assert";
import { parseUnits } from "ethers";
import { network } from "hardhat";
import { deployAegis } from "./helpers/fixtures.js";

describe("YieldOracle", function () {
  let ctx;

  beforeEach(async function () {
    ctx = await deployAegis();
  });


  describe("writeScore() — access control", function () {
    it("reverts for unauthorized caller", async function () {
      const { oracle, alice, lendingAddress, TVL_FLOOR } = ctx;

      await assert.rejects(
        oracle.connect(alice).writeScore(
          lendingAddress, 700, 100, 800,
          parseUnits("5000000", 6), TVL_FLOOR
        ),
        /not authorized writer/
      );
    });

    it("authorized scorer can write score", async function () {
      const { oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      const entry = await oracle.getScoreUnchecked(lendingAddress);
      assert.ok(entry.score > 0n, "Score should be non-zero");
    });

    it("owner can write score without being added as writer", async function () {
      const { oracle, owner, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(owner).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );
    });

    it("reverts for untracked protocol", async function () {
      const { oracle, scorer, alice, TVL_FLOOR } = ctx;

      await assert.rejects(
        oracle.connect(scorer).writeScore(
          alice.address, 700, 100, 800,
          parseUnits("5000000", 6), TVL_FLOOR
        ),
        /protocol not tracked/
      );
    });
  });


  describe("writeScore() — score values", function () {
    it("emits ScoreUpdated event", async function () {
      const { oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      const tx      = await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );
      const receipt = await tx.wait();

      const event = receipt.logs
        .map(l => { try { return oracle.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "ScoreUpdated");

      assert.ok(event, "ScoreUpdated event not emitted");
      assert.strictEqual(event.args.protocol, lendingAddress);
    });

    it("high real yield scores in Sustainable tier (>=70)", async function () {
      const { oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress,
        800, 0, 800,
        parseUnits("5000000", 6),
        TVL_FLOOR
      );

      const entry = await oracle.getScoreUnchecked(lendingAddress);
      assert.ok(entry.score >= 70n, `Expected score >= 70, got ${entry.score}`);
      assert.strictEqual(Number(entry.tier), 2);
    });

    it("heavy emissions scores in Risky tier (<40)", async function () {
      const { oracle, scorer, dexAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        dexAddress,
        0, 5000, 5000,
        parseUnits("100000", 6),
        TVL_FLOOR
      );

      const entry = await oracle.getScoreUnchecked(dexAddress);
      assert.ok(entry.score < 40n, `Expected score < 40, got ${entry.score}`);
      assert.strictEqual(Number(entry.tier), 0);
    });

    it("stores all fields correctly", async function () {
      const { oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      const tvl = parseUnits("5000000", 6);
      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800, tvl, TVL_FLOOR
      );

      const entry = await oracle.getScoreUnchecked(lendingAddress);
      assert.strictEqual(entry.realYieldBps.toString(),      "700");
      assert.strictEqual(entry.emissionsYieldBps.toString(), "100");
      assert.strictEqual(entry.totalAPYBps.toString(),       "800");
      assert.strictEqual(entry.tvl.toString(),               tvl.toString());
      assert.ok(entry.active, "Entry should be active");
    });
  });


  describe("getScore() — staleness", function () {
    it("returns fresh score within maxScoreAge", async function () {
      const { oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      const entry = await oracle.getScore(lendingAddress);
      assert.ok(entry.score > 0n);
    });

    it("reverts on stale score", async function () {
      const { connection, oracle, scorer, owner, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      await connection.provider.send("evm_increaseTime", [7201]);
      await connection.provider.send("evm_mine");

      await assert.rejects(
        oracle.getScore(lendingAddress),
        /score stale/
      );
    });

    it("getScoreUnchecked returns stale score without revert", async function () {
      const { connection, oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      await connection.provider.send("evm_increaseTime", [7201]);
      await connection.provider.send("evm_mine");

      const entry = await oracle.getScoreUnchecked(lendingAddress);
      assert.ok(entry.score > 0n);
    });

    it("isScoreFresh returns false after maxScoreAge", async function () {
      const { connection, oracle, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(scorer).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      await connection.provider.send("evm_increaseTime", [7201]);
      await connection.provider.send("evm_mine");

      const fresh = await oracle.isScoreFresh(lendingAddress);
      assert.strictEqual(fresh, false);
    });
  });


  describe("protocol tracking", function () {
    it("getTrackedProtocols returns all added protocols", async function () {
      const { oracle, lendingAddress, dexAddress } = ctx;

      const tracked = await oracle.getTrackedProtocols();
      assert.ok(tracked.includes(lendingAddress), "Lending source should be tracked");
      assert.ok(tracked.includes(dexAddress),     "DEX source should be tracked");
    });

    it("removeProtocol marks it inactive", async function () {
      const { oracle, owner, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(owner).removeProtocol(lendingAddress);

      const entry = await oracle.getScoreUnchecked(lendingAddress);
      assert.strictEqual(entry.active, false);
    });

    it("reverts writeScore for removed protocol", async function () {
      const { oracle, owner, scorer, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(owner).removeProtocol(lendingAddress);

      await assert.rejects(
        oracle.connect(scorer).writeScore(
          lendingAddress, 700, 100, 800,
          parseUnits("5000000", 6), TVL_FLOOR
        ),
        /protocol not tracked/
      );
    });
  });


  describe("writer management", function () {
    it("owner can add and remove writers", async function () {
      const { oracle, owner, alice, lendingAddress, TVL_FLOOR } = ctx;

      await oracle.connect(owner).addWriter(alice.address);

      await oracle.connect(alice).writeScore(
        lendingAddress, 700, 100, 800,
        parseUnits("5000000", 6), TVL_FLOOR
      );

      await oracle.connect(owner).removeWriter(alice.address);

      await assert.rejects(
        oracle.connect(alice).writeScore(
          lendingAddress, 700, 100, 800,
          parseUnits("5000000", 6), TVL_FLOOR
        ),
        /not authorized writer/
      );
    });

    it("activeProtocolCount returns correct count", async function () {
      const { oracle } = ctx;
      const count = await oracle.activeProtocolCount();
      assert.strictEqual(count.toString(), "2");
    });
  });
});