module.exports = function(htmlStr) {
  var $ = require('cheerio').load(htmlStr);
  var list = $('tbody tr').map(function(i, e){
    var el = $(this);
    var tds = el.children('td');
    var c = tds.first();
    return {
      id: el.attr('onclick').trim().slice('ShowProfile('.length, -1),
      name: c.find('span').text().trim(),
      date: (c = c.next().next(), c.text()).trim(),
        type: (c = c.next(), c.text()).trim()
    };
  }).get();
  return list;
};
