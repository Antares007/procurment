#!/usr/bin/env node
'use strict'
const gitDir = process.argv.length > 4
  ? process.argv[2]
  : require('path').resolve(process.cwd(), '.git')
const seedHash = process.argv.length > 4
  ? process.argv[3]
  : process.argv[2]
const rootHash = process.argv.length > 4
  ? process.argv[4]
  : process.argv[3]

const api = require('../src/repo')(gitDir)
const gitrequire = require('../src/gitrequire')

api.grow = function grow (seedHash, rootHash) {
  return new Promise(function (resolve, reject) {
    const exec = require('child_process').exec
    exec(`grow ${gitDir} ${seedHash} ${rootHash}`, (error, stdout, stderr) => {
      if (error) return reject(error)
      resolve(stdout.trim())
    })
  })
}

var exports = gitrequire(api, seedHash)
exports(rootHash)(api)
  .then((v) => console.log(v))
  .catch((err) => process.nextTick(function () { throw err }))
