const CONTRACT_KEY = "empirechain.contract";

const abi = [
  "function createVillage() external",
  "function claimResources() external",
  "function queueTraining(uint256 warriorAmount, uint256 defenderAmount) external",
  "function finalizeTraining() external",
  "function attack(address defender, uint256 warriorsSent, uint256 defendersSent) external",
  "function trainingReadyAt(address player) external view returns (uint256)",
  "function villages(address player) external view returns (bool created, uint256 wood, uint256 clay, uint256 iron, uint256 crop, uint256 lastClaim, uint256 warriors, uint256 defenders)"
];

const el = (id) => document.getElementById(id);
const logView = el("logView");

let provider;
let signer;
let contract;
let appConfig = {
  chainId: 84532,
  chainName: "Base Sepolia",
  contractAddress: "",
  rpcUrl: "https://sepolia.base.org",
  blockExplorerUrl: "https://sepolia.basescan.org"
};

function log(message) {
  logView.textContent = `[${new Date().toLocaleTimeString()}] ${message}\n` + logView.textContent;
}

function getContractAddress() {
  return el("contractAddress").value.trim();
}

function renderNetwork() {
  el("networkView").textContent = JSON.stringify(appConfig, null, 2);
}

async function loadRemoteConfig() {
  const response = await fetch("/api/v1/game-config");
  if (!response.ok) throw new Error("No se pudo cargar /api/v1/game-config");
  appConfig = await response.json();

  if (!getContractAddress() && appConfig.contractAddress) {
    el("contractAddress").value = appConfig.contractAddress;
    localStorage.setItem(CONTRACT_KEY, appConfig.contractAddress);
  }

  renderNetwork();
  log("Config remota cargada.");
}

async function ensureContract() {
  const address = getContractAddress();
  if (!address) throw new Error("Configura la dirección de contrato");
  if (!ethers.isAddress(address)) throw new Error("Dirección de contrato inválida");
  contract = new ethers.Contract(address, abi, signer);
  return contract;
}

async function switchToGameNetwork() {
  if (!window.ethereum) throw new Error("MetaMask no detectado");
  const chainHex = `0x${Number(appConfig.chainId).toString(16)}`;

  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
    log(`Wallet cambiada a chainId ${appConfig.chainId}.`);
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainHex,
          chainName: appConfig.chainName,
          rpcUrls: [appConfig.rpcUrl],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: [appConfig.blockExplorerUrl]
        }]
      });
      log(`Red ${appConfig.chainName} agregada y seleccionada.`);
      return;
    }

    throw error;
  }
}

async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask no detectado");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const wallet = await signer.getAddress();
  el("walletState").textContent = `Conectado: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  await ensureContract();
  log("Wallet conectada correctamente.");
}

function renderVillage(targetEl, v) {
  targetEl.textContent = JSON.stringify({
    created: v.created,
    wood: v.wood.toString(),
    clay: v.clay.toString(),
    iron: v.iron.toString(),
    crop: v.crop.toString(),
    lastClaim: Number(v.lastClaim) ? new Date(Number(v.lastClaim) * 1000).toLocaleString() : "-",
    warriors: v.warriors.toString(),
    defenders: v.defenders.toString()
  }, null, 2);
}

async function refreshVillage() {
  if (!signer) return;
  await ensureContract();
  const address = await signer.getAddress();
  const [v, readyAt] = await Promise.all([contract.villages(address), contract.trainingReadyAt(address)]);
  renderVillage(el("villageView"), v);

  el("trainingView").textContent = readyAt > 0n
    ? `Ready at: ${new Date(Number(readyAt) * 1000).toLocaleString()}`
    : "Sin cola activa";
}

async function inspectTargetVillage() {
  try {
    if (!signer) await connectWallet();
    await ensureContract();
    const target = el("inspectTargetInput").value.trim();
    if (!ethers.isAddress(target)) throw new Error("Dirección target inválida");
    const targetVillage = await contract.villages(target);
    renderVillage(el("targetVillageView"), targetVillage);
  } catch (error) {
    log(`Scout falló: ${error.shortMessage || error.message}`);
  }
}

async function writeTx(action, fn) {
  try {
    if (!signer) await connectWallet();
    await ensureContract();
    log(`Enviando tx: ${action}...`);
    const tx = await fn();
    await tx.wait();
    log(`OK: ${action}. Tx ${tx.hash}`);
    await refreshVillage();
  } catch (error) {
    log(`Error en ${action}: ${error.shortMessage || error.message}`);
  }
}

function attachEvents() {
  el("connectBtn").onclick = () => connectWallet().then(refreshVillage).catch((e) => log(e.message));
  el("switchChainBtn").onclick = () => switchToGameNetwork().catch((e) => log(e.message));
  el("loadConfigBtn").onclick = () => loadRemoteConfig().catch((e) => log(e.message));

  el("saveContractBtn").onclick = () => {
    localStorage.setItem(CONTRACT_KEY, getContractAddress());
    log("Dirección de contrato guardada en localStorage.");
  };

  el("openExplorerBtn").onclick = () => {
    const address = getContractAddress();
    if (!address) return log("Carga primero una dirección de contrato.");
    window.open(`${appConfig.blockExplorerUrl}/address/${address}`, "_blank");
  };

  el("createVillageBtn").onclick = () => writeTx("createVillage", () => contract.createVillage());
  el("claimBtn").onclick = () => writeTx("claimResources", () => contract.claimResources());
  el("queueBtn").onclick = () => writeTx("queueTraining", () => contract.queueTraining(el("warriorsInput").value, el("defendersInput").value));
  el("finalizeBtn").onclick = () => writeTx("finalizeTraining", () => contract.finalizeTraining());
  el("attackBtn").onclick = () => writeTx("attack", () => contract.attack(el("targetInput").value, el("attackWarriors").value, el("attackDefenders").value));
  el("refreshBtn").onclick = () => refreshVillage().catch((e) => log(e.message));
  el("inspectBtn").onclick = () => inspectTargetVillage();
}

async function boot() {
  const saved = localStorage.getItem(CONTRACT_KEY);
  if (saved) {
    el("contractAddress").value = saved;
  }

  attachEvents();
  renderNetwork();

  try {
    await loadRemoteConfig();
  } catch {
    log("No se pudo cargar config remota; usando valores default.");
  }

  log("Frontend listo. Conecta wallet para comenzar.");
}

boot();
