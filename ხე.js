var crypto = require('crypto');
var Tree = require('./tesli/tree').Tree,
  Commit = require('./tesli/commit').Commit,
  Blob = require('./tesli/blob').Blob;

export class ხე {
  constructor(commit){
    this.commit = commit;
  }

  filter(fn){
    return new ხე(
      this.commit.grow({
        სახეობა: 'გადააწყე_საკრებებად',
        ფუნქცია: function (oldRoot, newRoot, oldTree) {

          return new Tree(async (git) => {
            
            var patchStream = git.diffTree(await oldRoot.getSha(git), await newRoot.getSha(git))
              .filter(x => fn(x.path))
            var newTreeSha = await git.mkDeepTree(await oldTree.getSha(git), patchStream)

            return newTreeSha;
          });
        },
        ანაბეჭდი(){
          return hash(this.ფუნქცია.toString())
        }
      })
    );
  }

  ამოკრიბე(fn){
    return new ხე(
      this.commit.grow({
        სახეობა: 'ამოკრიბე',
        ფუნქცია: function(oldRoot, newRoot, oldTree){
          return oldTree;
        },
        საწყისი_მდგომარეობა: Tree.of({}),
        ანაბეჭდი(){
          return hash(this.ფუნქცია.toString())
        }
      })
    );
  }

  გამოარჩიე(links){
    return new ხე(
      this.commit.grow({
        სახეობა: 'გამოარჩიე',
        ფუნქცია: function(oldRoot, newRoot, oldTree){
          if(typeof links === 'string'){
            return newRoot.get(links, new Tree());
          }

          var rec = function(o, paths, value){
            var key = paths.shift();
            if(paths.length > 0){
              o[key] = o[key] || {};
              rec(o[key], paths, value)
            } else {
              o[key] = value;
            }
          };

          var tree = Object.keys(links).reduce(function(tree, path){
            rec(tree, path.split('/'), links[path]);
            return tree;
          }, {});

          return Tree.of(tree);
        },
        ანაბეჭდი(){
          return hash(this.ფუნქცია.toString())
        }
      })
    );
  }

  გაზარდე(fn){
    return new ხე(
      this.commit.grow({
        სახეობა: 'გაზარდე',
        ფუნქცია: fn,
        საწყისი_მდგომარეობა: Tree.of({})
      })
    );
  }

  გამოხშირე(fn){
    return new ხე(
      this.commit.grow({
        სახეობა: 'გამოხშირე',
        ფუნქცია: function(oldRoot, newRoot, oldTree){
          return oldTree.cd(function(){
          });
        },
        საწყისი_მდგომარეობა: Tree.of({})
      })
    );
  }
}

function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
