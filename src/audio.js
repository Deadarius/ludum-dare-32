'use strict';
var shot = new Audio('assets/shot.wav');
var die = new Audio('assets/die.wav');
var spawn = new Audio('assets/spawn.wav');

module.exports = {
  shot: function(){ shot.play(); },
  spawn: function(){ spawn.play(); },
  die: function(){ die.play(); }
};
