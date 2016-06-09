#!/usr/bin/env node
'use strict'
var argv = require('yargs').argv
const gitDir = argv.gitDir || require('path').resolve(process.cwd(), '.git')
const seedHash = argv._[0]

const api = require('../src/repo')(gitDir)
require('../src/gitrequire')(api)

api.grow = grow

grow(seedHash)
  .then((v) => console.log(v))
  .catch((err) => process.nextTick(function () { throw err }))

function grow (seedHash) {
  const Seed = require('gittypes/seed')
  const GitObject = require('gittypes/gitobject')

  var seed = new Seed(() => Promise.resolve(seedHash))

  return seed.bind(GitObject, function (s) {
    exports = s.fn.load()
    return exports.call(s.args)
  }).getHash(api)
}
