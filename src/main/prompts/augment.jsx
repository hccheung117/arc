import { h } from '../jsx.js'

export const renderWorkspaceFiles = (paths) => (
  <global_workspace_files>
    {`Files have been added to your workspace. Use the \`read_file\` tool to access their live contents. Do NOT guess their contents.`}
    {paths.map(p => `- ${p}`)}
  </global_workspace_files>
)

export const renderActiveSkill = (name, body, env) => (
  <active_skill name={name} path={env ? `$${env}` : undefined}>{body}</active_skill>
)
