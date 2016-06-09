#!/usr/bin/env node
'use strict'
var argv = require('yargs').argv
const gitDir = argv.gitDir || require('path').resolve(process.cwd(), '.git')
const packageHash = argv._[0]
const argsHash = argv._[1]

const api = require('../src/repo')(gitDir)

const Seed = require('gittypes/seed')
const Package = require('gittypes/package')
const GitObject = require('gittypes/gitobject')

var args = new GitObject(() => Promise.resolve(argsHash))

args.bind(Seed, function (a) {
  return Seed.of({
    args: new (require(`gittypes/${a.type}`))(() => Promise.resolve(argsHash)),
    fn: new Package(() => Promise.resolve(packageHash))
  })
}).getHash(api)
  .then((value) => console.log(value))
  .catch((err) => process.nextTick(function () { throw err }))
