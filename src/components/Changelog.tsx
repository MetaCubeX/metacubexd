import { IconCircleDot, IconTag } from '@tabler/icons-solidjs'
import markdownit from 'markdown-it'
import { type Component, For, Show, createMemo } from 'solid-js'
import type { ReleaseInfo } from '~/apis'

// Format date to relative or short format
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'

  if (diffDays === 1) return 'Yesterday'

  if (diffDays < 7) return `${diffDays} days ago`

  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`

  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Markdown renderer with target="_blank" for links
const createMarkdownRenderer = () => {
  const md = markdownit()

  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options)
    }

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    tokens[idx].attrSet('target', '_blank')

    return defaultRender(tokens, idx, options, env, self)
  }

  return md
}

const md = createMarkdownRenderer()

// Single changelog item for timeline
const TimelineItem: Component<{
  release: ReleaseInfo
  isFirst: boolean
  isLast: boolean
}> = (props) => {
  const body = createMemo(() => md.render(props.release.changelog || ''))

  return (
    <li>
      <Show when={!props.isFirst}>
        <hr class={props.release.isCurrent ? 'bg-primary' : ''} />
      </Show>

      <div class="timeline-start text-xs opacity-60">
        {formatDate(props.release.publishedAt)}
      </div>

      <div class="timeline-middle">
        <Show
          when={props.release.isCurrent}
          fallback={
            <IconTag class="h-5 w-5 text-base-content/50" stroke-width={1.5} />
          }
        >
          <IconCircleDot class="h-5 w-5 text-primary" stroke-width={2} />
        </Show>
      </div>

      <div
        class="timeline-end mb-4 timeline-box"
        classList={{
          'border-primary bg-primary/10': props.release.isCurrent,
        }}
      >
        <div class="mb-2 flex items-center gap-2">
          <span
            class="font-mono text-sm font-semibold"
            classList={{
              'text-primary': props.release.isCurrent,
            }}
          >
            {props.release.version}
          </span>
          <Show when={props.release.isCurrent}>
            <span class="badge badge-xs badge-primary">Current</span>
          </Show>
        </div>

        <Show when={props.release.changelog}>
          <div
            class="prose prose-sm max-w-none font-sans text-base-content/80"
            innerHTML={body()}
          />
        </Show>
      </div>

      <Show when={!props.isLast}>
        <hr class={props.release.isCurrent ? 'bg-primary' : ''} />
      </Show>
    </li>
  )
}

// Timeline changelog component
export const Changelog: Component<{
  releases: ReleaseInfo[]
  isLoading?: boolean
}> = (props) => {
  return (
    <div class="w-full max-w-md">
      <Show
        when={!props.isLoading}
        fallback={
          <div class="flex items-center justify-center py-8">
            <span class="loading loading-md loading-spinner" />
          </div>
        }
      >
        <Show
          when={props.releases.length > 0}
          fallback={
            <div class="py-4 text-center text-sm opacity-60">
              No releases found
            </div>
          }
        >
          <ul class="timeline timeline-vertical timeline-compact">
            <For each={props.releases}>
              {(release, index) => (
                <TimelineItem
                  release={release}
                  isFirst={index() === 0}
                  isLast={index() === props.releases.length - 1}
                />
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </div>
  )
}
