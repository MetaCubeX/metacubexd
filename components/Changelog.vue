<script setup lang="ts">
import type { ReleaseInfo } from '~/types'
import markdownit from 'markdown-it'

interface Props {
  releases: ReleaseInfo[]
  isLoading?: boolean
}

defineProps<Props>()

// Format date to relative or short format
function formatDate(dateString: string) {
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
function createMarkdownRenderer() {
  const md = markdownit()

  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options)
    }

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    tokens[idx]?.attrSet('target', '_blank')
    return defaultRender(tokens, idx, options, env, self)
  }

  return md
}

const md = createMarkdownRenderer()

const renderMarkdown = (content: string) => md.render(content)
</script>

<template>
  <div class="w-full max-w-[28rem] min-w-[20rem]">
    <template v-if="!isLoading">
      <template v-if="releases.length > 0">
        <ul class="m-0 list-none p-0">
          <li
            v-for="release in releases"
            :key="release.version"
            class="flex gap-3"
          >
            <div
              class="changelog-line flex shrink-0 flex-col items-center pt-1"
            >
              <div
                class="changelog-dot h-2.5 w-2.5 shrink-0 rounded-full"
                :class="release.isCurrent ? 'changelog-dot-current' : ''"
              />
            </div>

            <div class="min-w-0 flex-1 pb-4">
              <div class="mb-2 flex flex-col gap-1">
                <time class="text-[0.6875rem] text-base-content/50">
                  {{ formatDate(release.publishedAt) }}
                </time>
                <div class="flex items-center gap-1.5">
                  <span
                    class="font-mono text-sm font-semibold text-base-content"
                    :class="{ 'text-primary': release.isCurrent }"
                  >
                    {{ release.version }}
                  </span>
                  <span
                    v-if="release.isCurrent"
                    class="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-primary-content uppercase"
                  >
                    Current
                  </span>
                </div>
              </div>

              <div
                v-if="release.changelog"
                class="changelog-body text-[0.8125rem] leading-normal text-base-content/80"
                v-html="renderMarkdown(release.changelog)"
              />
            </div>
          </li>
        </ul>
      </template>
      <div v-else class="p-4 text-center text-sm text-base-content/50">
        No releases found
      </div>
    </template>
    <div v-else class="flex items-center justify-center p-8">
      <span class="changelog-spinner h-6 w-6 rounded-full" />
    </div>
  </div>
</template>

<style scoped>
.changelog-dot {
  background: color-mix(in oklch, var(--color-base-content) 30%, transparent);
}

.changelog-dot-current {
  background: var(--color-primary);
  box-shadow: 0 0 8px color-mix(in oklch, var(--color-primary) 50%, transparent);
}

.changelog-item:not(:last-child) .changelog-line::after {
  content: '';
  flex: 1;
  width: 2px;
  margin-top: 0.375rem;
  background: color-mix(in oklch, var(--color-base-content) 15%, transparent);
}

.changelog-body :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.changelog-body :deep(a:hover) {
  opacity: 0.8;
}

.changelog-body :deep(p) {
  margin: 0.25rem 0;
}

.changelog-body :deep(ul) {
  margin: 0.25rem 0;
  padding-left: 1rem;
}

.changelog-body :deep(li) {
  margin: 0.125rem 0;
}

.changelog-body :deep(code) {
  font-size: 0.75rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  background: color-mix(in oklch, var(--color-base-content) 10%, transparent);
}

.changelog-spinner {
  border: 2px solid
    color-mix(in oklch, var(--color-base-content) 20%, transparent);
  border-top-color: var(--color-primary);
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
