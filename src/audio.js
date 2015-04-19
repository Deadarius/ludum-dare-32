'use strict';
var shot = new Audio('assets/shot.wav');
var die = new Audio('assets/die.wav');
var spawn = new Audio('assets/spawn.wav');
var music = new Audio('assets/bu-weary-monuments.wav');
music.loop = true;

module.exports = {
  shot: function(){ shot.play(); },
  spawn: function(){ spawn.play(); },
  die: function(){ die.play(); },
  music: function(){ music.play(); }
};
