'use strict'
var Tree = require('./tree')
var Json = require('./json')

class List extends Tree {
  map (fn) {
    return this.bind(Tree, function (oldTree) {
      return Tree.of({
        blocks: oldTree.blocks.bind(Tree, function (oldTree) {
          return Tree.of(Object.keys(oldTree).reduce(function (newTree, name) {
            newTree[name] = oldTree[name].castTo(Json).bind(Json, (array) => array.map(fn))
            return newTree
          }, {}))
        })
      })
    }).castTo(List)
  }

  valueOf (repo) {
    var array = []
    return super.valueOf(repo).then(function (tree) {
      return tree.blocks.valueOf(repo).then(function (tree) {
        return Promise.all(
          Object.keys(tree).map((name) => tree[name].castTo(Json).valueOf(repo).then(function (array2) {
            for (var i2 = 0, len = array2.length; i2 < len; i2++) {
              let index = parseInt(name, 10) * 10 + i2
              array[index] = array2[i2]
            }
          }))
        ).then(() => array)
      })
    })
  }

  static of (array) {
    var tree = {}
    for (let i = 0, len = array.length; i < len; i++) {
      let index1 = Math.floor(i / 10)
      let index2 = i - index1 * 10
      if (!tree[index1]) {
        tree[index1] = []
      }
      tree[index1][index2] = array[i]
    }
    Object.keys(tree).forEach((name) => {
      tree[name] = Json.of(tree[name])
    })
    return Tree.of({
      blocks: Tree.of(tree)
    }).castTo(List)
  }
}
module.exports = List
