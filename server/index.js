'use strict';

var util = require('util');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var socketIo = require('socket.io')(server);
var _ = require('lodash');

var commandsCache = [];
var connections = {};

var state = {
	units: {},
  bullets: [],
};

socketIo.on('connection', function (socket) {
	console.log('User connected');
  connections[socket.id] = {
    socket: socket,
    lastHeartBeat: new Date()
  };

  socket.emit('state', state);
  socket.emit('commands', commandsCache);

  socket.on('login', function(username){
    console.log('LOGIN: %s[%s]', username, this.id);
    state.units[this.id] = {
      position:{
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10)
      },
      direction: 'n',
      username: username,
      dead: false,
      killed: 0
    };
    socketIo.emit('state', state);
  });

  socket.on('heart-beat', function(){
    var connection = connections[this.id];
    if(connection){
      connection.lastHeartBeat = new Date();
    }
  });

  socket.on('command', function (command) {
    var newCommand = {id: this.id, command: command};
    commandsCache.push(newCommand);
    socketIo.emit('new-command', newCommand);
    console.log('%s: %s', this.id, command);
  });
});

socketIo.on('disconnect', function(){
  removeConnection(this.id);
});

function removeConnection(id){
  var connection = connections[id];
  if(!connection){
    return;
  }
  connection.socket.disconnect();
  delete connections[id];
  delete state.units[id];
  console.log('user disconnected');
}

var rotateLeftDict = {
  'n': 'w',
  'w': 's',
  's': 'e',
  'e': 'n'
};

var rotateRightDict = {
  'n': 'e',
  'e': 's',
  's': 'w',
  'w': 'n'
};

var rotateUturnDict = {
  'n': 's',
  'e': 'w',
  's': 'n',
  'w': 'e'
};

var moveDict = {
  'n': function(unit){unit.position.y++;},
  'e': function(unit){unit.position.x++;},
  's': function(unit){unit.position.y--;},
  'w': function(unit){unit.position.x--;},
};

var reverseDict = {
  'n': function(unit){unit.position.y--;},
  'e': function(unit){unit.position.x--;},
  's': function(unit){unit.position.y++;},
  'w': function(unit){unit.position.x++;},
};

function timeOutConnections(){
  var now = new Date();
  var changed = false;

  Object.keys(connections).forEach(function(id){
    var connection = connections[id];
    var noHeartBeatDuration = now - connection.lastHeartBeat;

    if(noHeartBeatDuration > 15000){
      console.log('User timed out');
      removeConnection(connection.socket.id);
      changed = true;
    }
  });

  return changed;
}

function executeCommands(){
  if(commandsCache.length === 0){
    return false;
  }

  commandsCache.forEach(function(command){
    var unit = state.units[command.id];
    if(unit){
      switch(command.command){
        case 'move':
          moveDict[unit.direction](unit);
          break;
        case 'left':
          unit.direction = rotateLeftDict[unit.direction];
          break;
        case 'right':
          unit.direction = rotateRightDict[unit.direction];
          break;
        case 'uturn':
          unit.direction = rotateUturnDict[unit.direction];
          break;
        case 'reverse':
          reverseDict[unit.direction](unit);
          break;
        case 'shot':
          state.bullets.push({
            position: _.clone(unit.position),
            direction: _.clone(unit.direction),
            shotBy: command.id
          });
      }
    }
  });

  commandsCache = [];
  return true;
}

function updateBullets(){
  if(state.bullets.length === 0){
    return false;
  }

  state.bullets.forEach(function(bullet, index){
    moveDict[bullet.direction](bullet);
    if(bullet.position.x > 1000 || bullet.position.y > 1000 ||
      bullet.position.x < -1000 || bullet.position.y < -1000){
        delete state.bullets[index];
    } else {
      Object.keys(state.units).forEach(function(id){
        var unit = state.units[id];
        if(unit.position.x === bullet.position.x &&
          unit.position.y === bullet.position.y){
          delete state.units[id];
          var killer = state.units[bullet.shotBy];
          if(killer){
            killer.killed++;
          }

          socketIo.emit('dead', {
            died: unit.username,
            killer: killer.username
          });
        }
      });
    }
  });
  return true;
}

setInterval(function(){
  var changed = false;

  changed = timeOutConnections();
  changed = executeCommands() || changed;
  changed = updateBullets() || changed;

  if(changed){
    socketIo.emit('state', state);
    socketIo.emit('commands', commandsCache);
  }

}, 50);

app.use('/', express.static(path.join(__dirname, '../dist')));

server.listen(process.env.PORT || 3000);

