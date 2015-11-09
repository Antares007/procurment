import { GitObject } from './gitobject'

export class Blob extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isBlob = true
  }

  valueOf (git) {
    return this.getSha(git).then(hash => git.loadAs('blob', hash))
  }

  static of (buffer) {
    return new Blob(async git => {
      var blobHash = await git.saveAs('blob', buffer)
      return blobHash
    })
  }
}
