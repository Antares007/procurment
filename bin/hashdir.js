#!/usr/bin/env node
'use strict'
const argv = require('yargs')
  .default('git-dir', require('path').resolve(process.cwd(), '.git'))
  .demand(1)
  .argv
const gitDir = argv.gitDir
const targetPath = argv._[0]

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
