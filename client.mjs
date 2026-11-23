const copy = {
  en: {
    skills: 'Skills', mcp: 'MCP servers', configuration: 'Configuration',
    global: 'Host user · Global', scope: 'Auggie Global uses the CLI, account and settings of the Studio host user.',
    layers: 'Changes apply to the next Auggie process. Project, local-project or organization settings can take precedence.',
    scoped: 'Scoped is unavailable. Auggie ACP has no verified way to use a Studio-selected model endpoint.',
    skillLimit: 'Auggie does not expose a native per-Skill enable switch. This list covers the host user’s .augment/skills directory.',
    mcpLimit: 'Enabled and disabled reflect the native user definition. Cards do not report connectivity. Project settings may override this state.',
    sources: 'Sources and when changes apply', location: 'Native path', refresh: 'Reload', addSkill: 'Add Skill', addMcp: 'Add MCP server',
    searchSkills: 'Search name or description', searchMcp: 'Search server name or transport', list: 'Skill list', select: 'Select a Skill to view its details.',
    mcpSpace: 'space', mcpSpaces: 'spaces',
    emptySkill: 'No user Skills yet.', emptyMcp: 'No user MCP servers yet.', noMatches: 'No matching results.',
    name: 'Name', description: 'Description', body: 'Skill body (Markdown)', raw: 'SKILL.md',
    skillNameHelp: 'Use 1–64 characters: lowercase a–z, digits and single hyphens between groups. Example: code-review.',
    nativeEditor: 'Edit full SKILL.md', nativeHint: 'YAML front matter must have the matching name and a description.',
    invalidSkill: 'Front matter is invalid or unavailable. Open the full SKILL.md editor to inspect or repair the file.',
    noSkill: 'This Skill was removed. Reload the list.', defaultMcp: 'MCP configuration (JSON)',
    mcpEditHelp: 'Keep [stored value] at its original position to preserve a stored command, argument, URL, header or environment value.',
    unsupportedMcp: 'Auggie expects a stdio, HTTP or SSE definition. Edit supported fields here when available, or repair it in the native CLI.',
    total: 'Servers', enabled: 'Enabled', disabled: 'Disabled', enable: 'Enable', disable: 'Disable',
    view: 'View', edit: 'Edit', remove: 'Delete', cancel: 'Cancel', close: 'Close', save: 'Save',
    saved: 'Saved. Changes apply on the next turn.', removed: 'Deleted. Changes apply on the next turn.',
    removeSkill: 'Delete SKILL.md? Other files in this Skill directory will be kept.',
    removeMcp: 'Delete this server from the user settings file?', discard: 'Discard unsaved changes?',
    loading: 'Loading…', failed: 'Could not read or update Auggie configuration.',
    engine: 'Auggie CLI', engineLoading: 'Checking CLI…', engineMissing: 'No working CLI detected.',
    managed: 'Managed by Studio', external: 'External installation', management: 'Open Agent Management',
    login: 'Terminal sign-in', loginHelp: 'Sign in as the Studio host OS user.',
    modes: 'Model and configuration scope', prefs: 'Native user settings', prefsLabel: 'Editable settings (JSON)',
    settingsHelp: 'Editable keys: defaultModel, enableSkillCommands, toolSearchEnabled, theme and notificationMode. The legacy key enableToolSearch is accepted. toolSearchEnabled takes precedence when both are present.',
    patchHelp: 'Keep omitted keys unchanged. Set a key to null to remove its user override.',
    example: 'Configuration example', docs: 'Auggie settings reference', saveSettings: 'Save settings',
  },
  zh: {
    skills: 'Skill 管理', mcp: 'MCP 管理', configuration: '配置文件',
    global: '宿主用户 · Global', scope: 'Auggie Global 使用 Studio 宿主用户的 CLI、账号和配置。',
    layers: '改动在下个 Auggie 进程生效。项目、本地项目或组织配置可能覆盖用户设置。',
    scoped: 'Scoped 暂不可用。尚未验证 Auggie ACP 能接入 Studio 所选的模型端点。',
    skillLimit: 'Auggie 未提供原生单项 Skill 开关。此列表只显示宿主用户的 .augment/skills 目录。',
    mcpLimit: '启用和停用反映原生用户配置。连接状态需用原生工具核对，项目设置可能覆盖此状态。',
    sources: '来源与生效方式', location: '原生路径', refresh: '重新读取', addSkill: '添加 Skill', addMcp: '添加 MCP 服务',
    searchSkills: '搜索名称或描述', searchMcp: '搜索服务名称或传输类型', list: 'Skill 列表', select: '选择 Skill 查看详情。',
    mcpSpace: '个空格', mcpSpaces: '个空格',
    emptySkill: '还没有用户级 Skill。', emptyMcp: '还没有用户级 MCP 服务。', noMatches: '没有匹配的项目。',
    name: '名称', description: '描述', body: 'Skill 正文（Markdown）', raw: 'SKILL.md',
    skillNameHelp: '使用 1–64 个字符，仅限小写字母 a–z、数字和分组间的单个连字符。例如 code-review。',
    nativeEditor: '编辑完整 SKILL.md', nativeHint: 'YAML 文件头须包含同名的 name 和有效的 description。',
    invalidSkill: 'YAML 文件头无效或无法读取。可打开完整的 SKILL.md 编辑器查看或修复。',
    noSkill: '此 Skill 已移除，请重新读取列表。', defaultMcp: 'MCP 配置（JSON）',
    mcpEditHelp: '将 [stored value] 留在原位置，以保留已有命令、参数、URL、请求头或环境变量值。',
    unsupportedMcp: 'Auggie 需要 stdio、HTTP 或 SSE 定义。可用时在此编辑支持的字段，也可使用原生 CLI 修复。',
    total: '服务数', enabled: '已启用', disabled: '已停用', enable: '启用', disable: '停用',
    view: '查看', edit: '编辑', remove: '删除', cancel: '取消', close: '关闭', save: '保存',
    saved: '已保存，下轮对话生效。', removed: '已删除，下轮对话生效。',
    removeSkill: '删除 SKILL.md？该目录中的其他文件会保留。',
    removeMcp: '从用户设置中删除此服务？', discard: '放弃未保存的改动？',
    loading: '正在读取…', failed: '无法读取或更新 Auggie 配置。',
    engine: 'Auggie CLI', engineLoading: '正在检测 CLI…', engineMissing: '未检测到可用的 CLI。',
    managed: 'Studio 托管', external: '外部安装', management: '打开 Agent 管理',
    login: '终端登录', loginHelp: '以 Studio 宿主的系统账号登录。',
    modes: '模型与配置作用域', prefs: '原生用户设置', prefsLabel: '可编辑设置（JSON）',
    settingsHelp: '可编辑 defaultModel、enableSkillCommands、toolSearchEnabled、theme 和 notificationMode。仍接受旧键 enableToolSearch；两者同时存在时以 toolSearchEnabled 为准。',
    patchHelp: '省略键会保留原值。将键设为 null 可清除用户覆盖。',
    example: '配置示例', docs: 'Auggie 配置参考', saveSettings: '保存设置',
  },
}
copy['zh-TW'] = {
  skills: 'Skill 管理', mcp: 'MCP 管理', configuration: '設定檔',
  global: '主機使用者 · Global', scope: 'Auggie Global 使用 Studio 主機使用者的 CLI、帳號與設定。',
  layers: '變更在下個 Auggie 程序生效。專案、專案本機設定或組織設定可能覆寫使用者設定。',
  scoped: 'Scoped 暫不可用。尚未驗證 Auggie ACP 能連線至 Studio 所選的模型端點。',
  skillLimit: 'Auggie 未提供原生單項 Skill 開關。此清單只顯示主機使用者的 .augment/skills 目錄。',
  mcpLimit: '啟用和停用反映原生使用者設定。連線狀態請用原生工具查詢，專案設定可能覆寫此狀態。',
  sources: '來源及生效方式', location: '原生路徑', refresh: '重新讀取', addSkill: '新增 Skill', addMcp: '新增 MCP 伺服器',
  searchSkills: '搜尋名稱或描述', searchMcp: '搜尋伺服器名稱或傳輸類型', list: 'Skill 清單', select: '選擇 Skill 查看詳細資料。',
  mcpSpace: '個空格', mcpSpaces: '個空格',
  emptySkill: '目前沒有使用者層的 Skill。', emptyMcp: '目前沒有使用者層的 MCP 伺服器。', noMatches: '沒有符合的項目。',
  name: '名稱', description: '描述', body: 'Skill 正文（Markdown）', raw: 'SKILL.md',
  skillNameHelp: '使用 1–64 個字元，只能使用小寫字母 a–z、數字及群組間的單個連字號。例如 code-review。',
  nativeEditor: '編輯完整 SKILL.md', nativeHint: 'YAML 標頭須包含同名的 name 和有效的 description。',
  invalidSkill: 'YAML 標頭無效或無法讀取。可開啟 SKILL.md 編輯器查看或修復。',
  noSkill: '此 Skill 已移除，請重新讀取清單。', defaultMcp: 'MCP 設定（JSON）',
  mcpEditHelp: '將 [stored value] 留在原處，以保留既有指令、參數、URL、標頭或環境變數的值。',
  unsupportedMcp: 'Auggie 需要 stdio、HTTP 或 SSE 定義。可用時在此編輯支援的欄位，也可使用原生 CLI 修復。',
  total: '伺服器數', enabled: '已啟用', disabled: '已停用', enable: '啟用', disable: '停用',
  view: '查看', edit: '編輯', remove: '刪除', cancel: '取消', close: '關閉', save: '儲存',
  saved: '已儲存，於下輪對話生效。', removed: '已刪除，於下輪對話生效。',
  removeSkill: '刪除 SKILL.md？此目錄中的其他檔案會保留。',
  removeMcp: '從使用者設定刪除此伺服器？', discard: '捨棄未儲存的變更？',
  loading: '正在讀取…', failed: '無法讀取或更新 Auggie 設定。',
  engine: 'Auggie CLI', engineLoading: '正在偵測 CLI…', engineMissing: '未偵測到可用的 CLI。',
  managed: 'Studio 託管', external: '外部安裝', management: '開啟 Agent 管理',
  login: '終端機登入', loginHelp: '使用 Studio 主機的作業系統帳號登入。',
  modes: '模型與設定範圍', prefs: '原生使用者設定', prefsLabel: '可編輯設定（JSON）',
  settingsHelp: '可編輯 defaultModel、enableSkillCommands、toolSearchEnabled、theme 和 notificationMode。仍接受舊鍵 enableToolSearch；兩者同時存在時以 toolSearchEnabled 為準。',
  patchHelp: '省略的鍵會維持原值。將鍵設為 null 可清除使用者覆寫。',
  example: '設定範例', docs: 'Auggie 設定參考', saveSettings: '儲存設定',
}
const styles = [
  '.ag-page *{box-sizing:border-box}',
  '.ag-page{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;color:var(--text-primary);font:var(--font-size-base,14px)/var(--line-height,1.55) var(--font-family,system-ui)}',
  '.ag-page :is(h1,h2,p,pre){margin:0}.ag-page h1{font-size:1.25em}.ag-page h2{font-size:1.06em;min-width:0;max-width:100%;overflow-wrap:anywhere}',
  '.ag-muted,.ag-page summary{color:var(--text-secondary);overflow-wrap:anywhere}.ag-page summary{cursor:pointer}',
  '.ag-header,.ag-row,.ag-actions,.ag-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.ag-header{padding:12px 16px;border-bottom:1px solid var(--border-color);gap:12px;justify-content:space-between}',
  '.ag-header input{flex:1 1 150px;max-width:300px}.ag-content{padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;overflow:auto;align-content:start;min-width:0}',
  '.ag-page :is(button,input,textarea){color:inherit;font:inherit;border:1px solid var(--theme-input-border,var(--border-color));border-radius:var(--theme-input-radius,var(--radius-component,6px));background:var(--theme-input-bg,var(--bg-secondary));min-width:0;padding:5px 9px}',
  '.ag-page button{cursor:pointer;min-height:var(--control-height,28px);background:transparent}.ag-page button:hover{background:var(--bg-secondary)}',
  '.ag-page .ag-primary,.ag-page .ag-primary:hover{border-color:var(--accent-primary);background:var(--accent-primary);color:var(--ag-on-accent,#fff)}',
  '.ag-page button:disabled,.ag-page button[aria-disabled=true]{opacity:.55;cursor:default}.ag-page :focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}',
  '.ag-page [data-theme-surface=card]{border:1px solid var(--theme-card-border,var(--border-color));border-radius:var(--theme-card-radius,var(--radius-component,8px));background:var(--theme-card-bg,var(--bg-secondary));box-shadow:var(--theme-card-shadow,none)}',
  '.ag-page [data-theme-surface=input]{box-shadow:var(--theme-input-shadow,none)}',
  '.ag-page .ag-danger{color:var(--error-color,var(--text-danger,#b74b4b))}.ag-page a{color:var(--accent-primary)}',
  '.ag-page code,.ag-page pre,.ag-page textarea{font:0.92em/1.6 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.ag-layout{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,2.5fr);gap:14px}',
  '.ag-list,.ag-detail,.ag-form,.ag-card,.ag-source{display:grid;align-content:start;gap:10px;padding:12px;min-width:0}',
  '.ag-list button{text-align:left;display:grid;gap:3px;width:100%;overflow-wrap:anywhere}',
  '.ag-list button[aria-pressed=true]{border-color:var(--accent-primary);background:var(--bg-secondary)}',
  '.ag-preview{border-top:1px solid var(--border-color);padding-top:9px}.ag-heading{justify-content:space-between}.ag-heading h2{flex:1 1 10ch}',
  '.ag-cards,.ag-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
  '.ag-settings .ag-preferences{grid-column:1/-1}',
  '.ag-source{padding:0}.ag-source[open] summary{margin-bottom:5px}.ag-source p{margin-bottom:5px}',
  '.ag-label{font-size:.88em;color:var(--text-secondary);overflow-wrap:anywhere}.ag-tag{border:1px solid var(--border-color);padding:1px 6px;border-radius:var(--radius-component,6px)}',
  '.ag-page [role=switch][aria-checked=true]{border-color:var(--accent-primary)}',
  '.ag-page dialog{color:inherit;width:min(580px,calc(100vw - 24px));max-height:90vh;padding:0;background:var(--bg-primary,Canvas)}',
  '.ag-page dialog:not([open]){display:none}',
  '.ag-page dialog::backdrop{background:rgb(0 0 0/.4)}.ag-form{padding:16px}.ag-form fieldset{padding:0;border:0;margin:0;min-width:0;display:grid;gap:10px}',
  '.ag-page label{display:grid;gap:5px;min-width:0}.ag-page textarea{width:100%;min-height:14rem;resize:vertical}.ag-form .ag-actions{justify-content:flex-end}',
  '.ag-page textarea.ag-name-lines{min-height:0}',
  '.ag-page [role=alert]{color:var(--error-color,var(--text-danger,#b74b4b));overflow-wrap:anywhere}.ag-page [hidden]{display:none !important}.ag-page .ag-back{display:none}',
  '@media(max-width:680px){.ag-cards,.ag-settings,.ag-layout{grid-template-columns:1fr}.ag-layout .ag-detail{display:none}.ag-layout.ag-show-detail .ag-detail{display:grid}.ag-layout.ag-show-detail .ag-list{display:none}.ag-page .ag-back{display:inline-flex}}',
].join('\n')

