'use strict'
var GitObject = require('./gitobject')

class Blob extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('blob', hash)
    })
  }

  static of (buffer) {
    return new Blob(git => git.saveAs('blob', buffer))
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
Blob.prototype.mode = parseInt('0100644', 8)
module.exports = Blob
