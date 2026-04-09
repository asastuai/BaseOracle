async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Game = await ethers.getContractFactory("EmpireChainGame");
  const game = await Game.deploy();
  await game.waitForDeployment();

  const address = await game.getAddress();
  console.log("EmpireChainGame deployed at:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
