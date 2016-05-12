'use strict'
var GitObject = require('./gitobject')

class Blob extends GitObject {
  valueOf (repo) {
    return super.valueOf(repo).then(function (go) {
      if (go.type !== 'blob') throw new Error('not a blob')
      return go.body
    })
  }

  static of (buffer) {
    return GitObject.of({ type: 'blob', body: buffer }).castTo(Blob)
  }
}
module.exports = Blob
