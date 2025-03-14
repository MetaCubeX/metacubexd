import markdownit from 'markdown-it'
import { ParentComponent } from 'solid-js'

export const Changelog: ParentComponent<{
  body: string
}> = (props) => {
  const [, others] = splitProps(props, ['children'])
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

  const body = createMemo(() => md.render(others.body))

  return (
    <div class="card bg-neutral">
      <div class="card-body">
        <div class="prose prose-sm font-sans" innerHTML={body()} />
      </div>
    </div>
  )
}
