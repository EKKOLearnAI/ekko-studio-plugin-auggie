const english = {
  skills: 'Skills', mcp: 'MCP servers', configuration: 'Configuration',
  scope: 'Global · Auggie host user', scopeHelp: 'Changes apply to the next Auggie process. Project and organization settings may take precedence.',
  skillHelp: 'Edit SKILL.md with matching name and description in YAML front matter. Removing a Skill here retains its other files.',
  mcpHelp: 'Edit an Auggie stdio, http or sse server in user settings.json. Keep [stored value] at its original position to retain an existing value.',
  configHelp: 'Editable settings: defaultModel, enableSkillCommands, enableToolSearch, theme and notificationMode. Omitted keys are preserved. Use null to remove an override.',
  loginHelp: 'Sign in as the Studio host OS user with auggie auth login (1.x) or auggie login (0.x).',
  docs: 'Auggie configuration reference', resource: 'Resource', name: 'Name', editor: 'Editor', add: 'New',
  save: 'Save', remove: 'Remove', refresh: 'Reload', pending: 'Loading…', done: 'Saved', removed: 'Removed',
  choose: 'Select a resource', confirm: 'Remove this Auggie resource?', failed: 'Could not update Auggie configuration.',
}
const chinese = {
  skills: 'Skill 管理', mcp: 'MCP 管理', configuration: '配置文件',
  scope: 'Global · Auggie 宿主用户', scopeHelp: '改动在下个 Auggie 进程生效。项目和组织设置可能具有更高优先级。',
  skillHelp: '编辑 SKILL.md，YAML 头需包含与名称一致的 name 及 description。移除 Skill 会保留目录中的其他文件。',
  mcpHelp: '编辑用户 settings.json 中的 stdio、http 或 sse 服务器。将 [stored value] 留在原位置可保留已有值。',
  configHelp: '可编辑 defaultModel、enableSkillCommands、enableToolSearch、theme 和 notificationMode。省略键会保留原值，设为 null 可清除用户覆盖。',
  loginHelp: '以 Studio 宿主系统账号运行 auggie auth login（1.x）或 auggie login（0.x）登录。',
  docs: 'Auggie 配置参考', resource: '资源', name: '名称', editor: '编辑器', add: '新建',
  save: '保存', remove: '移除', refresh: '重新读取', pending: '正在读取…', done: '已保存', removed: '已移除',
  choose: '选择资源', confirm: '移除此 Auggie 资源？', failed: '无法更新 Auggie 配置。',
}
const traditional = {
  ...chinese, skills: 'Skill 管理', configuration: '設定檔', name: '名稱', editor: '編輯器',
  scopeHelp: '變更在下一個 Auggie 程序生效。專案與組織設定可能具有更高的優先順序。',
  skillHelp: '編輯 SKILL.md，YAML 標頭須包含同名的 name 及 description。移除 Skill 會保留其他檔案。',
  mcpHelp: '編輯使用者 settings.json 內的 stdio、http 或 sse 伺服器。將 [stored value] 留在原處以保留既有值。',
  configHelp: '可編輯 defaultModel、enableSkillCommands、enableToolSearch、theme 和 notificationMode。省略的鍵會保持原值，null 會移除覆寫。',
  loginHelp: '使用 Studio 主機的作業系統帳號執行 auggie auth login（1.x）或 auggie login（0.x）登入。',
  docs: 'Auggie 設定參考', resource: '資源', add: '新增', save: '儲存', refresh: '重新讀取',
  pending: '正在讀取…', done: '已儲存', choose: '選擇資源', confirm: '移除此 Auggie 資源？', failed: '無法更新 Auggie 設定。',
}
const styles = `
  .auggie-config { display: grid; gap: .8rem; max-width: 66rem; }
  .auggie-config h1, .auggie-config p { margin: 0; }
  .auggie-config h1 { font-size: 1.35rem; }
  .auggie-config .scope, .auggie-config .help { color: var(--text-secondary, GrayText); line-height: 1.5; }
  .auggie-config .source { overflow-wrap: anywhere; font-size: .85rem; }
  .auggie-config .toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: .55rem; }
  .auggie-config label { display: grid; gap: .3rem; }
  .auggie-config button, .auggie-config input, .auggie-config select, .auggie-config textarea {
    font: inherit; background: var(--bg-input, Canvas); color: var(--text-primary, CanvasText);
    border: 1px solid var(--border, GrayText); border-radius: .4rem; padding: .45rem .65rem;
  }
  .auggie-config button:not(:disabled) { cursor: pointer; }
  .auggie-config button:disabled { opacity: .55; }
  .auggie-config textarea { box-sizing: border-box; width: 100%; min-height: 17rem;
    resize: vertical; font: .9rem/1.55 ui-monospace, monospace; tab-size: 2; }
  .auggie-config [role=status] { min-height: 1.4rem; overflow-wrap: anywhere; }
  .auggie-config a { color: var(--accent-primary, LinkText); }
  .auggie-config [hidden] { display: none !important; }
`

