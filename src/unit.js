'use strict';

var THREE = require('three');
var step = 30;

function Unit(scene, material){
  var geometry = new THREE.PlaneGeometry(50, 50, 1, 1);
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set( 1, 1, 1 );
  this.mesh = mesh;
  scene.add(this.mesh);
  this.direction = 'n';
  this.position = {x:1, y: 1};
}

Object.defineProperty(Unit.prototype, 'direction', {
  get: function(){
    return this._direction;
  },
  set: function(value){
    this._direction = value;
    switch(value){
      case 'n':
        this.mesh.rotation.z = 0;
        break;
      case 'w':
        this.mesh.rotation.z = Math.PI / 2;
        break;
      case 'e':
        this.mesh.rotation.z = Math.PI + Math.PI / 2;
        break;
      case 's':
        this.mesh.rotation.z = Math.PI;
        break;
    }
  }
});

Object.defineProperty(Unit.prototype, 'position', {
  get: function(){
    return this._position;
  },
  set: function(value){
    this._position = value;
    this.mesh.position.x = value.x * step;
    this.mesh.position.y = value.y * step;
  }
});

Unit.prototype.move = function move(){
  switch(this.direction){
    case 'n':
      this.mesh.position.y += step;
      break;
    case 'w':
      this.mesh.position.x -= step;
      break;
    case 'e':
      this.mesh.position.x += step;
      break;
    case 's':
      this.mesh.position.y -= step;
      break;
  }
};

Unit.prototype.reverse = function reverse(){
  switch(this.direction){
    case 'n':
      this.mesh.position.y -= step;
      break;
    case 'w':
      this.mesh.position.x += step;
      break;
    case 'e':
      this.mesh.position.x -= step;
      break;
    case 's':
      this.mesh.position.y += step;
      break;
  }
};

Unit.prototype.left = function left(){
  switch(this.direction){
    case 'n':
      this.direction = 'w';
      break;
    case 'w':
      this.direction = 's';
      break;
    case 's':
      this.direction = 'e';
      break;
    case 'e':
      this.direction = 'n';
      break;
  }
};

Unit.prototype.right = function right(){
  switch(this.direction){
    case 'n':
      this.direction = 'e';
      break;
    case 'e':
      this.direction = 's';
      break;
    case 's':
      this.direction = 'w';
      break;
    case 'w':
      this.direction = 'n';
      break;
  }
};

Unit.prototype.uturn = function uturn(){
  switch(this.direction){
    case 'n':
      this.direction = 's';
      break;
    case 'e':
      this.direction = 'w';
      break;
    case 's':
      this.direction = 'n';
      break;
    case 'w':
      this.direction = 'e';
      break;
  }
};

module.exports = Unit;
