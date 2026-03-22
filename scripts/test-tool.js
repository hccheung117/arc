import { withApp } from '@cli/bootstrap.js'
import { buildTools } from '@main/services/tools.js'

const skillDir = 'arcfs://profiles/eascoai-test/skills/using-excel'

withApp(async () => {
  const tools = buildTools({
    skills: [{ name: 'using-excel', directory: skillDir }],
    workspacePath: '/tmp/test-workspace',
  })
  const result = await tools.run_file.execute({
    runner: 'node',
    file: 'scripts/xlsx.js',
    args: 'inspect test.xlsx',
    cwd: '$USING_EXCEL_SKILL_DIR',
  })
  console.log(JSON.stringify(result, null, 2))
})
