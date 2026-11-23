# Bundled configuration parsers

`vendor-config.mjs` bundles [jsonc-parser 3.3.1](https://github.com/microsoft/node-jsonc-parser) and [yaml 2.9.0](https://github.com/eemeli/yaml). Their license texts are included here. Studio loads the bundle with the plugin.

To refresh the bundle, install those pinned packages in a temporary directory. Reexport `parseTree`, `getNodeValue`, `modify` and `applyEdits` from `jsonc-parser`, and `parseDocument` from `yaml` in an entry module. Bundle the entry with esbuild using `--bundle --platform=browser --main-fields=module,main --format=esm`. Copy the license texts from the packages and run the plugin tests.
