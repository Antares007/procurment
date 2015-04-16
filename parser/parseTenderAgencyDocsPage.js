var $ = require('cheerio');
var cheerio = $;
var profileRegex = /^.+\((\d+)\)$/;
var parseDate = function (str) {
  var parts = str.split(/\.| /);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]} ${parts[3]}`);
};
var parseAmount = function (str) {
  var parts = str.replace(/`/g,'').split(' ');
  return {amount:parseFloat(parts[0]), currency:parts[1]};
};
var parseKhelshekruleba = function(tds){
  var parts = tds.eq(0).contents().map(function(){
    var text = $(this).text().trim();
    if(text === ''){
      return;
    }
    return text;
  }).get();

  return {
    'ნომერი': parts[1].split(':')[1].trim(),
    'თანხა': parseAmount(parts[2]).amount,
    'ძალაშია': {
      'დან': parseDate(parts[3].split(/: | - /g)[1]+ ' 00:00'),
      'მდე': parseDate(parts[3].split(/: | - /g)[2]+ ' 00:00'),
    },
    'დრო': parseDate(parts[4])
  };
}

module.exports = function(htmlStr) {
  var $ = cheerio.load(htmlStr);
  return {
    'ხელშეკრულებები': $('table')
      .filter(function() {
        return profileRegex.test($(this).find('tr td a').first().attr('onclick'));
      })
      .first()
      .children()
      .map(function(){
        var tds = $(this).children();
        return Object.assign({
          'კომპანია': {
            'id': profileRegex.exec(tds.eq(0).find('a').attr('onclick'))[1],
            'დასახელება': tds.eq(0).find('strong').text(),
          }
        }, parseKhelshekruleba(tds));
      }).get(),
    'შეცდომის გასწორებები': $('table')
      .filter(function(){
        return [ 'ხელშეკრულებაში შეცდომის გასწორება' ].indexOf($(this).prev().text().trim()) === 0
      })
      .first()
      .children()
      .map(function(){
        return parseKhelshekruleba($(this).children());
      }).get(),
    'ცვლილებები': $('table')
      .filter(function(){
        return [ 'ხელშეკრულების ცვლილება' ].indexOf($(this).prev().text().trim()) === 0
      })
      .first()
      .children()
      .map(function(){
        return parseKhelshekruleba($(this).children());
      }).get()
  };
};
