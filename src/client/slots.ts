/**
 * The injected business face of the `conversation.input.model` seat. Mirrors
 * the shipped ui-model-selection shape so the component can read the same
 * shared directory store and submit through the same session RPC.
 */
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'

/** Injected business face of the composer model seat. */
export interface ModelSelectInjected {
  /** Whether this session supports selecting a model. */
  available: boolean
  /** The session's shared directory store (same instance the /model popup reads). */
  directory: SnapshotStore<ModelDirectoryState>
  /** Refresh the advisory directory (errors land on the store). */
  load: () => void
  /** Select a complete provider/model selection. */
  select: (selection: ModelSelection) => Promise<boolean>
}
