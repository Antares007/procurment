'use strict'
var GitObject = require('./gitobject')

class Blob extends GitObject {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('blob', hash)
    })
  }

  static of (buffer) {
    return new Blob((git) => git.saveAs('blob', buffer))
  }

  static fromJS (obj) {
    return Blob.of(new Buffer(JSON.stringify(obj)))
  }

  static concat (blobs) {
    return blobs.pop().merge(blobs, function (buffs) {
      return Buffer.concat(buffs)
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
Blob.prototype.mode = parseInt('0100644', 8)
module.exports = Blob
