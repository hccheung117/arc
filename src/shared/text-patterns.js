export const FILE_REF = /@"((?:[^"\\]|\\.)*)"|@((?:arcfs:\/\/|\.\.\/|\.\/|~\/|\/)\S*)/g

export const quotePath = (path) => {
  if (/\s/.test(path)) return '"' + path.replace(/[\\"]/g, '\\$&') + '"'
  return path
}

export const unquotePath = (str) => str.replace(/\\(.)/g, '$1')

export const extractFileRefs = (text) =>
  [...text.matchAll(FILE_REF)].map(m => ({
    path: m[1] ? unquotePath(m[1]) : m[2],
    start: m.index,
    end: m.index + m[0].length,
  }))

export const SKILL_REF = /(^|\s)\/([\w-]+)/g

export const extractSkillRefs = (text, knownSkills) => {
  const set = new Set(knownSkills)
  return [...text.matchAll(SKILL_REF)]
    .filter(m => set.has(m[2]))
    .map(m => ({
      name: m[2],
      start: m.index + m[1].length,
      end: m.index + m[0].length,
    }))
}

export const AGENT_REF = /(^|\s)@([\w-]+)/g

export const extractAgentRefs = (text, knownAgents) => {
  const set = new Set(knownAgents)
  return [...text.matchAll(AGENT_REF)]
    .filter(m => set.has(m[2]))
    .map(m => ({
      name: m[2],
      start: m.index + m[1].length,
      end: m.index + m[0].length,
    }))
}
