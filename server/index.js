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
  socket.on('login', function(username){
    console.log('LOGIN: %s[%s]', username, this.id);
    state.units= {}; //TODO Remove that
    state.units[this.id] = {
      position:{
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10)
      },
      direction: 'n',
      username: username
    };

    socket.emit('state', state);
    socket.emit('commands', commandsCache);
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

setInterval(function(){
  var now = new Date();
  Object.keys(connections).forEach(function(id){
    var connection = connections[id];
    var noHeartBeatDuration = now - connection.lastHeartBeat;
    if(noHeartBeatDuration > 15000){
      console.log('User timed out');
      removeConnection(connection.socket.id);
    }
  });

  if(commandsCache.length > 0){
    commandsCache.forEach(function(command){
      var unit = state.units[command.id];
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
            direction: _.clone(unit.direction)
          });
      }
    });

    commandsCache = [];
  }

  if(state.bullets.length > 0){
    state.bullets.forEach(function(bullet){
      moveDict[bullet.direction](bullet);
    });
  }

  socketIo.emit('state', state);
  socketIo.emit('commands', commandsCache);

}, 50);

app.use('/', express.static(path.join(__dirname, '../dist')));

//app.listen(process.env.PORT || 3000);
server.listen(process.env.PORT || 3000);

