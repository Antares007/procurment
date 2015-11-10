var GitObject = require('./gitobject').GitObject

class Blob extends GitObject {
  constructor (gitContext) {
    super(gitContext)
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

  merge (blobs, fn) {
    var values = []
    return this.bind(Blob, function merge (value) {
      values.push(value)
      var other = blobs.shift()
      if (typeof other !== 'undefined') {
        return other.bind(Blob, merge)
      } else {
        return Blob.of(fn(values))
      }
    })
  }
}

module.exports = { Blob }
