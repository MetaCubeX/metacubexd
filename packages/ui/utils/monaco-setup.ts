// packages/ui/utils/monaco-setup.ts (imported ONLY from the client-only wrapper)
//
// Import the slim editor core (edcore.main = full editor UX, zero languages)
// plus only the two monarch tokenizers we actually edit: yaml (profiles) and
// javascript (script-profile transforms). The default 'monaco-editor' barrel
// drags in every basic-language plus the json/css/html/ts language services
// and their multi-MB workers — the bulk of the dist size in #2101.
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { configureMonacoYaml } from 'monaco-yaml'
import YamlWorker from 'monaco-yaml/yaml.worker?worker'

;
import 'monaco-editor/esm/vs/editor/edcore.main'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';(globalThis as any).MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'yaml') return new YamlWorker()
    return new EditorWorker()
  },
}

let configured = false
export function ensureMonacoYaml() {
  if (configured) return monaco
  configured = true
  configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    hover: true,
    completion: true,
    validate: true,
    format: { enable: true },
    schemas: [
      {
        uri: 'https://github.com/dongchengjie/meta-json-schema',
        // Must match the model URI we create in MonacoYamlEditor.client.vue.
        fileMatch: ['**/config.yaml', 'inmemory://profile/*'],
        schema: metaSchema as any,
      },
    ],
  })
  return monaco
}
