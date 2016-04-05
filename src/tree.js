'use strict'
var Hashish = require('./hashish')
const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const blob = parseInt('100644', 8)
const tree = parseInt('40000', 8)
const commit = parseInt('160000', 8)

// parseInt( '40000', 8)  tree:
// parseInt('100644', 8)  blob:
// parseInt('100644', 8)  file:
// parseInt('100755', 8)  exec:
// parseInt('120000', 8)  sym:
// parseInt('160000', 8)  commit:

function toType (mode) {
  if ((mode & blob) === blob) return require('./blob')
  if (mode === tree) return require('./tree')
  if (mode === commit) return require('./commit')
  throw new Error('mode not supported')
}

class Tree extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      if (hash === emptyTreeHash) return {}
      return git.loadAs('tree', hash).then(function (entries) {
        var clone = {}
        for (var name of Object.keys(entries)) {
          let e = entries[name]
          let Ctor = toType(e.mode)
          let obj = new Ctor(() => Promise.resolve(e.hash))
          obj.mode = e.mode
          clone[name] = obj
        }
        return clone
      })
    })
  }

  static of (value) {
    var keys = Object.keys(value)
    if (keys.length === 0) return Hashish.get(Tree, emptyTreeHash)
    return new Tree(
      (git) => Promise.all(
        keys.map((name) => {
          var obj = value[name]
          return obj.getHash(git).then((hash) => ({ name, mode: obj.mode, hash }))
        })
      ).then((entries) => git.saveAs('tree', entries.reduce(function (s, e) {
        if (e.hash === emptyTreeHash) return s
        s[e.name] = { mode: e.mode, hash: e.hash }
        return s
      }, {}))
      )
    )
  }

  get (Type, path, nullValue) {
    var pathsToGo = path.split('/')
    return this.bind(Type, function find (entries) {
      var name = pathsToGo.shift()
      var entry = entries[name]
      if (entry) {
        if (pathsToGo.length === 0) {
          return entry
        } else {
          if (entry instanceof Tree) {
            return entry.get(Type, pathsToGo.join('/'), nullValue)
          } /* if (entry instanceof Commit) { } */ else {
            throw new Error('not implemented, blob is bloking paths to go')
          }
        }
      } else {
        if (nullValue) {
          return nullValue
        }
        throw new Error('not found')
      }
    })
  }

  map (mapFn) {
    function doMap (tree) {
      return tree.bind(Tree, function (t) {
        return Object.keys(t).reduce(function (s, name) {
          s[name] = mapFn(t[name])
          return s
        }, {})
      })
    }
    return doMap(this)
  }

  diff (patterns, other) {
    var retEmpty = () => Tree.empty
    var addedFn = patterns.added || retEmpty
    var deletedFn = patterns.deleted || retEmpty
    var modifiedFn = patterns.modified || retEmpty
    var equalFn = patterns.equal || retEmpty
    var diff = function (t1, t2, path) {
      return t1.bind(Tree, function (t1) {
        return t2.bind(Tree, function (t2) {
          var names = new Set(Object.keys(t1).concat(Object.keys(t2)))
          var rez = {}
          for (var name of names) {
            var e1 = t1[name]
            var e2 = t2[name]
            if (e1 && e2) {
              if (e1.hash === e2.hash) {
                rez[name] = equalFn(e1, e2, path.concat(name))
              } else {
                if (e1 instanceof Tree && e2 instanceof Tree) {
                  rez[name] = diff(e1, e2, path.concat(name))
                } else {
                  rez[name] = modifiedFn(e1, e2, path.concat(name))
                }
              }
            } else if (e1) {
              rez[name] = deletedFn(e1, path.concat(name))
            } else {
              rez[name] = addedFn(e2, path.concat(name))
            }
          }
          return rez
        })
      })
    }
    return diff(this, other, [])
  }

  merge3 (mergeFn, ours, theirs) {
    mergeFn = mergeFn || function () {
      throw new Error('cant merge with default logic')
    }
    var merge3 = function (base, ours, theirs, path) {
      return base.bind(Tree, function (base) {
        return ours.bind(Tree, function (ours) {
          return theirs.bind(Tree, function (theirs) {
            var names = new Set(
              Object.keys(base)
                .concat(Object.keys(ours))
                .concat(Object.keys(theirs))
            )
            var rez = {}
            for (var name of names) {
              var be = base[name]
              var oe = ours[name]
              var te = theirs[name]
              if (be && oe && te) {
                if (be.hash === oe.hash && be.hash === te.hash) {
                  rez[name] = be
                } else {
                  if (be instanceof Tree && oe instanceof Tree && te instanceof Tree) {
                    rez[name] = merge3(be, oe, te, path.concat(name))
                  } else {
                    rez[name] = mergeFn(be, oe, te, path.concat(name))
                  }
                }
              } if (te) {
                if (te.hash === (be || oe).hash) {
                  rez[name] = Tree.empty
                } else {
                  if ((be || oe) instanceof Tree && te instanceof Tree) {
                    rez[name] = merge3(be || Tree.empty, oe || Tree.empty, te, path.concat(name))
                  } else {
                    rez[name] = mergeFn(be, oe, te, path.concat(name))
                  }
                }
              } if (be && !oe) {
                rez[name] = be
              } if (oe && !be) {
                rez[name] = oe
              } else {
                if (be instanceof Tree && oe instanceof Tree) {
                  rez[name] = merge3(be, oe, Tree.empty, path.concat(name))
                } else {
                  rez[name] = mergeFn(be, oe, te, path.concat(name))
                }
              }
            }
            return rez
          })
        })
      })
    }
    return merge3(this, ours, theirs, [])
  }
}
Tree.prototype.mode = parseInt('040000', 8)
Tree.empty = Hashish.get(Tree, emptyTreeHash)
module.exports = Tree
