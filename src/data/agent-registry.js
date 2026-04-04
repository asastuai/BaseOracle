/**
 * Agent Registry: directory of verified on-chain agents
 * In-memory for now, can migrate to on-chain or DB later
 */

const registry = new Map();

export function registerAgent(agentData) {
  const { address, name, description, capabilities, chain, endpoint } = agentData;
  if (!address || !name) return { error: "address and name required" };

  registry.set(address.toLowerCase(), {
    address: address.toLowerCase(),
    name,
    description: description || "",
    capabilities: capabilities || [],
    chain: chain || "base",
    endpoint: endpoint || null,
    registered_at: new Date().toISOString(),
    verified: false, // manual verification by admin
    queries_served: 0,
  });

  return { success: true, message: `Agent ${name} registered`, address };
}

export function getAgent(address) {
  if (!address) return { error: "address required" };
  const agent = registry.get(address.toLowerCase());
  if (!agent) return { error: "Agent not found" };
  return agent;
}

export function listAgents(chain, capability) {
  let agents = Array.from(registry.values());

  if (chain) agents = agents.filter(a => a.chain === chain);
  if (capability) agents = agents.filter(a => a.capabilities.includes(capability));

  return {
    count: agents.length,
    agents: agents.sort((a, b) => b.queries_served - a.queries_served),
    timestamp: new Date().toISOString(),
  };
}

export function incrementQueries(address) {
  const agent = registry.get(address?.toLowerCase());
  if (agent) agent.queries_served++;
}
