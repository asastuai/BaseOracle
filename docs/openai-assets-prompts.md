# Generación de assets originales con OpenAI Images

Sí: lo dejé listo para generar un primer set visual original sin copiar IP.

## Script incluido

Puedes generar imágenes directo con:

```bash
OPENAI_API_KEY=sk-... npm run generate-assets
```

Esto usa `scripts/generate-assets.js` y guarda imágenes en `public/assets/`.

## Estilo guía

- Tema: estrategia medieval-fantástica, limpio, legible, web game UI.
- Paleta: azul noche, dorado tenue, verde cultivo.
- Restricción: **no usar nombres/marcas/logos ni siluetas reconocibles de juegos existentes**.

## Prompts recomendados

### 1) Fondo principal
"Original fantasy strategy game background, aerial valley with small villages, farms, rivers, roads, atmospheric fog, painterly but clean for web UI, dark blue and warm gold palette, no logos, no text, 16:9"

### 2) Panel UI
"Original web strategy game UI panel kit, parchment and polished wood style, buttons, frames, cards, icon slots, high readability, modern game HUD, transparent background, no text"

### 3) Recursos (icon pack)
"Game icon pack, wood clay iron crop resources, consistent style, soft shading, clean edges, transparent background, spritesheet style, original design"

### 4) Tropas básicas
"Two original unit portraits for strategy game: warrior and defender, stylized semi-realistic, chest-up, neutral background, game-ready card art, no references to existing franchises"

### 5) Edificios
"Isometric building icons for strategy city builder: town hall, barracks, warehouse, farm, wall tower, coherent art direction, transparent background, original IP-safe style"
