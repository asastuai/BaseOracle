/**
 * Generate original game assets with OpenAI Images API.
 *
 * Usage:
 * OPENAI_API_KEY=sk-... node scripts/generate-assets.js
 */
import fs from "fs/promises";
import path from "path";

const prompts = [
  {
    name: "background-main",
    prompt:
      "Original fantasy strategy game background, aerial valley with small villages, farms, rivers, roads, atmospheric fog, painterly but clean for web UI, dark blue and warm gold palette, no logos, no text, 16:9"
  },
  {
    name: "ui-panels",
    prompt:
      "Original web strategy game UI panel kit, parchment and polished wood style, buttons, frames, cards, icon slots, high readability, modern game HUD, transparent background, no text"
  },
  {
    name: "resources-icons",
    prompt:
      "Game icon pack, wood clay iron crop resources, consistent style, soft shading, clean edges, transparent background, spritesheet style, original design"
  }
];

async function generateImage(prompt) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const json = await response.json();
  return json.data?.[0]?.b64_json;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const outDir = path.join(process.cwd(), "public", "assets");
  await fs.mkdir(outDir, { recursive: true });

  for (const item of prompts) {
    const b64 = await generateImage(item.prompt);
    if (!b64) throw new Error(`No image data for ${item.name}`);

    const outFile = path.join(outDir, `${item.name}.png`);
    await fs.writeFile(outFile, Buffer.from(b64, "base64"));
    console.log(`Saved ${outFile}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
