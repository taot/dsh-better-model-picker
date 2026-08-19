/**
 * dsh-better-model-picker — host half.
 *
 * Pure UI plugin: the empty `apply` exists only so the row appears in the
 * host Loader. The browser half ships via exports["./client"], discovered
 * through the package.json `dsh.client` declaration.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
