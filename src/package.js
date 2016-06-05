const Tree = require('gittypes/tree')
const Json = require('gittypes/json')

class Package extends Tree {
  valueOf (api) {
    return super.valueOf(api).then(function (tree) {
      return tree['package.json'].castTo(Json).valueOf(api).then(function (pack) {
        return tree['dependencies'].valueOf(api).then(function (dependencies) {
          return Object.assign({}, pack, {
            src: tree['src'],
            dependencies: Object.keys(dependencies).reduce(function (s, name) {
              s[name] = dependencies[name].castTo(Package)
              return s
            }, {})
          })
        })
      })
    })
  }

  static of (value) {
    return Tree.of({
      'package.json': ls(value.src).bind(Json, (srcEntries) =>
        Object.assign({}, value, {
          src: undefined,
          dependencies: undefined,
          srcEntries
        })),
      'src': value.src,
      'dependencies': Tree.of(value.dependencies || {})
    }).castTo(Package)
  }
}
module.exports = Package

function ls (tree) {
  return tree.bind(Json, function (t) {
    var enames = Object.keys(t)
    var trees = []
    var list = enames.reduce(function (s, name) {
      var e = t[name]
      // name = name.toLowerCase()
      if (e instanceof Tree) {
        trees.push({ name, tree: e })
      } else {
        s[name] = e.hash
      }
      return s
    }, {})
    return trees
      .map((x) => ls(x.tree).bind(Json, (v) => prependPath(v, x.name)))
      .concat(Json.of(list))
      .reduce((j1, j2) => j1.bind(Json, (v1) => j2.bind(Json, (v2) => Object.assign({}, v1, v2))))
  })
}

function prependPath (v, pre) {
  return Object.keys(v).reduce((s, path) => {
    s[pre + '/' + path] = v[path]
    return s
  }, {})
}
