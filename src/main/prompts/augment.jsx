export const renderWorkspaceFiles = (paths) => (
  <global_workspace_files>
    {`Files have been added to your workspace. Use the \`read_file\` tool to access their live contents. Do NOT guess their contents.`}
    {paths.map(p => `- ${p}`)}
  </global_workspace_files>
)

export const renderActiveSkill = (name, body, env) => (
  <active_skill name={name} path={env ? `$${env}` : undefined}>{body}</active_skill>
)

export const renderCurrentTime = () => (
  <current_time>{new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}</current_time>
)

export const renderSystemReminders = ({ agents = [], skills = [] } = {}) => {
  if (!agents.length && !skills.length) return null
  return (
    <system_reminders>
      {[
        ...agents.map(name => `- You must delegate the respective task to the "${name}" subagent.`),
        ...skills.map(name => `- You should follow the "${name}" skill instructions.`),
      ].join('\n')}
    </system_reminders>
  )
}
