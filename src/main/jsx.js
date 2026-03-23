export function h(tag, props, ...children) {
  const flat = children.flat(Infinity).filter(x => x != null && x !== false && x !== true)

  if (typeof tag === 'function') {
    return tag({ ...props, children: flat.length === 1 ? flat[0] : flat })
  }

  const attrs = props
    ? Object.entries(props)
        .filter(([k, v]) => v != null && k !== 'children' && k !== 'key')
        .map(([k, v]) => ` ${k}="${v}"`)
        .join('')
    : ''

  const content = flat.join('\n')
  return content ? `<${tag}${attrs}>\n${content}\n</${tag}>` : `<${tag}${attrs} />`
}

export function Fragment({ children }) {
  const parts = Array.isArray(children) ? children : [children]
  return parts.filter(Boolean).join('\n\n')
}
