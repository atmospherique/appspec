# @missionhud/appspec-adapter-figma

Reference adapter for the Figma plugin ↔ AppSpec wire format. Defines the JSON shape a Figma plugin sends/receives, plus pure validators and helpers for walking the component tree.

## Install

```bash
npm install @missionhud/appspec-adapter-figma
```

## Use

### Validate an incoming Figma import payload

```js
const { validateImportPayload } = require('@missionhud/appspec-adapter-figma');

const payload = {
  $kind: 'mockingbird.figmaExport.v1',
  fileKey: 'abc123',
  fileName: 'My Design',
  libraries: [{ $id: 'ios-18', name: 'iOS 18 UI Kit' }],
  designTokens: { color: { primary: { $value: '#000', $type: 'color' } } },
  screens: [/* ... */],
};

const { valid, issues } = validateImportPayload(payload);
if (!valid) console.error('Bad payload:', issues);
```

### Apply an AI-driven slug mapping

```js
const { applyComponentRefMapping } = require('@missionhud/appspec-adapter-figma');

// Suppose an AI mapper has resolved local Figma component names to
// missionhud-default slugs:
const mappings = {
  'local/HeroBox':   'missionhud-default/HeroCard',
  'local/Button':    'missionhud-default/PrimaryButton',
  'remote/NavBar':   'missionhud-default/AppHeader',
};

const rewritten = applyComponentRefMapping(appSpec, mappings);
console.log(`Rewrote ${rewritten} component instances`);
// Each rewritten instance also gets _provenance.componentRefRewrite
// stamped for audit-trail traceability.
```

### Walk the components tree

```js
const { walkComponentsTree } = require('@missionhud/appspec-adapter-figma');

// Visit every Component instance in a screen, including nested
// instance-swap properties and items[]
const components = appSpec.screens.content[0].components;
walkComponentsTree(components, (comp, pathContext) => {
  console.log('found', comp.componentRef, 'at depth', pathContext.length);
});
```

### Package an export payload

```js
const { buildExportPayloadFromAppSpec } = require('@missionhud/appspec-adapter-figma');

const payload = buildExportPayloadFromAppSpec(appSpec);
// → { $kind: 'mockingbird.appSpecForFigma.v1', appSpec }
// Send to the Figma plugin via postMessage.
```

## Wire format

### Import (plugin → server)

```jsonc
{
  "$kind": "mockingbird.figmaExport.v1",
  "fileKey": "abc123…",
  "fileName": "Untitled",

  // Libraries this file uses (so server can resolve componentRefs)
  "libraries": [
    { "$id": "ios-18", "name": "iOS 18 UI Kit", "componentCount": 156 }
  ],

  // DTCG-shaped tokens converted from Figma Variables
  "designTokens": { "color": {/*…*/}, "dimension": {/*…*/} },

  // Pages → screens. Frames at the page root become screens.
  "screens": [
    {
      "id": "screen_<frame-id>",
      "name": "Dashboard",
      "layout": {/* Auto Layout config */},
      "components": [
        {
          "id": "comp_<instance-id>",
          "componentRef": "ios-18/NavBar",
          "variant": { "style": "large-title" },
          "properties": { "title": "Dashboard" },
          "layout": { "mode": "vertical", "sizing": {/*…*/} }
        }
      ]
    }
  ]
}
```

### Export (server → plugin)

```jsonc
{
  "$kind": "mockingbird.appSpecForFigma.v1",
  "appSpec": { /* …v10 AppSpec… */ }
}
```

## What's NOT in scope (stays product-specific)

- **AI componentRef mapping** (`aiMapComponentRefs`) — needs an LLM. The Mission HUD Designer reference impl uses Anthropic Opus + a slug-mapping prompt; bring your own AI.
- **AI Figma Variables → DTCG** — same; needs LLM-driven type inference.
- **Full `buildAppSpecFromImport`** — depends on consumer-specific library catalogs, theme curation, v9 adapter resolution. The wire format is open; how you interpret it is your product.
- **Theme preset fallback** — uses consumer-specific theme catalog.

The Mission HUD Designer reference implementation lives in [`mockingbird-lab/proxy-server/lib/figma-interop`](https://github.com/bradmanners/mockingbird-lab/blob/main/proxy-server/lib/figma-interop/index.js); read it as the canonical consumer pattern.

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
