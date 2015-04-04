var level = require('level');
var transform = require('./transform.js');

level('/data/cache').createReadStream({
  gt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=app_result!',
  lt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=app_result~',
  // limit: 10
}).pipe(
  (function(){
    var ids = [];
    return transform(function(kv, next){
      ids.push(parseInt(kv.key.split('=')[2], 10))
      next();
    }, function(done){
      this.push(ids);
      done();
    })
  })()
).pipe(
  transform(function(ids, next){

    var missed = ids.sort(function(a, b){ return a - b; })
      .reduce(function(state, b){
        for(var i = state.last + 1; i < b; i++) {
          state.ids.push(i);
        }
        state.last = b;
        return state;
      }, { ids: [], last: ids[0]}).ids;

    console.log(missed);

    next();
  })
).on('finish', function(){
  console.log('finish');
}).pipe(
  process.stdout
);

