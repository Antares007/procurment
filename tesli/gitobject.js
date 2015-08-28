export class GitObject {

  constructor (shaFn) {
    if (typeof shaFn === 'string') {
      this.shaFn = (git) => git.revParse(shaFn)
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
