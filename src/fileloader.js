const deasync = require('deasync')
const join = require('path').join
const Blob = require('gittypes/blob')
const Tree = require('gittypes/tree')

module.exports = function (api, treeHash) {
  const valueOf = deasync(function (hashish, cb) {
    hashish
      .valueOf(api)
      .then((v) => cb(null, v))
      .catch((err) => cb(err))
  })

  var entries = prependPath(ls(treeHash), '/')
  entries['/'] = { hash: treeHash, type: 'Tree' }

  function prependPath (v, pre) {
    return Object.keys(v).reduce((s, path) => (s[join(pre, path)] = v[path], s), {})
  }

  function ls (treeHash) {
    var t = valueOf(loadObj(Tree, treeHash))
    var enames = Object.keys(t)
    var trees = []
    var list = enames.reduce(function (s, name) {
      var e = t[name]
      name = name.toLowerCase()
      if (e instanceof Tree) {
        trees.push({ name, tree: e })
      }
      s[name] = { type: e.constructor.name, hash: e.hash }
      return s
    }, {})
    return trees
      .map((x) => prependPath(ls(x.tree.hash), x.name))
      .concat(list)
      .reduce((v1, v2) => Object.assign(v1, v2))
  }
  return mkMemoizer()(function (path) {
    path = path.toLowerCase()
    var entry = entries[path]
    if (entry && entry.type === 'Blob') {
      return {
        hash: entry.hash,
        content: valueOf(loadObj(Blob, entry.hash)).toString()
      }
    } else {
      return null
    }
  })
}

function loadObj (Type, hash) {
  var rez = new Type(() => Promise.resolve(hash))
  rez.hash = hash
  return rez
}

function mkMemoizer () {
  var cache = {}
  return function (fn) {
    return function (arg) {
      arg = arg.toLowerCase()
      if (typeof cache[arg] !== 'undefined') return cache[arg]
      var rez = fn(arg)
      cache[arg] = rez
      return rez
    }
  }
}
