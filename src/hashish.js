'use strict'
const isHash = /^[0123456789abcdef]{40}$/

module.exports = class Hashish {
  static get (Type, hash) {
    return new Type((git) => Promise.resolve(hash))
  }

  constructor (hash) {
    if (typeof hash !== 'function') throw new Error('argument error')
    this.hashFn = hash
  }

  getHash (git) {
    if (!this.promised) {
      var promise = this.hashFn(git)
      if (!(promise instanceof Promise)) throw new Error('hashFn dont returns Promise' + this.hashFn.toString())
      this.promised = promise.then((hash) => {
        if (typeof hash !== 'string') throw new Error('promised hash is not string')
        if (!isHash.test(hash)) throw new Error('promised hash is not hash string')
        this.hash = hash
        return hash
      })
    }
    return this.promised
  }

  bind (Type, fn) {
    return new Type((git) => this.valueOf(git).then(function (value) {
      var rez = fn(value)
      if (rez instanceof Hashish) {
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
