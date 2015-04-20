'use strict';
var shot = new Audio('assets/shot.ogg');
var die = new Audio('assets/die.ogg');
var spawn = new Audio('assets/spawn.ogg');
var music = new Audio('assets/bu-weary-monuments.ogg');
music.loop = true;

module.exports = {
  shot: function(){ shot.play(); },
  spawn: function(){ spawn.play(); },
  die: function(){ die.play(); },
  music: function(){ music.play(); }
};
