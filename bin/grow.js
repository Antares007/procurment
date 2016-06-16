#!/usr/bin/env node
'use strict'
const argv = require('yargs')
  .default('git-dir', require('path').resolve(process.cwd(), '.git'))
  .demand(1)
  .argv
const gitDir = argv.gitDir
const seedHash = argv._[0]

const debug = require('debug')('grow')
const api = require('../src/repo')(gitDir)
const deasync = require('deasync')
const valueOf = deasync(function (hashish, cb) {
  hashish
    .valueOf(api)
    .then((v) => cb(null, v))
    .catch((err) => cb(err))
})

require('../src/gitrequire')(valueOf)

api.grow = grow

grow(seedHash)
  .then((v) => console.log(v))
  .catch((err) => process.nextTick(function () { throw err }))

function grow (seedHash) {
  const Seed = require('gittypes/seed')
  var seed = new Seed(() => Promise.resolve(seedHash))
  var s = valueOf(seed)
  exports = s.fn.load()
  var t = valueOf(s.args)
  var args = Object.keys(t).map((i) => t[i])
  var argsStr = args.map((a) => `${a.constructor.name}_${a.hash.slice(0, 6)}`).join(', ')
  return exports.apply(s.fn, args).getHash(api).then(function (hash) {
    debug(`${s.fn.name}_${s.fn.hash.slice(0, 6)}(${argsStr}) => ${hash.slice(0, 6)}`)
    return hash
  })
}
