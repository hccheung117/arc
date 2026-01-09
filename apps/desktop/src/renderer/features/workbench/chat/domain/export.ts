import type { Message } from '@arc-types/messages'

function formatTimeShort(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateFull(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' at ' + formatTimeShort(date)
}

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function formatMessagesToMarkdown(messages: Message[]) {
  const now = new Date()
  const lines = [
    '# Chat Export',
    '',
    `**Exported**: ${formatDateFull(now)}`,
    '',
  ]

  for (const message of messages) {
    if (message.role === 'system') continue

    lines.push(
      '---',
      '',
      `## ${formatRole(message.role)}`,
      '',
      message.content,
      '',
      `*${formatTimeShort(new Date(message.createdAt))}*`,
      '',
    )
  }

  lines.push('---')

  return lines.join('\n')
}

export function generateExportFilename() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  return `Chat-${date}.md`
}
