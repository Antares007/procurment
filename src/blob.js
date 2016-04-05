'use strict'
var Hashish = require('./hashish')

class Blob extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('blob', hash)
    })
  }

  static of (buffer) {
    return new Blob((git) => git.saveAs('blob', buffer))
  }
}
Blob.prototype.mode = parseInt('0100644', 8)
module.exports = Blob
