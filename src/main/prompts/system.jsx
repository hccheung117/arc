import os from 'node:os'
import { skillEnvName } from '../services/skill.js'

const Skill = ({ name, path, children }) => (
  <skill name={name} path={path}>{children}</skill>
)

const AvailableAgents = ({ agents }) => (
    <available_agents>
        {`Use the subagent tool to delegate tasks to specialized agents when the task benefits from isolated context, parallel execution, or specialization.`}
        {agents.map(a => (
            <agent name={a.name}>{a.description}</agent>
        ))}
    </available_agents>
)

const AvailableSkills = ({ skills }) => (
  <available_skills>
    {`Proactively load a skill using the load_skill tool whenever it can help with the current task.
Do not call load_skill for a skill whose instructions are already present in the conversation.`}
    {skills.map(s => (
      <Skill name={s.name} path={`$${skillEnvName(s.name)}`}>{s.description}</Skill>
    ))}
  </available_skills>
)

const SessionWorkspace = () => (
  <session_workspace path="$WORKSPACE">
    {`Your working directory for user-facing deliverables. Store final outputs and files intended for the user here.
All deliverables you create should be stored in $WORKSPACE by default. Do not write to any other path unless the user explicitly provides one. If a task requires writing outside $WORKSPACE and the user has not specified a path, report an error instead of choosing an alternative path.
To read files the user shared, use read_file with their original filesystem paths.`}
  </session_workspace>
)

const SessionTmp = () => (
  <session_tmp path="$SESSION_TMP">
    {`Your scratch space for intermediate and in-progress files. Store drafts, temporary data, work-in-progress artifacts, and any middle-stage production here.
Do not place user-facing deliverables in $SESSION_TMP — those belong in $WORKSPACE.`}
  </session_tmp>
)

const platform = process.platform === 'darwin' ? 'macos' : 'windows'

const RuntimeInfo = () => (
  <runtime_info>
    {`OS: ${platform} ${os.release()}`}
    Client: Arc Desktop
  </runtime_info>
)

export const buildSystemPrompt = (system, skills, agents = []) => (
  <>
    {system}
      {agents.length > 0 && <AvailableAgents agents={agents} />}
      {skills.length > 0 && <AvailableSkills skills={skills} />}
    <SessionWorkspace />
    <SessionTmp />
    <RuntimeInfo />
  </>
)