export function mount(root, ctx) {
  const t = ctx.locale === 'zh-TW' || ctx.locale === 'zh-HK' ? traditional : ctx.locale?.startsWith('zh') ? chinese : english
  const view = ctx.view
  const skill = view === 'skills'
  const config = view === 'configuration'
  const kind = skill ? 'skill' : 'mcp'
  let disposed = false
  let busy = false
  let ready = false
  let selection
  let revision = ''
  let listRevision = ''
  let skillTemplate = ''
  ctx.lifecycle.add(() => { disposed = true })
  const el = (tag, text = '') => {
    const node = document.createElement(tag)
    node.textContent = text
    return node
  }
  const button = text => {
    const node = el('button', text)
    node.type = 'button'
    return node
  }
  function field(label, control, parent) {
    const wrapper = el('label')
    wrapper.append(el('span', label), control)
    control.setAttribute('aria-label', label)
    parent.append(wrapper)
  }
  const css = el('style', styles)
  const page = el('section')
  page.className = 'auggie-config'
  const scope = el('p', t.scope + ' · ' + t.scopeHelp)
  scope.className = 'scope'
  const path = el('code')
  path.className = 'source'
  const help = el('p', config ? t.configHelp : skill ? t.skillHelp : t.mcpHelp)
  help.className = 'help'
  const status = el('p')
  status.setAttribute('role', 'status')
  const toolbar = el('div')
  toolbar.className = 'toolbar'
  const select = el('select')
  const add = button(t.add)
  const refresh = button(t.refresh)
  if (!config) {
    field(t.resource, select, toolbar)
    toolbar.append(add)
  }
  toolbar.append(refresh)
  const form = el('section')
  form.className = 'auggie-config'
  const name = el('input')
  name.maxLength = 80
  name.spellcheck = false
  if (!config) field(t.name, name, form)
  const editor = el('textarea')
  editor.spellcheck = false
  editor.maxLength = 524288
  field(t.editor, editor, form)
  const save = button(t.save)
  const remove = button(t.remove)
  const actions = el('div')
  actions.className = 'toolbar'
  actions.append(save)
  if (!config) actions.append(remove)
  form.append(actions)
  page.append(el('h1', t[view]), scope, path, help, toolbar, form, status)
  if (config) {
    const docs = el('a', t.docs)
    docs.href = 'https://docs.augmentcode.com/cli/settings.md'
    docs.target = '_blank'
    docs.rel = 'noopener noreferrer'
    page.append(el('p', t.loginHelp), docs)
  }
  root.replaceChildren(css, page)

  function updateControls() {
    page.setAttribute('aria-busy', String(busy))
    refresh.disabled = busy
    select.disabled = busy || !ready
    add.disabled = busy || !ready
    editor.disabled = busy || !ready
    name.disabled = editor.disabled
    save.disabled = editor.disabled
    remove.disabled = editor.disabled
    remove.hidden = selection === undefined
    form.hidden = !ready || !config && selection === null
    name.readOnly = selection !== undefined
  }

  async function perform(action) {
    if (busy) return
    busy = true
    status.textContent = t.pending
    updateControls()
    try {
      const message = await action()
      if (!disposed) status.textContent = message ?? ''
    } catch (error) {
      if (!disposed) status.textContent = error instanceof Error ? error.message : t.failed
    } finally {
      busy = false
      if (!disposed) updateControls()
    }
  }
  async function read(selected) {
    const result = await ctx.rpc.call('read-' + kind, { name: selected })
    if (disposed) return
    selection = selected
    name.value = selected
    editor.value = result.text
    revision = result.revision
  }
  async function load(selected) {
    if (config) {
      const value = await ctx.rpc.call('read-settings', {})
      if (disposed) return
      path.textContent = value.path
      editor.value = value.text
      revision = value.revision
    } else {
      const value = await ctx.rpc.call(skill ? 'list-skills' : 'list-mcp', {})
      if (disposed) return
      path.textContent = value.path
      listRevision = value.revision ?? ''
      select.replaceChildren(new Option(t.choose, ''), ...value.names.map(item => new Option(item, item)))
      selection = selected && value.names.includes(selected) ? selected : null
      if (selection) {
        select.value = selection
        await read(selection)
      }
    }
    ready = true
  }
  refresh.onclick = () => perform(() => load(selection))
  select.onchange = () => perform(async () => {
    const selected = select.value
    selection = null
    if (selected) await read(selected)
  })
  add.onclick = () => {
    selection = undefined
    revision = skill ? '' : listRevision
    select.value = ''
    name.value = ''
    skillTemplate = ''
    editor.value = skill ? '' : '{\n  "type": "stdio",\n  "command": ""\n}'
    updateControls()
    name.focus()
  }
  name.oninput = () => {
    if (skill && editor.value === skillTemplate && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name.value)) {
      skillTemplate = '---\nname: ' + name.value + '\ndescription: ""\n---\n\n'
      editor.value = skillTemplate
    }
  }
  save.onclick = () => perform(async () => {
    const target = name.value.trim()
    const input = { text: editor.value, revision }
    if (!config) input.name = target
    if (!config && !skill) input.existing = selection !== undefined
    await ctx.rpc.call(config ? 'save-settings' : 'save-' + kind, input)
    if (!disposed) await load(config ? undefined : target)
    return t.done
  })
  remove.onclick = () => perform(async () => {
    if (!await ctx.ui.confirm(t.confirm) || disposed) return
    await ctx.rpc.call('remove-' + kind, { name: selection, revision })
    if (!disposed) await load()
    return t.removed
  })
  void perform(() => load())
}
