import { defineCapability } from '@main/kernel/module'

export default defineCapability((binaryFile) => ({
  deleteUserPersonaDir: (name) =>
    binaryFile.deleteDir(`app/personas/${name}`),
}))
