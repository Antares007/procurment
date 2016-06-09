#!/usr/bin/env node
'use strict'
const argv = require('yargs')
  .default('git-dir', require('path').resolve(process.cwd(), '.git'))
  .demand(1)
  .argv
const gitDir = argv.gitDir
const targetPath = argv._[0]

const api = require('../src/repo')(gitDir)
const path = require('path')
const fs = require('fs')
const splitRe = process.platform === 'win32' ? /[\/\\]/ : /\//
const internalModuleStat = process.binding('fs').internalModuleStat
const Package = require('gittypes/package')

const cache = {}

hashpackage(path.resolve(targetPath))
  .getHash(api)
  .then((value) => console.log(value))
  .catch((err) => process.nextTick(function () { throw err }))

function hashpackage (dirPath) {
  return new Package(function (api) {
    if (cache[dirPath]) return cache[dirPath]
    var p = readPackage(dirPath)
    var srcTree = importDir(dirPath)
    var modulePaths = nodeModulePaths(dirPath)
    var dependencies = Object.keys(p.dependencies || []).reduce(function (s, depName) {
      for (var i = 0, PL = modulePaths.length; i < PL; i++) {
        // Don't search further if path doesn't exist
        if (modulePaths[i] && stat(modulePaths[i]) < 1) continue
        var basePath = path.resolve(modulePaths[i], depName, 'package.json')
        const rc = stat(basePath)
        if (rc === 0) {  // File.
          var depDir = path.dirname(fs.realpathSync(basePath))
          s[depName] = hashpackage(depDir)
          return s
        }
      }
      throw new Error(`dep ${depName} not found for ${dirPath} in ${modulePaths.join(';')}`)
    }, {})
    var rez = Package.of({
      name: p.name,
      version: p.version,
      description: p.description,
      main: p.main,
      src: srcTree,
      dependencies: dependencies
    }).getHash(api)
    cache[dirPath] = rez
    return rez
  })
}

function importDir (dir) {
  var readdir = require('../src/treefromfs')
  return readdir(dir, (e) => (e.name !== '.git' || !e.stats.isDirectory()) &&
                             e.name !== 'node_modules' &&
                             !e.name.endsWith('.swp'))
}

function readPackage (dirPath) {
  var packagePath = path.resolve(dirPath, 'package.json')
  var content = fs.readFileSync(packagePath, 'utf8')
  return JSON.parse(content)
}

function nodeModulePaths (from) {
  // guarantee that 'from' is absolute.
  from = path.resolve(from)

  // note: this approach *only* works when the path is guaranteed
  // to be absolute.  Doing a fully-edge-case-correct path.split
  // that works on both Windows and Posix is non-trivial.
  var paths = []
  var parts = from.split(splitRe)

  for (var tip = parts.length - 1; tip >= 0; tip--) {
    // don't search in .../node_modules/node_modules
    if (parts[tip] === 'node_modules') continue
    var dir = parts.slice(0, tip + 1).concat('node_modules').join(path.sep)
    paths.push(dir)
  }

  return paths
}

function stat (filename) {
  filename = path._makeLong(filename)
  const result = internalModuleStat(filename)
  return result
}
