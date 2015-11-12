'use strict'
const isHash = /^[0123456789abcdef]{40}$/

module.exports = class GitObject {
  constructor (hash) {
    if (typeof hash === 'function') {
      this.hashFn = hash
    } else if (typeof hash === 'string' && isHash.test(hash)) {
      this.hash = hash
    } else {
      throw new Error('hashFn != function or not hash string ' + hash)
    }
  }

  getHash (git) {
    if (this.hash) return Promise.resolve(this.hash)
    return this.hashFn(git).then(hash => this.hash = hash)
  }

  bind (Type, fn) {
    return new Type(git => this.valueOf(git).then(function (value) {
      var rez = fn(value)
      if (rez.constructor !== Type) {
        return Type.prototype.cast(rez).getHash(git)
      } else {
        return rez.getHash(git)
      }
    }))
  }
}
