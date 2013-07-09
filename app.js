var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
var anyDB = require('any-db');
var engines = require('consolidate');

var io = require('socket.io').listen(server);
io.set('log level', 1); 
io.configure(function () {
	io.set("transports", ["xhr-polling"]); 
	io.set("polling duration", 10); 
});

app.use(express.bodyParser());
app.engine('html', engines.hogan);
app.set('views', __dirname + '/templates');
app.use('/public', express.static(__dirname + '/public'));

var currData = [];
var room;
var rooms = [];

io.sockets.on('connection', function(socket){
	socket.on('start', function(callback){
		callback(rooms);
	});
	socket.on('join', function(roomName, username, callback){
		console.log(username + " joined room " + roomName);
		socket.join(roomName);
		room = roomName;
		socket.username = username;
		broadcastMembership(roomName);
		callback(currData[roomName]);
	});

	socket.on('drawing', function(roomName, dataURL, oldX, oldY, newX, newY, color, width){
		currData[roomName] = dataURL;
		socket.broadcast.in(roomName).emit('draw', oldX, oldY, newX, newY, color, width);
	});

	socket.on('clear', function(roomName, dataURL) {
		currData[roomName] = dataURL;
		socket.broadcast.in(roomName).emit('clear');
	});

	socket.on('disconnect', function() {
		console.log("disconnected");
		socket.leave(room);
		broadcastMembership(room);
	});
});

app.get('/', function(req, res) {
	res.render('index.html');	
});

app.post('/new', function(req, res) {
	newname = req.body.name;
	res.redirect('/' + newname);
});

app.get('/:roomName', function(req, res) {
	if (rooms.indexOf(req.params.roomName) == -1) {
		rooms.push(req.params.roomName);
		io.sockets.emit('newRoom', req.params.roomName, rooms);
	}
	res.render('room.html', {roomName: req.params.roomName});
});

function broadcastMembership(roomName) {
	var sockets = io.sockets.clients(roomName);
	var usernames = sockets.map(function(socket) {
		return socket.username;
	});
	if (usernames.length == 0) {
		rooms.splice(rooms.indexOf(roomName),1);
		io.sockets.emit('roomClosed', rooms);
	}
	io.sockets.in(roomName).emit('membershipChanged', usernames);
}

var port = process.env.PORT || 8080;
server.listen(port);