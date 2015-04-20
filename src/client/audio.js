'use strict';
var shoot = new Audio('assets/shoot.ogg');
var die = new Audio('assets/die.ogg');
var spawn = new Audio('assets/spawn.ogg');
var music = new Audio('assets/bu-weary-monuments.ogg');
music.loop = true;

module.exports = {
  shoot: function(){ shoot.play(); },
  spawn: function(){ spawn.play(); },
  die: function(){ die.play(); },
  music: function(){ music.play(); }
};
