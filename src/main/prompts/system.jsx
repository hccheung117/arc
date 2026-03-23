import { h, Fragment } from '../jsx.js'
import { skillEnvName } from '../services/skill.js'

const Skill = ({ name, path, children }) => (
  <skill name={name} path={path}>{children}</skill>
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
All deliverables you create MUST be stored in $WORKSPACE. Do not write to any other path unless the user explicitly provides one. If a task requires writing outside $WORKSPACE and the user has not specified a path, report an error instead of choosing an alternative path.
To read files the user shared, use read_file with their original filesystem paths.`}
  </session_workspace>
)

const SessionTmp = () => (
  <session_tmp path="$SESSION_TMP">
    {`Your scratch space for intermediate and in-progress files. Store drafts, temporary data, work-in-progress artifacts, and any middle-stage production here.
Do not place user-facing deliverables in $SESSION_TMP — those belong in $WORKSPACE.`}
  </session_tmp>
)

export const buildSystemPrompt = (system, skills) => (
  <>
    {system}
    {skills.length > 0 && <AvailableSkills skills={skills} />}
    <SessionWorkspace />
    <SessionTmp />
  </>
)
