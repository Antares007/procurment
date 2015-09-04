var shaRegex = /^[0123456789abcdef]{40}$/

export class GitObject {

  constructor (shaFn) {
    if (typeof shaFn === 'string') {
      if (shaRegex.test(shaFn)) {
        this.shaFn = (git) => shaFn
      } else {
        this.shaFn = (git) => git.revParse(shaFn)
      }
    } else {
      this.shaFn = shaFn
    }
  }

  getSha (git) {
    if (this.promisedSha) return this.promisedSha
    this.promisedSha = this.shaFn(git)
    return this.promisedSha
  }

}
