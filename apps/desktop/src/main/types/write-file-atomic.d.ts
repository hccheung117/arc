declare module 'write-file-atomic' {
  interface Options {
    chown?: { uid: number; gid: number }
    encoding?: BufferEncoding
    fsync?: boolean
    mode?: number
    tmpfileCreated?: (tmpfile: string) => void
  }

  function writeFileAtomic(
    filename: string,
    data: string | Buffer,
    options?: Options
  ): Promise<void>

  export = writeFileAtomic
}
