'use strict'
class Hashish {
  constructor (hashFn) {
    if (typeof hashFn !== 'function') throw new Error('argument error')
    this.getHash = (repo) => hashFn(repo).then((hash) => (this.hash = hash, hash))
  }

  bind (Type, fn) {
    return new Type((repo) => this.valueOf(repo).then(function (value) {
      var rez = fn(value)
      if (rez instanceof Hashish) {
        if (rez.constructor === Type) {
          return rez.getHash(repo)
        } else {
          throw new Error(`cant bind ${rez.constructor.name} to ${Type.name}`)
        }
      } else {
        return Type.of(rez).getHash(repo)
      }
    }))
  }

  valueOf (repo) {
    return this.getHash(repo).then((hash) => repo.valueOf(hash))
  }

  castTo (Type) {
    return new Type((repo) => this.getHash(repo))
  }

  static of (buffer) {
    return new Hashish((repo) => repo.hash(buffer))
  }
}
module.exports = Hashish

var oldValueOf = Hashish.prototype.valueOf
var valuesCache = new Map()
Hashish.prototype.valueOf = function (repo) {
  if (valuesCache.has(this)) return valuesCache.get(this)
  var rez = oldValueOf.call(this, repo)
  valuesCache.set(this, rez)
  return rez
}
