import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedBinaryFile = ReturnType<FoundationCapabilities['binaryFile']>

export default defineCapability((binaryFile: ScopedBinaryFile) => ({
  deleteUserPersonaDir: (name: string) =>
    binaryFile.deleteDir(`app/personas/${name}`),
}))
