# dsh-better-model-picker

An installable **bundle** for the DeepSeek Harness (DSH) Web GUI that replaces
the composer's model selector with one that adds a **text filter**.

The drop-down keeps the same data source as the shipped selector — the
session's shared model directory — so a model you pick here is what the
`/model` popup shows next, and vice versa. The only change is a filter box at
the top of the menu: typing narrows the list by model name or id.

## Install

```sh
pnpm install && pnpm run build      # produces lib/index.js + lib/client.js
dsh plugin --profile web add /path/to/dsh-better-model-picker
```

Then restart Deepseek Harness. `dsh plugin add` does both halves of the job because
this package declares `dsh.bundle.patch`: pnpm links it into the profile, and
the CLI appends it to that profile's `dsh.profile.bundles` layer stack. It is
the bundle's own `cordis.patch.yml` that inserts the plugin row.

Adding or removing the plugin only takes effect after restarting DeepSeek
Harness. The bundle layer is read at boot, so any change to the profile's
plugin set requires the harness process to be restarted before the new
configuration is reflected in the Web GUI.

Verify it landed without booting:

```sh
dsh --profile web --dump-config | grep -A2 better-model-picker
```

### Uninstall

```sh
dsh plugin --profile web remove dsh-better-model-picker
```

As with installation, removal only takes effect after restarting DeepSeek
Harness.

### Publish

`prepare` is intentionally omitted; run `pnpm pack` after `pnpm run build` to
ship prebuilt artifacts, or publish to a registry with `lib/` built. Consumers
then need no build step:

```sh
dsh plugin --profile web add dsh-better-model-picker              # registry
dsh plugin --profile web add ./dsh-better-model-picker-0.1.0.tgz  # tarball
```

## How it works

- A **bundle** ships a configuration layer (`dsh.bundle.patch` →
  `cordis.patch.yml`). A profile listing this package in `dsh.profile.bundles`
  applies that layer.
- One row serves as both halves. The loader mounts `main` (`lib/index.js`) as
  the host half (a no-op: selection rides the shipped session RPCs). The
  client-modules node half scans loader entries for packages declaring
  `dsh.client` and serves this one's browser bundle at
  `/plugins/dsh-better-model-picker/client.js`.
- The client half registers as the occupant of the `conversation.input.model`
  slot at `priority: -1`, shadowing the shipped `ui-model-selection` entry
  **without disabling it**. The shipped plugin keeps owning the `/model` popup
  and the `model` locale namespace, and both surfaces share one directory
  service (`ctx.modelDirectories`).

No web-shell rebuild is needed: plugin bundles are served per package from
`lib/client.js` and reach the page through `window.__DSH_BOOT__` at boot.

## Build

```sh
pnpm run build        # tsdown -> lib/index.js (ESM) + lib/client.js (CJS browser)
pnpm run typecheck    # optional; see tsconfig.json paths (needs a harness checkout)
```

The browser artifact is a CJS body wrapped in the
`window.__ModuleLoader__.load({ id, factory })` closure the client module
system expects. `react` and the other shell-owned platform modules stay
external so the plugin shares the page's single React instance; everything else
is bundled. CSS Modules are inlined by lightningcss and inject a
`<style data-plugin>` tag at factory execution.

## Layout

```
dsh-better-model-picker/
├── package.json                    # dsh.bundle (layer) + dsh.client (browser roster)
├── cordis.patch.yml                # the layer: inserts the plugin row
├── tsdown.config.ts                # both build faces
├── tsconfig.json                   # opt-in typecheck only
└── src/
    ├── index.ts                    # host half (no-op)
    └── client/
        ├── index.ts                # plugin body + slot registration
        ├── slots.ts                # ModelSelectInjected face
        ├── FilteredModelSelect.tsx # the component
        ├── FilteredModelSelect.module.css
        └── css-modules.d.ts
```