function element(tag, text, className) {
  const node = document.createElement(tag)
  if (text) node.textContent = text
  if (className) node.className = className
  return node
}

function button(text, click, className) {
  const control = element('button', text, className)
  control.type = 'button'
  control.onclick = click
  return control
}

function card(tag = 'section', className = 'ag-card') {
  const node = element(tag, '', className)
  node.dataset.themeSurface = 'card'
  return node
}

function control(container, tag, label, help) {
  const field = element('label', label)
  const input = element(tag)
  input.setAttribute('aria-label', label)
  input.dataset.themeSurface = 'input'
  input.spellcheck = false
  field.append(input)
  if (help) field.append(element('span', help, 'ag-muted'))
  container.append(field)
  return input
}

function message() {
  const node = element('p', '', 'ag-muted')
  node.setAttribute('role', 'status')
  return node
}

function say(node, text, failed = false) {
  node.setAttribute('role', failed ? 'alert' : 'status')
  node.textContent = text
}

function disclosure(title, ...nodes) {
  const details = element('details', '', 'ag-source')
  details.append(element('summary', title), ...nodes)
  return details
}

function mcpDisplayName(name, t) {
  return name.replace(/[\\⟦]| +|[^\S ]|[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, (part, offset) => {
    // Escape literal notation so an original name cannot look like an annotated one.
    if (part === '\\' || part === '⟦') return '\\' + part
    if (part[0] !== ' ') return '⟦U+' + part.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + '⟧'
    if (part === ' ' && offset > 0 && offset + 1 < name.length) return part
    return '⟦' + part.length + ' ' + (part.length === 1 ? t.mcpSpace : t.mcpSpaces) + '⟧'
  })
}

function accentContrast(root, ctx) {
  const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!paint) return
  function update() {
    paint.clearRect(0, 0, 1, 1)
    paint.fillStyle = getComputedStyle(root).getPropertyValue('--accent-primary').trim() || '#2563eb'
    paint.fillRect(0, 0, 1, 1)
    const [r, g, b] = Array.from(paint.getImageData(0, 0, 1, 1).data, value => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    root.style.setProperty('--ag-on-accent', 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000' : '#fff')
  }
  update()
  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
  ctx.lifecycle.add(() => observer.disconnect())
}

export function mount(root, ctx) {
  const t = copy[ctx.locale] ?? (ctx.locale === 'zh-HK' ? copy['zh-TW'] : ctx.locale?.startsWith('zh') ? copy.zh : copy.en)
  const page = element('section', '', 'ag-page')
  root.replaceChildren(element('style', styles), page)
  accentContrast(root, ctx)
  let mounted = true
  ctx.lifecycle.add(() => { mounted = false })
  const alive = () => mounted
  if (ctx.view === 'configuration') mountSettings(page, ctx, t, alive)
  else mountResources(page, ctx, t, alive)
}

function mountSettings(page, ctx, t, alive) {
  let busy = false
  let loaded = false
  let revision = ''
  let savedText = ''
  const header = element('header', '', 'ag-header')
  const actions = element('div', '', 'ag-actions')
  const reload = button(t.refresh, () => run(async () => {
    if (loaded && editor.value !== savedText && !await ctx.ui.confirm(t.discard)) return
    if (alive()) await load()
  }))
  const save = button(t.saveSettings, () => run(async () => {
    await ctx.rpc.call('save-settings', { text: editor.value, revision })
    if (!alive()) return
    await readSettings()
    if (alive()) {
      say(status, t.saved)
      ctx.ui.notify(t.saved, 'success')
    }
  }), 'ag-primary')
  actions.append(save, reload)
  header.append(element('h1', t.configuration), actions)
  const status = message()
  const engineStatus = message()
  const commands = element('code', 'auggie auth login  (1.x)\nauggie login       (0.x)')
  const engine = card()
  engine.append(element('h2', t.engine), engineStatus,
    element('div', '', 'ag-actions'), disclosure(t.login, element('p', t.loginHelp), commands))
  engine.querySelector('.ag-actions').append(button(t.management, () => ctx.ui.navigate('/studio/agents')))
  const modes = card()
  modes.append(element('h2', t.modes), element('p', t.scope), element('p', t.scoped), element('p', t.layers, 'ag-muted'))
  const preferences = card('section', 'ag-card ag-preferences')
  preferences.append(element('h2', t.prefs))
  const editor = control(preferences, 'textarea', t.prefsLabel, t.settingsHelp + ' ' + t.patchHelp)
  editor.maxLength = 524288
  const source = element('code', '', 'ag-label')
  source.setAttribute('aria-label', t.location)
  const docs = element('a', t.docs)
  docs.href = 'https://docs.augmentcode.com/cli/settings'
  docs.target = '_blank'
  docs.rel = 'noopener noreferrer'
  preferences.append(source, disclosure(t.example, element('pre', '{\n  "defaultModel": "sonnet",\n  "theme": null\n}'), docs))
  const grid = element('div', '', 'ag-settings')
  grid.append(engine, modes, preferences)
  const content = element('div', '', 'ag-content')
  content.append(status, grid)
  page.append(header, content)

  async function readSettings() {
    const value = await ctx.rpc.call('read-settings', {})
    if (!alive()) return
    source.textContent = value.path
    savedText = editor.value = value.text
    revision = value.revision
    loaded = true
  }

  async function detectEngine() {
    say(engineStatus, t.engineLoading)
    try {
      const value = await ctx.rpc.call('settings-engine-status', {})
      if (!alive()) return
      const install = value.source === 'external' ? t.external : t.managed
      say(engineStatus, value.installed ? value.version + ' · ' + install : value.error || t.engineMissing, Boolean(value.error))
    } catch (error) {
      if (alive()) say(engineStatus, error?.message || t.failed, true)
    }
  }

  async function load() {
    const probe = detectEngine()
    try { await readSettings() } finally { await probe }
  }

  function update() {
    page.setAttribute('aria-busy', String(busy))
    reload.disabled = busy
    editor.disabled = save.disabled = busy || !loaded
  }

  async function run(action) {
    if (busy || !alive()) return
    busy = true
    update()
    say(status, loaded ? '' : t.loading)
    try {
      await action()
      if (alive() && status.textContent === t.loading) say(status, '')
    } catch (error) {
      if (alive()) say(status, error?.message || t.failed, true)
    } finally {
      busy = false
      if (alive()) update()
    }
  }

  void run(load)
}

function mountResources(page, ctx, t, alive) {
  const skills = ctx.view === 'skills'
  const kind = skills ? 'skill' : 'mcp'
  const title = t[ctx.view]
  let loaded = false
  let busy = false
  let items = []
  let revision = ''
  let selected = ''
  let previewSequence = 0
  let activeEditor
  const documents = new Map()
  const mcpSwitches = new Map()
  let pendingSwitch

  const list = skills ? card('aside', 'ag-list') : element('div', '', 'ag-cards')
  if (skills) list.setAttribute('aria-label', t.list)
  const detail = card('section', 'ag-detail')
  const layout = element('div', '', 'ag-layout')
  if (skills) layout.append(list, detail)
  const sourcePath = element('code', '', 'ag-label')
  sourcePath.setAttribute('aria-label', t.location)
  const sources = disclosure(t.sources, sourcePath, element('p', t.scope), element('p', t.layers))
  const status = message()
  const count = element('strong')
  const enabledCount = element('strong')
  const disabledCount = element('strong')
  const header = element('header', '', 'ag-header')
  const search = element('input')
  const searchLabel = skills ? t.searchSkills : t.searchMcp
  search.type = 'search'
  search.placeholder = searchLabel
  search.setAttribute('aria-label', searchLabel)
  search.dataset.themeSurface = 'input'
  search.oninput = () => render()
  const reload = button(t.refresh, () => run(load))
  const add = button(skills ? t.addSkill : t.addMcp, () => openEditor(), 'ag-primary')
  const actions = element('div', '', 'ag-actions')
  actions.append(reload, add)
  header.append(element('h1', title), search, actions)
  const content = element('div', '', 'ag-content')
  const scope = element('p', skills ? t.skillLimit : t.mcpLimit, 'ag-muted')
  scope.append(' ', t.scoped)
  content.append(status, sources, scope)
  if (!skills) {
    const summary = element('p', '', 'ag-row')
    summary.append(t.total, count, t.enabled, enabledCount, t.disabled, disabledCount, element('span', t.global, 'ag-tag'))
    content.append(summary)
  }
  content.append(skills ? layout : list)

  const dialog = card('dialog')
  const form = element('form', '', 'ag-form')
  const heading = element('h2')
  heading.id = 'auggie-editor-title'
  dialog.setAttribute('aria-labelledby', heading.id)
  const fields = element('fieldset')
  const name = control(fields, 'input', t.name)
  name.maxLength = skills ? 64 : 524288
  name.required = true
  const multilineName = skills ? null : control(fields, 'textarea', t.name)
  if (multilineName) {
    multilineName.className = 'ag-name-lines'
    multilineName.rows = 2
    multilineName.readOnly = true
    multilineName.parentElement.hidden = true
  }
  const nameHelp = element('span', skills ? t.skillNameHelp : '', 'ag-muted')
  nameHelp.id = 'auggie-skill-name-rule'
  if (skills) {
    name.pattern = '[a-z0-9]+(?:-[a-z0-9]+)*'
    name.title = t.skillNameHelp
    name.setAttribute('aria-describedby', nameHelp.id)
    name.parentElement.append(nameHelp)
  }
  const description = skills ? control(fields, 'input', t.description) : null
  if (description) {
    description.required = true
    description.maxLength = 1024
  }
  const text = control(fields, 'textarea', skills ? t.body : t.defaultMcp, skills ? '' : t.mcpEditHelp)
  text.maxLength = 524288
  const raw = skills ? control(fields, 'textarea', t.raw, t.nativeHint) : null
  if (raw) raw.maxLength = 524288
  const editorStatus = message()
  const editorActions = element('div', '', 'ag-actions')
  const nativeEditor = button(t.nativeEditor, async () => {
    if (busy) return
    try {
      if ((valueChanged() && !await ctx.ui.confirm(t.discard)) || !alive()) return
      showSkillFields(true)
      activeEditor.baseline = fieldsValue()
      raw.focus()
    } catch (error) {
      if (alive()) say(editorStatus, error?.message || t.failed, true)
    }
  })
  const cancel = button(t.cancel, cancelEditor)
  const save = button(t.save, saveEditor, 'ag-primary')
  if (skills) editorActions.append(nativeEditor)
  editorActions.append(cancel, save)
  form.append(heading, fields, editorStatus, editorActions)
  form.onsubmit = saveEditor
  form.onkeydown = event => {
    if (event.key === 'Enter' && !event.isComposing && event.target.tagName === 'INPUT') {
      event.preventDefault()
      save.click()
    }
  }
  dialog.oncancel = event => {
    event.preventDefault()
    void cancelEditor()
  }
  dialog.append(form)
  page.append(header, content, dialog)
  ctx.lifecycle.add(() => dialog.close())

  function controls() {
    page.setAttribute('aria-busy', String(busy))
    reload.disabled = busy
    add.disabled = search.disabled = !loaded || busy
    fields.disabled = cancel.disabled = save.disabled = nativeEditor.disabled = busy
    for (const target of content.querySelectorAll('button')) {
      target.disabled = busy && target !== pendingSwitch?.control
    }
  }

  async function run(action, success = '') {
    if (busy || !alive()) return
    busy = true
    const target = dialog.open ? editorStatus : status
    controls()
    say(target, loaded ? '' : t.loading)
    try {
      const result = await action()
      if (!alive()) return
      say(target, '')
      if (success) {
        say(status, success)
        ctx.ui.notify(success, 'success')
      }
      return result
    } catch (error) {
      if (alive()) say(dialog.open ? editorStatus : status, error?.message || t.failed, true)
    } finally {
      busy = false
      if (alive()) controls()
    }
  }

  async function load() {
    const value = await ctx.rpc.call(skills ? 'list-skills' : 'list-mcp', {})
    if (!alive()) return
    sourcePath.textContent = value.path
    revision = value.revision ?? ''
    items = value.items
    count.textContent = String(items.length)
    enabledCount.textContent = String(items.filter(item => item.enabled === true).length)
    disabledCount.textContent = String(items.filter(item => item.enabled === false).length)
    documents.clear()
    loaded = true
    render()
  }

  function skill(name) {
    if (!documents.has(name)) {
      const pending = ctx.rpc.call('read-skill', { name }).catch(error => {
        if (documents.get(name) === pending) documents.delete(name)
        throw error
      })
      documents.set(name, pending)
    }
    return documents.get(name)
  }

  function renderDetail(item) {
    const seq = ++previewSequence
    detail.replaceChildren()
    if (!item) {
      detail.append(element('p', t.select, 'ag-muted'))
      return
    }
    const back = button(t.list, () => {
      layout.classList.remove('ag-show-detail')
      list.querySelector('[aria-pressed=true]')?.focus()
    }, 'ag-back')
    const top = element('div', '', 'ag-heading')
    top.append(back, element('h2', item.name), rowActions(item))
    const pathSeparator = sourcePath.textContent.includes('\\') ? '\\' : '/'
    const file = [sourcePath.textContent, item.name, 'SKILL.md'].join(pathSeparator)
    const description = element('p', item.description || t.invalidSkill, 'ag-muted')
    const preview = element('pre', t.loading, 'ag-preview')
    preview.setAttribute('aria-label', t.raw)
    const tags = element('div', '', 'ag-row')
    tags.append(element('span', t.global, 'ag-tag'))
    detail.append(top, tags, description, element('code', file, 'ag-label'), preview)
    void skill(item.name).then(value => {
      if (!alive() || seq !== previewSequence) return
      description.textContent = value.description || t.invalidSkill
      preview.textContent = value.revision ? value.text.slice(value.bodyOffset ?? 0) : t.noSkill
    }, error => {
      if (alive() && seq === previewSequence) preview.textContent = error?.message || t.failed
    })
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase()
    const filtered = items.filter(item => [item.name, item.description, item.transport].some(value => value?.toLocaleLowerCase().includes(query)))
    if (pendingSwitch?.control === page.ownerDocument.activeElement) pendingSwitch.restoreFocus = true
    mcpSwitches.clear()
    list.replaceChildren()
    if (!filtered.length) {
      list.append(element('p', items.length ? t.noMatches : skills ? t.emptySkill : t.emptyMcp, 'ag-muted'))
      if (skills) {
        layout.classList.remove('ag-show-detail')
        renderDetail()
      }
      return
    }
    if (!skills) {
      for (const item of filtered) {
        const row = card('article')
        const name = mcpDisplayName(item.name, t)
        const tags = element('div', '', 'ag-row')
        tags.append(element('span', item.transport === 'unsupported' ? '—' : item.transport.toUpperCase(), 'ag-tag'),
          element('span', t.global, 'ag-tag'))
        if (item.enabled !== undefined) tags.append(element('span', item.enabled ? t.enabled : t.disabled, 'ag-tag'))
        row.append(element('h2', name), tags)
        if (item.transport === 'unsupported') row.append(element('p', t.unsupportedMcp, 'ag-muted'))
        row.append(rowActions(item, name))
        list.append(row)
      }
      return
    }
    if (!filtered.some(item => item.name === selected)) selected = filtered[0].name
    for (const item of filtered) {
      const select = button('', () => {
        selected = item.name
        layout.classList.add('ag-show-detail')
        render()
        const back = detail.querySelector('.ag-back')
        if (back?.getClientRects().length) back.focus()
        else list.querySelector('[aria-pressed=true]')?.focus()
      })
      select.setAttribute('aria-pressed', String(selected === item.name))
      select.append(element('strong', item.name), element('span', item.description || '', 'ag-label'))
      list.append(select)
    }
    renderDetail(filtered.find(item => item.name === selected))
  }

  function rowActions(item, name = item.name) {
    const group = element('div', '', 'ag-actions')
    function action(label, click, style) {
      const control = button(label, click, style)
      control.setAttribute('aria-label', label + ' ' + name)
      group.append(control)
    }
    if (!skills && item.editable) action(t.view, () => openEditor(item, 'view'))
    if (skills || item.editable) action(t.edit, () => openEditor(item, 'edit'))
    if (item.enabled !== undefined) {
      const label = item.enabled ? t.disable : t.enable
      const toggle = button(label, async () => {
        if (busy || !alive()) return
        const pending = { control: toggle, restoreFocus: false }
        pendingSwitch = pending
        toggle.setAttribute('aria-disabled', 'true')
        await run(async () => {
          await ctx.rpc.call('set-mcp-enabled', { name: item.name, revision, enabled: !item.enabled })
          if (alive()) await load()
        }, t.saved)
        pendingSwitch = undefined
        toggle.removeAttribute('aria-disabled')
        const doc = page.ownerDocument
        if (pending.restoreFocus && alive() && doc.hasFocus() && doc.activeElement === doc.body) {
          (mcpSwitches.get(item.name) ?? search).focus()
        }
      })
      toggle.setAttribute('role', 'switch')
      toggle.setAttribute('aria-checked', String(item.enabled))
      toggle.setAttribute('aria-label', label + ' ' + name)
      mcpSwitches.set(item.name, toggle)
      group.append(toggle)
    }
    action(t.remove, () => run(async () => {
      const fileRevision = skills ? (await skill(item.name)).revision : revision
      if (!await ctx.ui.confirm((skills ? t.removeSkill : t.removeMcp) + ' (' + name + ')') || !alive()) return
      await ctx.rpc.call('remove-' + kind, { name: item.name, revision: fileRevision })
      if (selected === item.name) layout.classList.remove('ag-show-detail')
      await load()
      if (alive()) reload.focus()
      return true
    }).then(result => {
      if (result && alive()) {
        say(status, t.removed)
        ctx.ui.notify(t.removed, 'success')
      }
    }), 'ag-danger')
    return group
  }

  function showSkillFields(useRaw) {
    activeEditor.useRaw = useRaw
    text.parentElement.hidden = description.parentElement.hidden = useRaw
    description.disabled = useRaw
    raw.parentElement.hidden = !useRaw
    raw.value = activeEditor.document?.text ?? ''
    nativeEditor.hidden = useRaw || !activeEditor.item
  }

  function fieldsValue() {
    return JSON.stringify([name.value, description?.value, text.value, raw?.value])
  }

  function valueChanged() {
    return activeEditor.baseline !== fieldsValue()
  }

  function closeEditor() {
    dialog.close()
    activeEditor = undefined
    add.focus()
  }

  async function cancelEditor() {
    if (busy || !activeEditor) return
    try {
      if ((valueChanged() && !await ctx.ui.confirm(t.discard)) || !alive()) return
      closeEditor()
    } catch (error) {
      if (alive()) say(editorStatus, error?.message || t.failed, true)
    }
  }

  function openEditor(item, mode = 'edit') {
    void run(async () => {
      const document = item ? await (skills ? skill(item.name) : ctx.rpc.call('read-mcp', { name: item.name })) : null
      if (!alive()) return
      if (skills && item && !document.revision) throw new Error(t.noSkill)
      activeEditor = { item, document, revision: document?.revision ?? (skills ? '' : revision) }
      const label = item && (skills ? item.name : mcpDisplayName(item.name, t))
      heading.textContent = item ? (mode === 'view' ? t.view : t.edit) + ' ' + label : skills ? t.addSkill : t.addMcp
      const originalName = item?.name ?? ''
      const hasLineBreaks = !skills && /[\r\n]/.test(originalName)
      if (multilineName) {
        multilineName.value = hasLineBreaks ? originalName : ''
        multilineName.parentElement.hidden = !hasLineBreaks
        name.parentElement.hidden = hasLineBreaks
      }
      name.value = hasLineBreaks ? '' : originalName
      name.readOnly = Boolean(item)
      nameHelp.hidden = Boolean(item)
      const readOnly = mode === 'view'
      save.hidden = readOnly
      text.readOnly = readOnly
      cancel.textContent = readOnly ? t.close : t.cancel
      if (skills) {
        description.value = document?.description ?? ''
        text.value = document?.text.slice(document?.bodyOffset ?? 0) ?? ''
        showSkillFields(Boolean(document && document.bodyOffset === undefined))
      } else {
        text.value = document?.text ?? '{\n  "type": "stdio",\n  "command": "",\n  "args": []\n}'
      }
      activeEditor.baseline = fieldsValue()
      say(editorStatus, '')
      dialog.showModal()
      return true
    }).then(opened => {
      if (!opened || !alive() || !dialog.open) return
      const target = item ? (activeEditor.useRaw ? raw : text) : name
      target.focus()
    })
  }

  function saveEditor(event) {
    event?.preventDefault()
    if (busy || !activeEditor || save.hidden || !form.reportValidity()) return
    void run(async () => {
      const target = activeEditor.item?.name ?? name.value
      const input = { name: target, revision: activeEditor.revision }
      if (skills && !activeEditor.useRaw) {
        await ctx.rpc.call('edit-skill', { ...input, description: description.value, body: text.value })
      } else {
        input.text = skills ? raw.value : text.value
        if (!skills) input.existing = Boolean(activeEditor.item)
        await ctx.rpc.call('save-' + kind, input)
      }
      if (!alive()) return
      if (skills) selected = target
      closeEditor()
      await load()
    }, t.saved)
  }

  void run(load)
}
