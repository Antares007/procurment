#!/usr/bin/env node
'use strict'
const gitDir = process.argv.length > 3
  ? process.argv[2]
  : require('path').resolve(process.cwd(), '.git')
const targetPath = process.argv.length > 3
  ? process.argv[3]
  : process.argv[2]
const api = require('../src/repo')(gitDir)

importDir(targetPath)
  .getHash(api)
  .then((value) => console.log(value))
  .catch((err) => process.nextTick(function () { throw err }))

function importDir (dir) {
  var readdir = require('../src/treefromfs')
  return readdir(dir, (e) => (e.name !== '.git' || !e.stats.isDirectory()) &&
                             !e.name.endsWith('.swp'))
}
