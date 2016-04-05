'use strict'
var Tree = require('./tree')
var Blob = require('./blob')
var fs = require('fs')
var stat = toPromise(fs.stat.bind(fs))
var readDir = toPromise(fs.readdir.bind(fs))
var readFile = toPromise(fs.readFile.bind(fs))

module.exports = tree

function dir (path) {
  return readDir(path.join('/')).then(function (names) {
    return Promise.all(names.map((name) => stat(path.concat(name).join('/')).then((stats) => ({ name, stats }))))
  })
}

function tree (path, filter) {
  filter = filter || (() => true)
  return new Tree(
    (git) => dir(path).then(function (ls) {
      var t = ls.filter(filter).reduce(function (t, e) {
        if (e.stats.isFile()) t[e.name] = blob(path.concat(e.name))
        if (e.stats.isDirectory()) t[e.name] = tree(path.concat(e.name), filter)
        return t
      }, {})
      return Tree.of(t).getHash(git)
    })
  )
}

function blob (path) {
  return new Blob(
    (git) => readFile(path.join('/')).then((buffer) => Blob.of(buffer).getHash(git))
  )
}

function toPromise (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise((resolve, reject) => {
      fn.apply(this, args.concat(function (err, value) {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      }))
    })
  }
}
