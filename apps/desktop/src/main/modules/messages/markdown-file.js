/**
 * Messages Markdown File Capability
 *
 * Library for business: absorbs export formatting, filename generation,
 * and dialog interaction. Business calls exportChat with messages,
 * never touches formatting or filesystem directly.
 */

import { defineCapability } from '@main/kernel/module'

function formatTimeShort(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDateFull(date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' at ' + formatTimeShort(date)
}

function formatRole(role) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatMessagesToMarkdown(messages) {
  const now = new Date()
  const lines = [
    '# Chat Export',
    '',
    `**Exported**: ${formatDateFull(now)}`,
    '',
  ]

  for (const message of messages) {
    if (!message.role || message.role === 'system') continue
    lines.push(
      '---',
      '',
      `## ${formatRole(message.role)}`,
      '',
      message.content ?? '',
      '',
      `*${formatTimeShort(new Date(message.createdAt ?? now))}*`,
      '',
    )
  }

  lines.push('---')
  return lines.join('\n')
}

function generateExportFilename() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `Arc-Chat-${date}-${time}.md`
}

export default defineCapability((mdFile) => ({
  /** Formats messages as markdown and prompts user to save. Returns chosen path or null. */
  exportChat: (messages) => {
    const markdown = formatMessagesToMarkdown(messages)
    return mdFile.saveAs(markdown, {
      defaultPath: generateExportFilename(),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
  },
}))
