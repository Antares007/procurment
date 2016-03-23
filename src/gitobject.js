'use strict'
const isHash = /^[0123456789abcdef]{40}$/

module.exports = class GitObject {
  constructor (hash) {
    if (typeof hash === 'function') {
      this.hashFn = hash
    } else if (typeof hash === 'string' && isHash.test(hash)) {
      this.hash = hash
      this.hashFn = (git) => Promise.resolve(hash)
    } else {
      throw new Error('hashFn != function or not hash string ' + hash)
    }
  }

  getHash (git) {
    if (!this.promised) {
      this.promised = this.hashFn(git).then((hash) => (this.hash = hash, hash))
    }
    return this.promised
  }

  bind (Type, fn) {
    return new Type((git) => this.valueOf(git).then(function (value) {
      var rez = fn(value)
      if (rez instanceof GitObject) {
        if (rez.constructor !== Type) {
          return Type.prototype.cast(rez).getHash(git)
        } else {
          return rez.getHash(git)
        }
      } else {
        return Type.of(rez).getHash(git)
      }
    }))
  }

  valueOf (git) {
    throw new Error('abstact valueOf')
  }

  cast (value) {
    throw new Error('cant cast ' + value.constructor.name + ' to ' + this.constructor.name)
  }
}
