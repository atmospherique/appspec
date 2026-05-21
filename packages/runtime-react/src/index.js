/**
 * @missionhud/appspec-runtime-react
 *
 * Runtime React renderer that walks an AppSpec live — no codegen step.
 * For each ComponentInstance in the spec, looks up its library
 * descriptor, resolves the componentRef through `nativeMapping.runtime-react`,
 * and mounts the corresponding registered component.
 *
 * Pairs with @missionhud/appspec-patch's createPatchStream() so an LLM
 * can stream RFC 6902 patches and the UI repaints progressively.
 *
 * Public exports:
 *   createRegistry(name, components)   — build a runtime registry
 *   createRuntime(opts)                — top-level runtime config
 *   AppSpecRenderer                    — React component: <AppSpecRenderer spec={...} runtime={...} />
 *   ScreenRenderer, ComponentRenderer  — drop-down components for finer control
 *   useAppSpecStream                   — React hook: streaming AppSpec mutation
 *
 * This is a REFERENCE walker — minimal, clear, ~300 lines. Production
 * use cases (server-component awareness, suspense, error boundaries,
 * accessibility lints, dev-mode warnings) extend.
 */

'use strict';

const React = require('react');
const { createElement, Fragment, useState, useEffect, useMemo, useRef } = React;
const { createPatchStream } = require('@missionhud/appspec-patch');
const { isV10SchemaId } = require('@missionhud/appspec-core');

// ─────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a runtime registry — a named bag of React components keyed
 * by the names library descriptors reference in
 * `nativeMapping.runtime-react.componentName`.
 *
 *   const shadcnRegistry = createRegistry('@missionhud/runtime-shadcn-ui', {
 *     Card: ShadcnCard,
 *     Button: ShadcnButton,
 *     // ...
 *   });
 *
 * @param {string} name - matches the `registry` field in nativeMapping
 * @param {Object<string, React.ComponentType>} components
 * @returns {{ name, components, get }}
 */
