declare module 'write-file-atomic' {
  interface WriteFileAtomicOptions {
    encoding?: string;
    mode?: string | number;
    flag?: string;
    fsync?: boolean;
  }

  function writeFileAtomic(
    filename: string,
    data: string | Buffer,
    options?: WriteFileAtomicOptions | string
  ): Promise<void>;

  function writeFileAtomic(
    filename: string,
    data: string | Buffer,
    callback: (error: NodeJS.ErrnoException | null) => void
  ): void;

  function writeFileAtomic(
    filename: string,
    data: string | Buffer,
    options: WriteFileAtomicOptions | string,
    callback: (error: NodeJS.ErrnoException | null) => void
  ): void;

  export = writeFileAtomic;
}
