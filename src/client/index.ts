/**
 * dsh-better-model-picker — browser half.
 *
 * Shadows the shipped `conversation.input.model` seat with a filtered model
 * selector. Data and submission ride the SAME per-session directory the
 * shipped selector uses (`ctx.modelDirectories`), so a switch made here is
 * what the /model popup shows next, and the reverse holds too. The shipped
 * ui-model-selection row stays mounted — it still owns the /model popup and
 * the `model` locale namespace.
 *
 * This package only contributes the seat occupant; no SlotMap merge lives
 * here (the seat is declared by ui-conversation's composer-bar entry).
 */
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ModelSelectInjected } from './slots.ts'
import { FilteredModelSelect } from './FilteredModelSelect.tsx'

export type { ModelSelectInjected } from './slots.ts'

/** Dictionary namespace owned by the shipped ui-model-selection plugin. */
const NS = 'model'

/** Hard dependencies: the seat registry and the shared directory service. */
export const inject = ['slots', 'modelDirectories']

/**
 * Client plugin body: register the `conversation.input.model` occupant at a
 * lower priority than the shipped entry so it wins the single-kind cell.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const slots = ctx.get('slots')
  const models = ctx.get('modelDirectories')
  if (slots === undefined || models === undefined) return

  slots.inject('conversation.input.model', () => slots.register({
    name: 'conversation.input.model',
    locale: NS,
    priority: -1,
    inject: (sessionId): ModelSelectInjected => {
      const directory = models.directoryFor(sessionId)
      return {
        available: true,
        directory: directory.store,
        load: () => {
          directory.load().catch(() => { /* surfaced on the store */ })
        },
        select: (selection: ModelSelection) => directory
          .select(selection)
          .then(() => true, () => false),
      }
    },
  }, FilteredModelSelect))
}
