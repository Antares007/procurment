module.exports = function($) {
  var keyvalues = [];
  var savedKey;

  $('table').filter(function() {
    return $(this).find('td').first().text() === 'ტენდერის ტიპი';
  }).first()
    .find('tbody tr')
    .each(function(){
      var tds = $(this).children();
      if(tds.length === 2) {
        savedKey = null;
        keyvalues.push({ key: tds.first(), value: tds.last() });
      } else if(tds.length === 1) {
        if(savedKey) {
          keyvalues.push({ key: savedKey, value: tds.first() });
          savedKey = null;
        } else {
          savedKey = tds.first();
        }
      }
    });
  var valueParsers = {
    'სატენდერო განცხადების ნომერი': function(value) {
      return value.find('strong').first().text();
    },
    'შემსყიდველი': function(value) {
      return {
        id: value.find('a').attr('onclick').slice('ShowProfile('.length, -1),
        name: value.text().trim()
      };
    },
    'default': function(value) {
      var values = value.text()
        .trim()
        .split('\n')
        .map(function(x) { return x.trim(); })
        .filter(function(x) { return x; });
      return values.length > 1 ? values : values[0];
    }
  };
  var rez = keyvalues.map(function(x) {
    var key = x.key.text().trim();
    var value = 
      valueParsers[key] ? valueParsers[key](x.value) : valueParsers['default'](x.value);
    return {
      key: key,
      value: value
    };
  });
  return rez.reduce(function(memo, x) {
    memo[x.key] = x.value;
    return memo;
  }, {});
};

