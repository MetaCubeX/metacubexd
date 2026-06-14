import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
;
// packages/ui/utils/monaco-setup.ts (imported ONLY from the client-only wrapper)
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import { configureMonacoYaml } from 'monaco-yaml'
import YamlWorker from 'monaco-yaml/yaml.worker?worker';(globalThis as any).MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'yaml') return new YamlWorker()
    if (label === 'json') return new JsonWorker()
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
