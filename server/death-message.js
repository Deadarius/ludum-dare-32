'use strict';
var util = require('util');

var messages = [
  '%s has just slaughtered %s',
  '%s turned %s into ashes',
  '%s made %s cry like a baby',
  '%s destroyed %s',
  '%s slapped %s with his big red cannon'
];

module.exports = function(killer, victim){
  var index = Math.floor(Math.random() * (messages.length - 1));
  return util.format(messages[index], killer, victim);
};
