var tesli = require('./03_.js');
var debug = require('debug')('tesliRunner');
var transform = require('./transform.js');
var mygit = require('./mygit.js');
var denodeify = require('./denodeify.js');

var mygit = mygit('/data/procurment-data2/.git');

var git = [
  'revParse',
  'lsTree',
  'mktree',
  'hashObject'
].reduce((s, x) => (s[x] = denodeify(mygit[x]), s), {});

var catFileBatch = mygit.catFileBatch();
git.cat = denodeify(catFileBatch.cat);

git.diffTree = mygit.diffTree;

git.openIndex = function(path) {
  var index = mygit.openIndex(path);
  return {
    readTree: denodeify(index.readTree),
    writeTree: denodeify(index.writeTree),
    createUpdateIndexInfoStream: index.createUpdateIndexInfoStream
  }
}


// var index = git.openIndex('testIndex');
// index.readTree('c88ca5253b54dcc6f8190f187fc7ed001bfce0fb')
//   .then(function(){
//     var s = index.createUpdateIndexInfoStream()
//       .on('finish', function(){
//         index.writeTree().then(function(sha){
//           console.log(sha);
//           git.lsTree(sha).then(console.log.bind(console))
//         });
//       })
//     s.write('0 0000000000000000000000000000000000000000\t706.zsv\n');
//     s.write('0 0000000000000000000000000000000000000000\t707.zsv\n');
//     s.write('0 0000000000000000000000000000000000000000\t708.zsv\n');
//     s.write('100644 blob c7d16995a44f6e7538ab4bd401543fdbda3e723b\tმაშა მაშა\n');
//     s.end();
//   });
// return;  

var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

class Tree {
  constructor(sha){
    this.isEmpty = !sha;
    this.sha = Promise.resolve(sha || emptyTreeSha);
  }

  cd(path){
    return new Tree(this.sha.then(sha => git.revParse(sha + ':' + path)));
  }

  set(path, other){
    return new Tree(
      Promise.all([this.sha, other.sha])
        .then(function([thisTreeSha, otherTreeSha]) {
          return git.lsTree(thisTreeSha)
            .then(function(thisTree) {
              thisTree[path] = { mode: '040000', type: 'tree', sha: otherTreeSha };
              return git.mktree(thisTree);
            });
        })
    );
  }

  diff(other){
    return new Patch(
      Promise.all([this.sha, other.sha])
        .then(function([oldTreeSha, newTreeSha]){
          return git.diffTree(oldTreeSha, newTreeSha);
        })
    );
  }
}

class Patch {
  constructor(promisedAStream){
    this.promisedAStream = promisedAStream;
  }
  filter(filter){
    return new Patch(
      this.promisedAStream.then(function(astream){
        return astream.filter(filter);
      })
    );
  }
  map(mapFunction){
    return new Patch(
      this.promisedAStream.then(function(astream){
        return astream
          .transform(function(p, next){
            var { path, status, newSha, oldSha, mode } = p;
            if(newSha) { this.push({ path, status: 'A', sha: newSha, mode }); }
            if(oldSha) { this.push({ path, status: 'D', sha: oldSha, mode }); }
            next();
          })
          .map(async function(p){
            var ds = [];
            var emitedValues = [];
            var emiter = function (key, value) { emitedValues.push({ key, value }); };

            var buffer = await git.cat(p.sha);

            mapFunction.call({emit: emiter}, p.path, buffer);

            for(var i in emitedValues){
              var emited = emitedValues[i];
              var sha = await git.hashObject(new Buffer(JSON.stringify(emited.value), 'utf8'));
              ds.push({ path: emited.key + '/' + p.path, status: p.status, sha, mode: '100644' });
            }
            return ds;
          })
          .transform(function(values, next){
            var ds = this;
            values.forEach(function(v){
              var { path, status, sha, mode } = v;
              ds.push({ path, status, [status === 'A' ? 'newSha' : 'oldSha']: sha, mode })
            });
            next();
          })
      })
    );
  }

  apply(tree){
    return new Tree(
      Promise.all([this.promisedAStream, tree.sha])
        .then(function([patchsStream, treeSha]){
          var defer = Promise.defer();
          var index = git.openIndex('testIndex2');

          return index.readTree(treeSha).then(function(){
            var indexInfo = index.createUpdateIndexInfoStream()
                        .on('error', err => defer.reject(err))
                        .on('finish', () => defer.resolve());
            patchsStream
              .map(function(p){
                var { path, status, newSha, mode } = p;
                if(status === 'A'){
                  return `${mode} ${newSha}\t${path}\n`
                } else {
                  return `0 0000000000000000000000000000000000000000\t${path}\n`;
                }
              })
              .pipe(require('./logprogress.js')(100))
              .valueOf()
              .on('error', err => defer.reject(err))
              .pipe(indexInfo)

            return defer.promise.then(() => index.writeTree());
          });
        })
    );
  }
}

var rez = tesli(
  new Tree(),
  new Tree('38f5e5fa6f33cac790c29650bead4f88905b2abb'),
  new Tree()
).sha.then(function(sha){
  console.log(sha);
  catFileBatch.end();
}).catch(function(err){
  console.log(err);
  console.log(err.stack);
  catFileBatch.end();
});

debug(rez);
