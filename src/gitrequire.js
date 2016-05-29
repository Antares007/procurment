'use strict'
const debug = require('debug')('module')
const runInThisContext = require('vm').runInThisContext
const join = require('path').join
const dirname = require('path').dirname

var cache = {}
module.exports = function (api, seedHash) {
  var getModule = require('./fileloader')(api, seedHash)

  global.seedHash = seedHash

  var exports = loadAsDirectory('/')
  return exports

  function load (mdl, path) {
    var id = mdl.hash
    debug(`load(cached = ${!!cache[id]})`, path)
    if (cache[id]) return cache[id]
    var dir = dirname(path)
    var code = mdl.content
    var wrappedCode = `(module, exports, require, __filename, __dirname) => {\n${code}\n}`
    var opt = { filename: path, lineOffset: 0, displayErrors: true }
    var compiledWrapper = runInThisContext(wrappedCode, opt)

    // require(X) from module at path Y
    // 1. If X is a core module,
    //    a. return the core module
    //    b. STOP
    // 2. If X begins with './' or '/' or '../'
    //    a. LOAD_AS_FILE(Y + X)
    //    b. LOAD_AS_DIRECTORY(Y + X)
    // 3. LOAD_NODE_MODULES(X, dirname(Y))
    // 4. THROW "not found"
    var require = function (x) {
      var y = dir
      var rez
      debug(`require(${x}) at ${path}`)
      if ((rez = loadCoreModule(x))) return rez
      if (x.startsWith('/') || x.startsWith('./') || x.startsWith('../')) {
        if ((rez = loadAsFile(join(y, x)))) return rez
        if ((rez = loadAsDirectory(join(y, x)))) return rez
      }
      if ((rez = loadNodeModules(x, y))) return rez
      throw new Error('not found ' + x + ' at ' + y)
    }
    var module = { exports: {}, hash: id }

    compiledWrapper(module, module.exports, require, path, dir)
    cache[id] = module.exports
    return module.exports
  }

  // LOAD_AS_FILE(X)
  // 1. If X is a file, load X as JavaScript text.  STOP
  // 2. If X.js is a file, load X.js as JavaScript text.  STOP
  // 3. If X.json is a file, parse X.json to a JavaScript Object.  STOP
  // 4. If X.node is a file, load X.node as binary addon.  STOP
  function loadAsFile (path) {
    debug('loadAsFile', path)
    var file
    var filePath
    if ((file = getModule(path))) return load(file, path)
    if ((file = getModule((filePath = path + '.js')))) return load(file, filePath)
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
    debug('loadAsDirectory', path)
    var file
    var filePath
    if ((file = getModule((filePath = join(path, 'package.json'))))) return loadAsFile(join(path, JSON.parse(file.content).main))
    if ((file = getModule((filePath = join(path, 'index.js'))))) return load(file, filePath)
  }

  // LOAD_NODE_MODULES(X, START)
  // 1. let DIRS=NODE_MODULES_PATHS(START)
  // 2. for each DIR in DIRS:
  //    a. LOAD_AS_FILE(DIR/X)
  //    b. LOAD_AS_DIRECTORY(DIR/X)
  function loadNodeModules (x, start) {
    var dirs = nodeModulesPaths(start)
    var rez
    debug('loadNodeModules', x, start, dirs)
    for (var dir of dirs) {
      if ((rez = loadAsFile(join(dir, x)))) return rez
      if ((rez = loadAsDirectory(join(dir, x)))) return rez
    }
  }
}

// NODE_MODULES_PATHS(START)
// 1. let PARTS = path split(START)
// 2. let I = count of PARTS - 1
// 3. let DIRS = []
// 4. while I >= 0,
//    a. if PARTS[I] = "node_modules" CONTINUE
//    c. DIR = path join(PARTS[0 .. I] + "node_modules")
//    b. DIRS = DIRS + DIR
//    c. let I = I - 1
// 5. return DIRS
function nodeModulesPaths (start) {
  let parts = start.split('/')
  var i = parts.length - 1
  let dirs = []
  while (i >= 0) {
    if (parts[i] !== 'node_modules') {
      dirs.push(parts.slice(0, i + 1).concat('node_modules').join('/'))
    }
    i = i - 1
  }
  return dirs
}

function loadCoreModule (x) {
  var mods = {
    'crypto': require('crypto'),
    'fs': {}
  }
  return mods[x]
}
