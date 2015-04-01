var $ = require('cheerio');
var cheerio = $;
var textTrim = function(td){
  return td.text().trim();
};
var parseDate = function (str) {
  var parts = str.split(/\.| /);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]} ${parts[3]}`);
};
var parseAmount = function (str) {
  var parts = str.replace(/`/g,'').split(' ');
  return {amount:parseFloat(parts[0]), currency:parts[1]};
};
var valueParsers = {
  'ტენდერის ტიპი': textTrim,
  'სატენდერო განცხადების ნომერი': function(td){
    return td.find('strong').first().text();
  },
  'ტენდერის სტატუსი': textTrim,
  'შემსყიდველი': function(td){
    var onclick = td.find('a').first().attr('onclick');
    return {
      id: /^.+\((\d+)\)$/.exec(onclick)[1],
      'დასახელება': td.text().trim()
    };
  },
  'ტენდერის გამოცხადების თარიღი': function(td){
    return parseDate(textTrim(td));
  },
  'წინადადებების მიღება იწყება': function(td){
    return parseDate(textTrim(td));
  },
  'წინადადებების მიღება მთავრდება': function(td){
    return parseDate(textTrim(td));
  },
  'დაფინანსების წყარო': textTrim,
  'შესყიდვის სავარაუდო ღირებულება': function(td){
    return {
      'თანხა': parseAmount(td.find('span').first().text().trim()),
      'შენიშვნა': td.find('span').first().next().text().trim()
    };
  },
  'სატენდერო წინადადება წარმოდგენილი უნდა იყოს': textTrim,
  'კლასიფიკატორის  (CPV) კოდი და  კლასიფიკატორის დანაყოფი': function(td){
    return td.find('div ul li').map(function(){
      return $(this).text().trim();
    }).get();
  },
  'კლასიფიკატორის  (CPV) კოდი და შესყიდვის კონკრეტული ობიექტი': function(td){
    return td.find('div ul li').map(function(){
      return $(this).text().trim();
    }).get();
  },
  'დამატებითი ინფორმაცია': function(td){
    var value = td.text().trim();
    if(value === '') return;
    return td.text().trim();
  },
  'შესყიდვის რაოდენობა ან მოცულობა': textTrim,
  'მოწოდების ვადა': function(td){
    return td.text().trim();
  },
  'შეთავაზების ფასის კლების ბიჯი': function(td){
    return parseAmount(textTrim(td));
  },
  'გარანტიის ოდენობა': function(td){
    return parseAmount(textTrim(td));
  },
  'გარანტიის მოქმედების ვადა': textTrim,

  'პრეისკურანტის სავარაუდო ღირებულება': function(td){
    return parseAmount(textTrim(td));
  },
  'შესყიდვის ობიექტის სახელშეკრულებო ღირებულება': function(td){
    return {
      'თანხა': parseAmount(td.find('span').first().text().trim()),
      'შენიშვნა': td.find('span').first().next().text().trim()
    };
  },
  'დონორი': textTrim,
  'ერთეულის სავარაუდო ღირებულება': function(td){
    return parseAmount(textTrim(td));
  },
};

module.exports = function(htmlStr) {
  var $ = cheerio.load(htmlStr);
  return $('table').filter(function() {
    return $(this).find('td').first().text() === 'ტენდერის ტიპი';
  }).first()
  .find('tbody tr td')
  .map(function(){ return $(this); })
  .get()
  .reduce(function(state, td){
    var maybeKey = td.text().trim();
    // console.log(maybeKey);
    if(valueParsers.hasOwnProperty(maybeKey)){
      state.parserKey = maybeKey;
    } else {
      var rez = valueParsers[state.parserKey](td);
      if(typeof rez !== 'undefined'){
        state.rez[state.parserKey] = rez;
        state.parserKey = null;
      }
    }
    return state;
  }, { rez:{} }).rez;
};
