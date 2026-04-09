const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EmpireChainGame", function () {
  async function setup() {
    const [alice, bob] = await ethers.getSigners();
    const Game = await ethers.getContractFactory("EmpireChainGame");
    const game = await Game.deploy();
    await game.waitForDeployment();
    return { game, alice, bob };
  }

  it("creates villages and claims resources over time", async function () {
    const { game, alice } = await setup();
    await game.connect(alice).createVillage();

    const before = await game.villages(alice.address);
    await time.increase(3600);
    await game.connect(alice).claimResources();
    const after = await game.villages(alice.address);

    expect(after.wood).to.be.greaterThan(before.wood);
  });

  it("queues and finalizes troop training with helper timestamp", async function () {
    const { game, alice } = await setup();
    await game.connect(alice).createVillage();

    await game.connect(alice).queueTraining(10, 5);
    const readyAt = await game.trainingReadyAt(alice.address);
    expect(readyAt).to.be.greaterThan(0n);

    await expect(game.connect(alice).finalizeTraining()).to.be.revertedWithCustomError(game, "TrainingNotReady");

    await time.increase(5 * 60 + 1);
    await game.connect(alice).finalizeTraining();

    const village = await game.villages(alice.address);
    expect(village.warriors).to.be.greaterThan(20);
  });

  it("reverts attack when trying to self-attack", async function () {
    const { game, alice } = await setup();
    await game.connect(alice).createVillage();

    await expect(game.connect(alice).attack(alice.address, 1, 0)).to.be.revertedWithCustomError(game, "CannotAttackSelf");
  });

  it("resolves attack and keeps economies non-negative", async function () {
    const { game, alice, bob } = await setup();
    await game.connect(alice).createVillage();
    await game.connect(bob).createVillage();

    await game.connect(alice).attack(bob.address, 15, 10);

    const attacker = await game.villages(alice.address);
    const defender = await game.villages(bob.address);

    expect(attacker.wood).to.be.greaterThanOrEqual(0n);
    expect(defender.wood).to.be.greaterThanOrEqual(0n);
  });
});
