#!/usr/bin/env node
'use strict'
const gitDir = process.argv[2]
const seedHash = process.argv[3]

const api = require('../repo')(gitDir)
const valueOf = require('deasync')(function (hashish, cb) {
  hashish
    .valueOf(api)
    .then((v) => cb(null, v))
    .catch((err) => cb(err))
})
const loadObj = function (Type, hash) {
  var rez = new Type(() => Promise.resolve(hash))
  rez.hash = hash
  return rez
}
const runInThisContext = require('vm').runInThisContext
const join = require('path').join
const dirname = require('path').dirname

var Blob = require('../src/blob')
var Tree = require('../src/tree')
var Json = require('../src/json')

var seedTree = loadObj(Tree, seedHash)
var files = valueOf(lsTree(seedTree, [])).reduce((s, x) => (s[x.path.toLowerCase()] = x.hash, s), {})
var get = (path) => files[path] ? loadObj(Blob, files[path.toLowerCase()]) : undefined
var cache = {}

console.log(valueOf(loadAsDirectory('')()))

function load (blob, path) {
  var id = blob.hash
  if (cache[id]) return cache[id]
  var code = valueOf(blob)
  var compiledWrapper = runInThisContext(`(module, require) => {\n${code.toString()}\n}`, {
    filename: path,
    lineOffset: 0,
    displayErrors: true
  })
  var module = { }
  // require(X) from module at path Y
  // 1. If X is a core module,
  //    a. return the core module
  //    b. STOP
  // 2. If X begins with './' or '/' or '../'
  //    a. LOAD_AS_FILE(Y + X)
  //    b. LOAD_AS_DIRECTORY(Y + X)
  // 3. LOAD_NODE_MODULES(X, dirname(Y))
  // 4. THROW "not found"
  var require = function (request) {
    var rez = loadAsFile(join(dirname(path), request))
    return rez
  }
  compiledWrapper(module, require)
  return (cache[id] = module.exports)
}

// LOAD_AS_FILE(X)
// 1. If X is a file, load X as JavaScript text.  STOP
// 2. If X.js is a file, load X.js as JavaScript text.  STOP
// 3. If X.json is a file, parse X.json to a JavaScript Object.  STOP
// 4. If X.node is a file, load X.node as binary addon.  STOP
function loadAsFile (path) {
  var file
  var filePath
  if ((file = get(path))) return load(file, path)
  if ((file = get((filePath = path + '.js')))) return load(file, filePath)
}

// LOAD_AS_DIRECTORY(X)
// 1. If X/package.json is a file,
//    a. Parse X/package.json, and look for "main" field.
//    b. let M = X + (json main field)
//    c. LOAD_AS_FILE(M)
// 2. If X/index.js is a file, load X/index.js as JavaScript text.  STOP
// 3. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
// 4. If X/index.node is a file, load X/index.node as binary addon.  STOP
function loadAsDirectory (path) {
  var file
  var filePath
  if ((file = get((filePath = join(path, 'package.json'))))) return loadAsFile(join(path, JSON.parse(valueOf(file).toString()).main))
  if ((file = get((filePath = join(path, 'index.js'))))) return load(file, filePath)
}

function lsTree (tree, path) {
  return tree.bind(Json, function (t) {
    var thisTreeFiles = []
    return Object.keys(t).reduce(function (state, name) {
      var e = t[name]
      if (e instanceof Tree) {
        return state.bind(Json, (v1) => lsTree(e, path.concat(name)).bind(Json, (v2) => v1.concat(v2)))
      }
      thisTreeFiles.push({ path: path.concat(name).join('/'), hash: e.hash })
      return state
    }, Json.of([])).bind(Json, (v) => v.concat(thisTreeFiles))
  })
}
