<script setup lang="ts">
import type { ReleaseInfo } from '~/types'
import { IconCircleDot, IconTag } from '@tabler/icons-vue'
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
    tokens[idx].attrSet('target', '_blank')
    return defaultRender(tokens, idx, options, env, self)
  }

  return md
}

const md = createMarkdownRenderer()

const renderMarkdown = (content: string) => md.render(content)
</script>

<template>
  <div class="w-full max-w-md">
    <template v-if="!isLoading">
      <template v-if="releases.length > 0">
        <ul class="timeline timeline-vertical timeline-compact">
          <li v-for="(release, index) in releases" :key="release.version">
            <hr v-if="index > 0" :class="{ 'bg-primary': release.isCurrent }" />

            <div class="timeline-start text-xs opacity-60">
              {{ formatDate(release.publishedAt) }}
            </div>

            <div class="timeline-middle">
              <IconCircleDot
                v-if="release.isCurrent"
                class="h-5 w-5 text-primary"
                :stroke-width="2"
              />
              <IconTag
                v-else
                class="h-5 w-5 text-base-content/50"
                :stroke-width="1.5"
              />
            </div>

            <div
              class="timeline-end mb-4 timeline-box"
              :class="{
                'border-primary bg-primary/10': release.isCurrent,
              }"
            >
              <div class="mb-2 flex items-center gap-2">
                <span
                  class="font-mono text-sm font-semibold"
                  :class="{ 'text-primary': release.isCurrent }"
                >
                  {{ release.version }}
                </span>
                <span
                  v-if="release.isCurrent"
                  class="badge badge-xs badge-primary"
                >
                  Current
                </span>
              </div>

              <div
                v-if="release.changelog"
                class="prose prose-sm max-w-none font-sans text-base-content/80"
                v-html="renderMarkdown(release.changelog)"
              />
            </div>

            <hr
              v-if="index < releases.length - 1"
              :class="{ 'bg-primary': release.isCurrent }"
            />
          </li>
        </ul>
      </template>
      <div v-else class="py-4 text-center text-sm opacity-60">
        No releases found
      </div>
    </template>
    <div v-else class="flex items-center justify-center py-8">
      <span class="loading loading-md loading-spinner" />
    </div>
  </div>
</template>
