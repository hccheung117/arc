import { withApp } from '@cli/bootstrap.js'
import { buildTools } from '@main/services/tools.js'

const skillDir = 'arcfs://profiles/eascoai-test/skills/using-excel'

withApp(async () => {
  const tools = buildTools({ skills: [{ directory: skillDir }] })
  const result = await tools.exec.execute({
    runner: 'node',
    script: 'scripts/xlsx.js inspect test.xlsx',
    cwd: skillDir,
  })
  console.log(JSON.stringify(result, null, 2))
})
