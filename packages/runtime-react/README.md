# @missionhud/appspec-runtime-react

Runtime React renderer for AppSpec. **Walks the spec live; no codegen step.** For each `ComponentInstance`, looks up the library descriptor's `nativeMapping.runtime-react` entry and mounts the corresponding registered component.

Pairs with `@missionhud/appspec-patch`'s `createPatchStream()` so an LLM can stream RFC 6902 patches and the UI repaints progressively.

## Install

```bash
npm install @missionhud/appspec-runtime-react react
```

## Use — minimum example

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  createRegistry, createRuntime, AppSpecRenderer
} from '@missionhud/appspec-runtime-react';
import shadcnLibrary from '@missionhud/appspec/spec/v10/libraries/shadcn-ui.json';

// 1. Register the actual React components against the names the
//    library descriptor's nativeMapping points at:
const shadcnRegistry = createRegistry('@missionhud/runtime-shadcn-ui', {
  Card,
  Button,
  // ... map all components your AppSpec needs
});

// 2. Build a runtime with the library descriptor + registry:
const runtime = createRuntime({
  libraries: { 'shadcn-ui': shadcnLibrary },
  registries: [shadcnRegistry],
});

// 3. Render any AppSpec live:
const spec = { /* a v10 AppSpec referencing shadcn-ui/Card, etc */ };
createRoot(document.getElementById('root')).render(
  <AppSpecRenderer spec={spec} runtime={runtime} />
);
```

## Use — streaming (live AI iteration)

```jsx
import { useAppSpecStream, AppSpecRenderer } from '@missionhud/appspec-runtime-react';

function LiveAppRenderer({ initialSpec, runtime }) {
  const { spec, applyOps } = useAppSpecStream(initialSpec, {
    source: 'mockingbird-ai',
    onUpdate: (next, ops) => console.log('Repainted, ops:', ops.length),
  });

  useEffect(() => {
    // Connect to whatever streams patches — MCP, SSE, WebSocket, etc.
    const es = new EventSource('/api/llm-patch-stream');
    es.addEventListener('patch', (e) => {
      const { operations } = JSON.parse(e.data);
      applyOps(operations);
    });
    return () => es.close();
  }, []);

  return <AppSpecRenderer spec={spec} runtime={runtime} />;
}
```

As patches arrive, `spec` updates, `<AppSpecRenderer>` re-renders. No reload, no rebuild.

## How resolution works

For a `<ComponentInstance>` with `componentRef: "shadcn-ui/Card"`, the runtime:

1. **Splits the ref** → `libId = "shadcn-ui"`, `slug = "Card"`
2. **Looks up the library descriptor** at `runtime.libraries["shadcn-ui"]`
3. **Walks to** `lib.components.Card.nativeMapping["runtime-react"]`, which says e.g.:
   ```json
   { "kind": "runtime", "registry": "@missionhud/runtime-shadcn-ui", "componentName": "Card" }
   ```
4. **Looks up the registry** by that name
5. **Pulls the actual React component** from `registry.get("Card")`
6. **Mounts it** with props built from the AppSpec instance (with `propertyMap` rename applied)

Nothing in this loop requires codegen. The descriptor IS the contract.

## API

| Export | Description |
|---|---|
| `createRegistry(name, components)` | Named bag of React components keyed by the names `nativeMapping.runtime-react.componentName` points at |
| `createRuntime({ libraries, registries, onUnresolved?, strict? })` | Top-level runtime config — bundles library descriptors with registries |
| `<AppSpecRenderer spec runtime [screenId] [wrapScreens] />` | Top-level renderer — walks the spec's screens.content |
| `<ScreenRenderer screen runtime [wrap] />` | Render one Screen object |
| `<ComponentRenderer comp runtime />` | Render one ComponentInstance |
| `useAppSpecStream(initialSpec, opts)` | React hook over `createPatchStream`; returns `{ spec, applyOps, flush, operationsLog }` |

### `createRuntime` options

| Option | Default | What |
|---|---|---|
| `libraries` | `{}` | Map of `libId → libraryDescriptor` |
| `registries` | `[]` | Array of registries created via `createRegistry()` |
| `onUnresolved` | shows `[unresolved: <ref>]` placeholder | Callback for unresolved componentRefs |
| `strict` | `false` | Throw on unresolved instead of falling back |

## When to use this vs codegen

| Use case | Mode | Pick |
|---|---|---|
| Ship a real app you own | Codegen | Builder's React/SwiftUI/Compose pipelines |
| AI-generated dashboards, chat-rendered widgets, live-iterating UIs | Runtime | This package |
| AI tweaks a designer's draft live in a preview | Runtime + streaming | This package + `useAppSpecStream` |
| Standalone code that runs without the runtime walker | Codegen | Builder |

The runtime walker and codegen are not competitors — they're two consumption modes for the same AppSpec, driven by the same library descriptors.

## Roadmap to production-grade ("C-tier")

This is a reference implementation. Real productions extend with:

- **Server-component awareness** — split between server / client at render time
- **Suspense + error boundaries** at every level
- **DTCG theme injection** — CSS variables from `appSpec.designTokens` before the tree mounts (defer to `@missionhud/appspec-adapter-tailwind` for the variable export)
- **Accessibility helpers** — auto-add `aria-*` from semantic context
- **Type-checking** — narrow prop types against the library descriptor's `properties` schema
- **Devtools** — visualise the resolution path (componentRef → library → registry → mounted)
- **`valueTransforms`** — execute the transforms declared in `nativeMapping`

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
