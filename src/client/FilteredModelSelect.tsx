/**
 * FilteredModelSelect: the enhanced `conversation.input.model` seat occupant.
 *
 * A single flat list of models (their provider group shown as a section
 * heading) with a text filter at the top and per-row star pinning. Starred
 * models always render at the top (a "Starred" section), regardless of the
 * active filter; stars persist across refreshes and restarts in the browser
 * (`localStorage`, keyed by provider/model id pair). Filtering splits the query
 * on whitespace into terms (AND semantics) and matches each term,
 * case-insensitively, against the model name/id and the provider name/id. Data
 * and submission ride the same per-session directory store as the shipped
 * selector, so there is one source of truth shared with the /model popup.
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

/** Persistence key for the starred provider/model id list. */
const STARRED_STORAGE_KEY = 'dsh-better-model-picker.starred'

/** Split a query into non-empty, lower-cased terms on whitespace. */
function termsOf(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(term => term !== '')
}

/** Whether one term matches any searchable field of a choice. */
function termMatches(choice: Choice, term: string): boolean {
  return choice.group.name.toLowerCase().includes(term)
    || choice.group.id.toLowerCase().includes(term)
    || choice.model.name.toLowerCase().includes(term)
    || choice.model.id.toLowerCase().includes(term)
}

/** Every term must match at least one field (case-insensitive substring). */
function matches(choice: Choice, query: string): boolean {
  return termsOf(query).every(term => termMatches(choice, term))
}

/** The opaque identity of one provider/model pair. */
function starKey(groupId: string, modelId: string): string {
  return `${groupId}/${modelId}`
}

/** Read the persisted starred list, falling back to [] and tolerating any failure. */
function loadStarred(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STARRED_STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

/** Persist the starred list, tolerating storage failures silently. */
function saveStarred(ids: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(ids))
  } catch { /* persistence is best-effort */ }
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
  const [starred, setStarred] = useState<string[]>(loadStarred)
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
  const filtered = q === '' ? choices : choices.filter(c => matches(c, q))
  // Starred always on top: partition the filtered list, preserving order within
  // each partition and hoisting starred items above provider groups.
  const starredIds = new Set(starred)
  const starredChoices = filtered.filter(c => starredIds.has(starKey(c.group.id, c.model.id)))
  const unstarredChoices = filtered.filter(c => !starredIds.has(starKey(c.group.id, c.model.id)))

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

  const clearFilter = (): void => {
    setQuery('')
    filterRef.current?.focus()
  }

  const toggleStar = (choice: Choice): void => {
    const key = starKey(choice.group.id, choice.model.id)
    const next = starredIds.has(key)
      ? starred.filter(id => id !== key)
      : [...starred, key]
    setStarred(next)
    saveStarred(next)
  }

  const onKeyDown = (event: { key: string }): void => {
    if (event.key === 'Escape' && open) {
      close(true)
    }
  }

  const renderChoice = (choice: Choice, heading: boolean) => {
    const selected = current?.provider === choice.group.id && current.model === choice.model.id
    const isStarred = starredIds.has(starKey(choice.group.id, choice.model.id))
    return (
      <div key={`${choice.group.id}/${choice.model.id}`}>
        {heading && <div className={css.groupTitle}>{choice.group.name}</div>}
        <div
          role="menuitemradio"
          aria-checked={selected}
          className={css.option + (selected ? ` ${css.selected}` : '') + (busy ? ` ${css.disabled}` : '')}
          title={choice.model.name}
          tabIndex={busy ? -1 : 0}
          onClick={() => { if (!busy) choose(choice) }}
        >
          <span className={css.optionCopy}>
            <span className={css.modelName}>{choice.model.name}</span>
            {choice.model.description !== undefined && (
              <span className={css.description}>{choice.model.description}</span>
            )}
          </span>
          <button
            type="button"
            className={css.star + (isStarred ? ` ${css.starred}` : '')}
            aria-pressed={isStarred}
            aria-label={isStarred ? 'Unstar' : 'Star'}
            title={isStarred ? 'Unstar' : 'Star'}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); toggleStar(choice) }}
          >
            <span aria-hidden>{isStarred ? '★' : '☆'}</span>
          </button>
          <span className={css.check}>{selected ? '✓' : ''}</span>
        </div>
      </div>
    )
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
          <div className={css.filterWrap}>
            <input
              ref={filterRef}
              type="text"
              className={css.filter}
              placeholder="Filter models…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { e.stopPropagation() }}
            />
            {query !== '' && (
              <button
                type="button"
                className={css.filterClear}
                aria-label="Clear filter"
                title="Clear filter"
                onClick={clearFilter}
              >
                <span aria-hidden>×</span>
              </button>
            )}
          </div>

          {state.status === 'loading' && <div className={css.status}>{t('status.loading')}</div>}
          {state.error !== null && (
            <div className={css.error}>
              <span>{t('error.action', { message: state.error })}</span>
              <button type="button" className={css.retry} onClick={load}>{t('action.reload')}</button>
            </div>
          )}

          <div className={css.list}>
            {starredChoices.length > 0 && (
              <div className={css.groupTitle}>{'Starred'}</div>
            )}
            {starredChoices.map(choice => renderChoice(choice, false))}

            {unstarredChoices.map((choice) => {
              const heading = section === choice.group ? null : choice.group
              section = choice.group
              return renderChoice(choice, heading !== null)
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
