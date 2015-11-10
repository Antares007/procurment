'use strict'
const isHash = /^[0123456789abcdef]{40}$/
var run = require('gen-run')

class GitObject {
  constructor (hash) {
    if (typeof hash === 'function') {
      this.hashFn = hash
    } else if (typeof hash === 'string' && isHash.test(hash)) {
      this.hash = hash
    } else {
      throw new Error('hashFn != function or not hash string ' + hash)
    }
  }

  getHash (git, cb) {
    if (!cb) return this.getHash.bind(this, git)
    if (this.hash || this.err) return cb(this.err, this.hash)
    var fn = this.hashFn
    delete this.hashFn
    fn(git, (err, hash) => {
      if (err) {
        this.err = err
      }
      this.hash = hash
      cb(err, hash)
    })
  }

  bind (Type, fn) {
    var self = this
    return new Type((git, cb) => run(function * () {
      var value = yield self.valueOf(git)
      var rez = fn(value)
      return yield rez.getHash(git)
    }, cb))
  }
}

module.exports.GitObject = GitObject
