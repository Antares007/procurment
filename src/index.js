module.exports = {
  Hashish: require('./hashish'),
  Blob: require('./blob'),
  Tree: require('./tree'),
  Commit: require('./commit'),
  git: require('../repo'),
  createSeed: require('../src/createseed'),
  get: (Type, hash) => new Type((git) => Promise.resolve(hash))
}

