const shaRegex = /^[0123456789abcdef]{40}$/

class GitObject {
  constructor (shaFn) {
    if (typeof shaFn === 'string') {
      if (shaRegex.test(shaFn)) {
        this.shaFn = (git) => Promise.resolve(shaFn)
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

  bind (Type, fn) {
    ensure(() => typeof fn === 'function')
    return new Type(
      async (git) => {
        var value = await this.valueOf(git)
        var rez = fn(value)
        ensure(() => rez instanceof GitObject)
        return await rez.getSha(git)
      }
    )
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

function ensure (assertFn) {
  if (!assertFn()) throw new Error(assertFn.toString())
}

module.exports.GitObject = GitObject
