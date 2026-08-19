/**
 * FilteredModelSelect: the enhanced `conversation.input.model` seat occupant.
 *
 * A single flat list of models (their provider group shown as a section
 * heading) with a text filter at the top. Filtering is a case-insensitive
 * substring match over the model name and model id. Data and submission ride
 * the same per-session directory store as the shipped selector, so there is
 * one source of truth shared with the /model popup.
 */
import {
  useEffect, useRef, useState, useSyncExternalStore,
} from 'react'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelSelectInjected } from './slots.ts'
import css from './FilteredModelSelect.module.css'

/** One selectable model + its owning provider group. */
interface Choice {
  group: ModelProviderGroup
  model: ModelProviderGroup['models'][number]
}

/** A case-insensitive substring match over several fields. */
function matches(text: string, query: string): boolean {
  if (query === '') return true
  return text.toLowerCase().includes(query.toLowerCase())
}

/**
 * Render the composer model seat.
 * @param props - owner share (locked) + injected face (directory store +
 * verbs) + the standard locale seat.
 */
export function FilteredModelSelect(
  { locked, available, directory, load, select, t }:
  ModelSelectInjected & { locked: boolean } & PropsLocale<'model'>,
) {
  const state = useSyncExternalStore(
    fn => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const filterRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (available) load()
  }, [available, load])

  // Autofocus the filter whenever the menu opens.
  useEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!available) return null

  const groups = state.groups
  const current = state.current
  const busy = state.status === 'selecting'
  const q = query.trim()

  // A stable flat list, then the filtered view, with the current model's label
  // resolved for both the trigger and the list's selection mark.
  const choices: Choice[] = groups.flatMap(group =>
    group.models.map(model => ({ group, model })),
  )
  const filtered = q === '' ? choices : choices.filter(c =>
    matches(c.model.name, q) || matches(c.model.id, q),
  )
  const selectedChoice = choices.find(c =>
    c.group.id === current?.provider && c.model.id === current.model,
  )
  const label = selectedChoice?.model.name ?? t('trigger.fallback')

  const show = (): void => {
    setOpen(true)
    load()
  }
  const close = (restoreFocus = false): void => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const choose = (choice: Choice): void => {
    if (current?.provider === choice.group.id && current.model === choice.model.id) {
      close(true)
      return
    }
    void select({ provider: choice.group.id, model: choice.model.id }).then((ok) => {
      if (ok) close(true)
    })
  }

  const onKeyDown = (event: { key: string }): void => {
    if (event.key === 'Escape' && open) {
      close(true)
    }
  }

  let section: Choice['group'] | null = null

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-label={t('trigger.aria', { model: label })}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        disabled={locked}
        onClick={() => { open ? close() : show() }}
      >
        <span className={css.triggerLabel}>{label}</span>
        <span className={css.chevron} aria-hidden>▾</span>
      </button>

      {open && (
        <div className={css.menu} role="menu" aria-label={t('menu.aria')} aria-busy={busy || state.status === 'loading'}>
          <input
            ref={filterRef}
            type="text"
            className={css.filter}
            placeholder="Filter models…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { e.stopPropagation() }}
          />

          {state.status === 'loading' && <div className={css.status}>{t('status.loading')}</div>}
          {state.error !== null && (
            <div className={css.error}>
              <span>{t('error.action', { message: state.error })}</span>
              <button type="button" className={css.retry} onClick={load}>{t('action.reload')}</button>
            </div>
          )}

          <div className={css.list}>
            {filtered.map((choice) => {
              const heading = section === choice.group ? null : choice.group
              section = choice.group
              const selected = current?.provider === choice.group.id && current.model === choice.model.id
              return (
                <div key={`${choice.group.id}/${choice.model.id}`}>
                  {heading !== null && <div className={css.groupTitle}>{heading.name}</div>}
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={css.option + (selected ? ` ${css.selected}` : '')}
                    title={choice.model.name}
                    disabled={busy}
                    onClick={() => choose(choice)}
                  >
                    <span className={css.optionCopy}>
                      <span className={css.modelName}>{choice.model.name}</span>
                      {choice.model.description !== undefined && (
                        <span className={css.description}>{choice.model.description}</span>
                      )}
                    </span>
                    <span className={css.check}>{selected ? '✓' : ''}</span>
                  </button>
                </div>
              )
            })}
            {filtered.length === 0 && state.status === 'ready' && (
              <div className={css.empty}>{q === '' ? t('empty.models') : 'No matching models.'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
