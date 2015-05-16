var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
var debug = require('debug')('tesli');

export class Tree {
  constructor(shaFn = (git) => Promise.resolve(emptyTreeSha)){
    this.isEmpty = true;
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    return this.promisedSha = this.shaFn(git);
  }

  get(path, nullValue){
    return new Tree(async (git) => {
      var sha = await this.getSha(git);
      try{
        var target = await git.revParse(sha + ':' + path);
        return target;
      } catch(ex){
        if(ex.message.indexOf('does not exist in') >= 0){
          return await nullValue.getSha(git);
        }
        throw ex;
      }
    });
  }

  diff(other){
    return new Diff(async (git) => git.diffTree(await this.getSha(git), await other.getSha(git)));
  }

  cd(fn){
    var self = this;
    return new Tree(async (git) => {
      var tree = (await git.lsTree(await this.getSha(git))).reduce(function(tree, entry){
        tree[entry.name] = entry.type === 'tree' ? new Tree(entry.sha) : new Blob(entry.sha);
        return tree;
      }, {});

      fn.call(tree, tree);

      return await git.mktree(
        await Promise.all(
          Object.keys(tree).map(async function(name){
            var e = tree[name];
            var type = e instanceof Tree ? 'tree' : 'blob';
            var mode = e instanceof Tree ? '040000' : '100644';
            var sha = await e.getSha(git);
            return { mode, type, sha, name };
          })
        )
      );
    });
  }

  reduce(fn){
    var self = this;
    return new Blob(async (git) => {
      var sha = await this.getSha(git);
      debug('reduceing: ' + sha);
      var entries = await git.lsTree(sha);

      var shas = await Promise.all(
        entries.map(x => x.type === 'tree' ? new Tree(x.sha).reduce(fn).getSha(git) : x.sha)
      );

      var buffers = await Promise.all(shas.map(x => git.cat(x)));
      var blobSha = await git.hashObject(fn(buffers));
      debug('rediced: ' + sha +' -> ' + blobSha);
      return blobSha;
    });
  }
}

export class Blob {
  constructor(shaFn){
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }
  static of(value){
    return new Blob(async (git) => {
      return await git.hashObject(new Buffer(JSON.stringify(value)));
    });
  }

  toTree(fn){
    return new Tree(async (git) => {
      var entries = [];
      var buffer = await git.cat(await this.getSha(git));

      fn.call({
        emit: function(path, buffer){
          entries.push({ path, buffer });
        }
      }, buffer);

      var treeEntries = await Promise.all(
        entries.map(async e => ({
          mode: '100644',
          type: 'blob',
          sha: await git.hashObject(e.buffer),
          path: e.path
        }))
      );

      return await git.mkDeepTree(treeEntries);
    });
  }

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    this.promisedSha = this.shaFn(git);
    return this.promisedSha;
  }
}

class Diff {
  constructor(promisedAStream){
    this.promisedAStream = promisedAStream;
  }
  filter(filter){
    return new Diff(git =>
      this.promisedAStream(git).then(function(astream){
        return astream.filter(filter);
      })
    );
  }
  map(mapFunction){
    return new Diff(async (git) => {
      var astream = await this.promisedAStream(git);
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
            var blobName = hash(p.path + '/' + i);
            ds.push({
              path: emited.key + '/' + blobName,
              status: p.status,
              sha,
              mode: '100644'
            });
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
        });
    });
  }

  toTree(){
    return new Tree(async (git) => {
      var patchsStream = await this.promisedAStream(git);

      var index = git.openIndex('testIndex2');

      await index.readTree(await new Tree().getSha(git));

      await patchsStream
        .map(function(p){
          var { path, status, newSha, mode } = p;
          return `${mode} ${newSha}\t${status}/${path}\n`
        })
        .pipe(require('./logprogress.js')(10))
        .writeTo(index.createUpdateIndexInfoStream());

      return await index.writeTree();
    });
  }

  apply(tree){
    return new Tree(async (git) => {
      var patchsStream = await this.promisedAStream(git);

      var index = git.openIndex('testIndex2');

      await index.readTree(await tree.getSha(git));

      await patchsStream
        .map(function(p){
          var { path, status, newSha, mode } = p;
          if(status === 'A'){
            return `${mode} ${newSha}\t${path}\n`
          } else {
            return `0 0000000000000000000000000000000000000000\t${path}\n`;
          }
        })
        .pipe(require('./logprogress.js')(10))
        .writeTo(index.createUpdateIndexInfoStream());

      return await index.writeTree();
    });
  }
}

var crypto = require('crypto');
function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
