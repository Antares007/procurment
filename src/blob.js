'use strict'
var GitObject = require('./gitobject')
var run = require('gen-run')

class Blob extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git, cb) {
    if (!cb) return this.valueOf.bind(this, git)
    var self = this
    run(function * () {
      var hash = yield self.getHash(git)
      return yield git.loadAs('blob', hash)
    }, cb)
  }

  static of (buffer) {
    return new Blob((git, cb) => run(function * () {
      var blobHash = yield git.saveAs('blob', buffer)
      return blobHash
    }, cb))
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
