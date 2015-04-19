'use strict';

var THREE = require('three');
var socket = require('socket.io-client');
var Unit = require('./unit');
var _ = require('lodash');
var util = require('util');
var minimist = require('minimist');

var scene = new THREE.Scene();

 var backMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
});
 var backGeometry = new THREE.PlaneGeometry(100000, 100000, 500, 500);
 var backMesh = new THREE.Mesh(backGeometry, backMaterial);
 backMesh.position.set(0, 0, 0);
 scene.add(backMesh);

var viewport = document.getElementById('viewport');

var renderer = new THREE.WebGLRenderer();
renderer.setSize(viewport.clientWidth, viewport.clientHeight);

viewport.appendChild(renderer.domElement);

var ambientLight = new THREE.AmbientLight(0x404040);
var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
directionalLight.position.set(0, 1, 1);

scene.add(ambientLight);
scene.add(directionalLight);

//var camera = new THREE.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, 0.1, 1000);
var camera = new THREE.PerspectiveCamera( 75, viewport.clientWidth/viewport.clientHeight, 0.1, 1000000 );

var unitTexture;
unitTexture = THREE.ImageUtils.loadTexture('assets/unit.png');
unitTexture.minFilter = THREE.NearestFilter;
unitTexture.magFilter = THREE.NearestFilter;

var unitMaterial = new THREE.MeshBasicMaterial( { map: unitTexture, color: 0xff0000, transparent: true } );

var bulletTexture;
bulletTexture = THREE.ImageUtils.loadTexture('assets/bullet.png');
bulletTexture.minFilter = THREE.NearestFilter;
bulletTexture.magFilter = THREE.NearestFilter;

var bulletMaterial = new THREE.MeshBasicMaterial( { map: bulletTexture, color: 0xff0000, transparent: true } );

camera.position.z = 500;

var socketIo = socket();
var username;

setInterval(function(){
  socketIo.emit('heart-beat');
}, 5000);

var players = {};
var bullets = [];

socketIo.on('state', function(state){
  _.values(state.units)
    .forEach(function(unit){
      var player = players[unit.username];
      if(!player){
        player = players[unit.username] = new Unit(scene, unitMaterial);
        player.username = unit.username;
      }

      player.position = unit.position;
      player.direction = unit.direction;
      if(player.username === username){
        console.debug('%s:', player.username);
        console.debug('    POS:%s', util.inspect(player.position));
        console.debug('    DIR:%s:', util.inspect(player.direction));
        camera.lookAt(player.mesh.position);
      }
      if(unit.dead){
        player.die();
      }
    });

  state.bullets.forEach(function(bulletServer, index){
    var bullet = bullets[index];
    if(!bullet){
      bullet = bullets[index] = new Unit(scene, bulletMaterial);
    }

    bullet.position = bulletServer.position;
    bullet.direction = bulletServer.direction;
  });
});

var commandInput = document.getElementById('command');
commandInput.onkeyup = checkKey;

function checkKey(e) {
  var code = e.which || e.keyCode;

  if (+code !== 13) {
    return;
  }

  var args = minimist(commandInput.value.split(' '));
  if(args._[0] === 'login'){
    username = args._[1];
    socketIo.emit('login', username);
  }
  else{
  socketIo.emit('command', commandInput.value);
}
  commandInput.value = '';
}

var render = function () {
  requestAnimationFrame( render );
  renderer.render(scene, camera);
};

render();
