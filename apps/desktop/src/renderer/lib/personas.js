export async function createPersona(name, systemPrompt) {
  return window.arc.personas.create({ name, systemPrompt })
}

export async function deletePersona(name) {
  return window.arc.personas.delete({ name })
}
