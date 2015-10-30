const shaRegex = /^[0123456789abcdef]{40}$/

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

  do (fn) {
    if (this.promisedSha) return this.promisedSha.then(x => (fn(x), x))
    var oldShafn = this.shaFn
    this.shaFn = async function (git) {
      var sha = await oldShafn(git)
      fn(sha)
      return sha
    }
    return this
  }
}
