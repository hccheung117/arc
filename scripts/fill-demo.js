import { withApp } from '@cli/bootstrap.js'
import { resolve, appendJsonl } from '@main/arcfs.js'
import { createSession } from '@main/services/session.js'
import { generateId } from 'ai'
import fs from 'node:fs/promises'
import path from 'node:path'

const sidebarTitles = [
  'Changelog: March Release',
  'Support Ticket Templates',
  'Knowledge Base: Getting Started',
  'Customer FAQ Update',
  'Office Lease Options',
  'Vendor Comparison: Analytics',
  'Legal: Privacy Policy Update',
  'Hiring: First Engineer',
  'Q2 OKRs',
  'Project Timeline Update',
  'Weekly Sync Notes',
  'Performance Audit',
  'Onboarding Flow Redesign',
  'API Rate Limiting',
  'Database Migration Plan',
  'Mobile App Wireframes',
  'Bug Fix: Stripe Webhooks',
  'Referral Program Draft',
  'Product Hunt Launch Plan',
  'Social Media Calendar',
  'SEO Audit: Landing Pages',
  'Website Copy Revision',
  'Blog Post: Productivity',
  'Email Campaign Ideas',
  'Pricing Page A/B Test',
  'Chase Overdue Payments',
  'Contract Review: Acme Corp',
  'Client Proposal: Acme Corp',
  'Q1 Tax Prep',
]

withApp(async () => {
  const dir = resolve('sessions')

  // Step 1: Clear all sessions
  await fs.rm(dir, { recursive: true, force: true })
  console.log('Cleared sessions directory')

  // Step 2: Create sidebar-only sessions (bottom-up order)
  for (const title of sidebarTitles) {
    const id = await createSession(dir, title)
    console.log(`  ${id}  ${title}`)
  }

  // Step 3: Create and populate "Generate April Invoices"
  const activeTitle = 'Generate April Invoices'
  const activeId = await createSession(dir, activeTitle)
  const filePath = path.join(dir, activeId, 'messages.jsonl')

  const userId = generateId()
  const assistantId = generateId()

  await appendJsonl(filePath,
    {
      id: userId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Generate the April invoice for Acme Corp from `march-timesheet.csv`. My hourly rate is $120.',
        },
      ],
    },
    {
      id: assistantId,
      role: 'assistant',
      arcParentId: userId,
      parts: [
        {
          type: 'tool-load_skill',
          toolCallId: generateId(),
          state: 'output-available',
          input: { name: 'generating-invoices' },
          output: 'Skill loaded successfully.',
        },
        {
          type: 'tool-read_file',
          toolCallId: generateId(),
          state: 'output-available',
          input: { path: '$WORKSPACE/march-timesheet.csv' },
          output: 'Date,Task,Hours\n2025-03-04,Architecture Planning,4\n2025-03-05,Frontend Development,6\n2025-03-12,API Integration,5\n2025-03-18,Client Sync & Review,2',
        },
        {
          type: 'tool-run_file',
          toolCallId: generateId(),
          state: 'output-available',
          input: {
            runner: 'node',
            file: 'generate-invoice.js',
            args: '--input march-timesheet.csv --rate 120 --client "Acme Corp" --output acme-invoice-march.xlsx',
            cwd: '$WORKSPACE',
          },
          output: 'Invoice generated successfully: acme-invoice-march.xlsx',
        },
        {
          type: 'text',
          text: "I've generated the Excel invoice based on your timesheet and saved it as `acme-invoice-march.xlsx`. Here's a preview of the breakdown:\n\n| Date | Task | Hours | Amount |\n| :--- | :--- | :--- | :--- |\n| Mar 04 | Architecture Planning | 4 | $480 |\n| Mar 05 | Frontend Development | 6 | $720 |\n| Mar 12 | API Integration | 5 | $600 |\n| Mar 18 | Client Sync & Review | 2 | $240 |\n| **Total** | | **17** | **$2,040** |",
        },
      ],
    },
  )

  console.log(`  ${activeId}  ${activeTitle} (with messages)`)
  console.log('\nDone! 30 sessions created.')
})