function createRegistry(name, components) {
  if (typeof name !== 'string' || !name) {
    throw new Error('createRegistry: name is required');
  }
  if (!components || typeof components !== 'object') {
    throw new Error('createRegistry: components map is required');
  }
  return {
    name,
    components,
    get(componentName) {
      return components[componentName] || null;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Runtime config
// ─────────────────────────────────────────────────────────────────────

/**
 * Build a runtime — a bundle of library descriptors + registries that
 * the renderer uses to resolve every componentRef to a mounted React
 * component.
 *
 * @param {object} opts
 * @param {Object<string, object>} opts.libraries - { '<libraryId>': libraryDescriptor }
 * @param {Array<Registry>} opts.registries - registries keyed by name
 * @param {(componentRef, ctx) => React.ComponentType} [opts.onUnresolved]
 *   - Optional fallback for unresolved componentRefs. Defaults to a
 *     visible "unknown component" placeholder.
 * @param {boolean} [opts.strict=false]
 *   - If true, throw on unresolved instead of falling back.
 * @returns {Runtime}
 */
function createRuntime(opts = {}) {
  const {
    libraries = {},
    registries = [],
    onUnresolved,
    strict = false,
  } = opts;

  const registriesByName = Object.create(null);
  for (const r of registries) {
    registriesByName[r.name] = r;
  }

  /**
   * Resolve a componentRef like "shadcn-ui/Card" to {Component, propertyMap}.
   * Walks: library descriptor → runtime-react nativeMapping →
   * registry lookup.
   */
  function resolve(componentRef) {
    if (typeof componentRef !== 'string' || !componentRef.includes('/')) {
      return null;
    }
    const [libId, componentSlug] = componentRef.split('/', 2);
    const lib = libraries[libId];
    if (!lib) return null;
    const componentDef = lib.components && lib.components[componentSlug];
    if (!componentDef) return null;
    const mapping = componentDef.nativeMapping && componentDef.nativeMapping['runtime-react'];
    if (!mapping || mapping.kind !== 'runtime') return null;
    const registry = registriesByName[mapping.registry];
    if (!registry) return null;
    const Component = registry.get(mapping.componentName);
    if (!Component) return null;
    return {
      Component,
      propertyMap: mapping.propertyMap || {},
      componentDef,
    };
  }

  return {
    libraries,
    registriesByName,
    resolve,
    onUnresolved,
    strict,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Renderers
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve AppSpec property values for a React component:
 *   - Strings, numbers, booleans pass through unchanged
 *   - Nested ComponentInstance (object with componentRef) → React element
 *   - items[] arrays → React fragment of children
 *   - Property names remapped per the nativeMapping propertyMap
 *
 * Per the design, propertyMap is a rename table. Property values
 * themselves are not transformed by default (transforms come later via
 * mapping.valueTransforms).
 */
function buildReactProps(comp, propertyMap, runtime, keyPrefix) {
  const props = {};
  const componentProperties = comp.properties || {};

  for (const [appSpecKey, value] of Object.entries(componentProperties)) {
    const reactKey = propertyMap[appSpecKey] || appSpecKey;

    if (value && typeof value === 'object' && value.componentRef) {
      // Nested instance-swap: render as a React element
      props[reactKey] = createElement(ComponentRenderer, {
        comp: value,
        runtime,
        key: `${keyPrefix}-${appSpecKey}`,
      });
    } else {
      props[reactKey] = value;
    }
  }

  // Items[] → array of rendered React elements assigned to 'children'
  // (or `propertyMap.children` if remapped — most components surface
  // their list slot as children).
  if (Array.isArray(comp.items) && comp.items.length > 0) {
    const childrenKey = propertyMap.children || 'children';
    const existing = props[childrenKey];
    const itemsRendered = comp.items.map((item, i) =>
      item && item.componentRef
        ? createElement(ComponentRenderer, { comp: item, runtime, key: `${keyPrefix}-item-${i}` })
        : null
    ).filter(Boolean);
    props[childrenKey] = existing
      ? createElement(Fragment, null, existing, ...itemsRendered)
      : (itemsRendered.length === 1 ? itemsRendered[0] : itemsRendered);
  }

  return props;
}

/**
 * Render a single ComponentInstance. Returns a React element or a
 * fallback if the componentRef can't be resolved.
 */
function ComponentRenderer({ comp, runtime }) {
  if (!comp || typeof comp !== 'object' || !comp.componentRef) {
    return null;
  }
  const resolved = runtime.resolve(comp.componentRef);
  if (!resolved) {
    if (runtime.strict) {
      throw new Error(`Unresolved componentRef: ${comp.componentRef}`);
    }
    if (runtime.onUnresolved) {
      return runtime.onUnresolved(comp.componentRef, { comp });
    }
    return createElement(UnknownComponent, { componentRef: comp.componentRef });
  }
  const { Component, propertyMap } = resolved;
  const reactProps = buildReactProps(comp, propertyMap, runtime, comp.id || 'c');
  return createElement(Component, { key: comp.id, ...reactProps });
}

/**
 * Render a Screen — typically a top-level <section> with the screen's
 * components rendered in order.
 */
function ScreenRenderer({ screen, runtime, wrap }) {
  if (!screen || !Array.isArray(screen.components)) return null;
  const children = screen.components.map((c, i) =>
    createElement(ComponentRenderer, { comp: c, runtime, key: c.id || `c${i}` })
  );
  if (wrap === false) {
    return createElement(Fragment, null, ...children);
  }
  return createElement(
    'section',
    {
      'data-screen-id': screen.id,
      'data-screen-name': screen.name,
    },
    ...children
  );
}

/**
 * Top-level renderer — walks the spec's screens.content and renders
 * each. By default shows all screens stacked; pass `screenId` to
 * render just one.
 */
function AppSpecRenderer({ spec, runtime, screenId, wrapScreens = true }) {
  if (!spec || !isV10SchemaId(spec.$schema)) {
    return createElement(InvalidSpec, { reason: 'spec missing or not v10' });
  }
  const screens = (spec.screens && spec.screens.content) || [];

  if (screenId) {
    const screen = screens.find(s => s.id === screenId);
    if (!screen) {
      return createElement(InvalidSpec, { reason: `screen "${screenId}" not found` });
    }
    return createElement(ScreenRenderer, { screen, runtime, wrap: wrapScreens });
  }

  return createElement(
    Fragment,
    null,
    ...screens.map(s => createElement(ScreenRenderer, {
      screen: s, runtime, key: s.id, wrap: wrapScreens,
    }))
  );
}

// ─────────────────────────────────────────────────────────────────────
// Streaming hook
// ─────────────────────────────────────────────────────────────────────

/**
 * React hook for streaming AppSpec mutation. Pairs with
 * @missionhud/appspec-patch's createPatchStream. The returned spec
 * is what you pass to <AppSpecRenderer />.
 *
 *   function App({ initialSpec, runtime }) {
 *     const { spec, applyOps } = useAppSpecStream(initialSpec, { source: 'mockingbird-ai' });
 *
 *     useEffect(() => {
 *       const eventSource = new EventSource('/api/patch-stream');
 *       eventSource.addEventListener('patch', (e) => {
 *         applyOps(JSON.parse(e.data).operations);
 *       });
 *       return () => eventSource.close();
 *     }, []);
 *
 *     return <AppSpecRenderer spec={spec} runtime={runtime} />;
 *   }
 *
 * @param {object} initialSpec
 * @param {object} opts - passed through to createPatchStream
 * @returns {{ spec, applyOps, flush, operationsLog }}
 */
function useAppSpecStream(initialSpec, opts = {}) {
  const [spec, setSpec] = useState(initialSpec);
  const streamRef = useRef(null);

  // Build the underlying stream once.
  useEffect(() => {
    streamRef.current = createPatchStream(initialSpec, {
      ...opts,
      onUpdate: (next, ops) => {
        setSpec(next);
        if (opts.onUpdate) opts.onUpdate(next, ops);
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyOps = useMemo(() => (ops, batchOpts) => {
    return streamRef.current?.applyOps(ops, batchOpts);
  }, []);

  const flush = useMemo(() => () => streamRef.current?.flush(), []);
  const operationsLog = useMemo(() => () => streamRef.current?.getOperationsLog() || [], []);

  return { spec, applyOps, flush, operationsLog };
}

// ─────────────────────────────────────────────────────────────────────
// Fallback elements
// ─────────────────────────────────────────────────────────────────────

function UnknownComponent({ componentRef }) {
  return createElement(
    'div',
    {
      style: {
        padding: '8px 12px',
        border: '1px dashed #d33',
        color: '#d33',
        fontFamily: 'monospace',
        fontSize: '12px',
        background: 'rgba(221, 51, 51, 0.05)',
        borderRadius: 4,
      },
    },
    `[unresolved: ${componentRef}]`
  );
}

function InvalidSpec({ reason }) {
  return createElement(
    'div',
    {
      style: {
        padding: '12px 16px',
        border: '1px solid #d33',
        background: 'rgba(221, 51, 51, 0.08)',
        color: '#d33',
        fontFamily: 'monospace',
        fontSize: '13px',
        borderRadius: 4,
      },
    },
    `[invalid AppSpec: ${reason}]`
  );
}

module.exports = {
  createRegistry,
  createRuntime,
  AppSpecRenderer,
  ScreenRenderer,
  ComponentRenderer,
  useAppSpecStream,
  // Internal helpers exposed for advanced callers
  buildReactProps,
};
