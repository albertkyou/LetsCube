const http = require('http');
const Protocol = require('../../app/lib/protocol.js');
const bcrypt = require('bcrypt');
const socketLogger = require('./logger');
const expressSocketSession = require('express-socket.io-session');
const { User, Room } = require('../models');

function attachUser (socket, next) {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : null;

  if (!userId) {
    return next();
  }

  User.findOne({id: userId}).then(user => {
    socket.user = user;
    next();
  }).catch(err => {
    console.error(err);
  });
}

module.exports = function ({app, expressSession}) {
  const server = http.Server(app);
  const io = require('socket.io')(server);

  io.use(expressSocketSession(expressSession, {
    autoSave: true
  }));
  
  io.use(attachUser);
  io.use(socketLogger);

  io.sockets.on('connection', function (socket) {
    console.log(`socket ${socket.id} connected; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);
    
    // give them the list of rooms
    Room.find().then(rooms => {
      socket.emit(Protocol.UPDATE_ROOMS, rooms);
    });
    
    // Socket wants to join room.
    socket.on(Protocol.JOIN_ROOM, (accessCode, cb) => {
      // get room
      Room.findOne({accessCode}).then(room => {
        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            message: `Could not find room with accessCode ${accessCode}`
          });
          return;
        }
        
        socket.join(accessCode, () => {
          if (socket.user) {
            room.users.push(socket.user);
            socket.room = room;
            socket.emit(Protocol.JOIN, room); // tell the user they're cool and give them the info
            broadcast(Protocol.USER_JOIN, socket.user); // tell everyone

            if (room.doneWithScramble()) {
              console.log(104, 'everyone done, sending new scramble');
              sendNewScramble();
            }

            if (room.users.length === 1) {
              room.admin = socket.user;
              room.save().then(r => {
                broadcastToAllInRoom(Protocol.UPDATE_ADMIN, socket.user);
              }).catch(console.error);
            }
          } else {
            socket.emit(Protocol.JOIN, room); // still give them the data
          }
        });
      }).catch(console.error);
    });

    socket.on(Protocol.SUBMIT_RESULT, (result) => {
      // TODO: expand on handling errors
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      if (!socket.room.attempts[result.id]) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          event: Protocol.SUBMIT_RESULT,
          message: 'Invalid ID for attempt submission',
        });
        return;
      }

      socket.room.attempts[result.id].results.set(socket.user.id.toString(), result.result);
      socket.room.save().then((r) => {
        broadcastToAllInRoom(Protocol.NEW_RESULT, {
          id: result.id,
          userId: socket.user.id,
          result: result.result,
        });
        
        if (socket.room.doneWithScramble()) {
          console.log(123, 'everyone done, sending new scramble');
          sendNewScramble();
        }
      });
    });

    socket.on(Protocol.CREATE_ROOM, (options) => {
      if (!isLoggedIn()) {
        return;
      }

      const room = new Room({
        name: options.name,
        private: !!options.password, // determine if room is private based on if password is defined
        users: []
      });

      if (options.password) {
        room.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
      }

      room.save().then(room => {
        io.emit(Protocol.ROOM_CREATED, room);
        socket.emit(Protocol.FORCE_JOIN, room);
        socket.join(room.accessCode, () => {
          socket.room = room;
          socket.emit(Protocol.JOIN, room);
        });
      }).catch(console.error);
    });

    // Given ID, fetches room, authenticates, and returns room data.
    socket.on(Protocol.FETCH_ROOM, (id) => {
      Room.findById(id).then(room => {
        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            event: Protocol.FETCH_ROOM,
            message: `Could not find room with id ${id}`
          });
        } else {
          socket.emit(Protocol.UPDATE_ROOM, room);
        }
      }).catch(console.error);
    });

    /* Admin Actions */
    socket.on(Protocol.DELETE_ROOM, id => {
      if (!checkAdmin()) {
        return;
      } else if (socket.room.id !== id) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.DELETE_ROOM,
          message: 'Must be admin of your own room',
        });
        return;
      }

      Room.deleteOne({id}).then(() => {
        socket.room = undefined;
        broadcastToEveryone(Protocol.ROOM_DELETED, id);
      }).catch(console.error);
    });

    socket.on(Protocol.REQUEST_SCRAMBLE, () => {
      if (!checkAdmin()) {
        return;
      }

      sendNewScramble();
    });

    socket.on(Protocol.DISCONNECT, () => {
      if (isLoggedIn() && isInRoom()) {
        leaveRoom();
      }

      console.log(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`)
    });

    socket.on(Protocol.LEAVE_ROOM, () => {
      if (isLoggedIn() && isInRoom()) {
        leaveRoom();
      }
    });

    function checkAdmin() {
      if (!isLoggedIn() || !isInRoom()) {
        return false;        
      } else if (socket.room.admin.id !== socket.user.id) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: 'Must be admin of room',
        });
        return false;
      }
      return true;
    }

    function isLoggedIn() {
      if (!socket.user) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: `Must be logged in`,
        });
      }
      return !!socket.user;
    }

    function isInRoom() {
      if (!socket.room) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          message: `Have be in a room`,
        });
      }
      return !!socket.room;
    }

    function leaveRoom () {
      socket.room.users = socket.room.users.filter(i => i.id !== socket.user.id);

      broadcast(Protocol.USER_LEFT, socket.user.id);

      if (socket.room.users.length > 0) {
        socket.room.admin = socket.room.users[0]; // pick new admin
        socket.room.save().then((r) => {
          broadcastToAllInRoom(Protocol.UPDATE_ADMIN, socket.room.admin);
          
          if (socket.room.doneWithScramble()) {
            console.log(196, 'everyone done, sending new scramble');
            sendNewScramble();
          }
          
          socket.room = undefined;
        });
      } else if (socket.room.users.length === 0) {
        socket.room.admin = undefined;
        socket.room.save();
      }
    }

    function sendNewScramble () {
      socket.room.newAttempt(attempt => {
        broadcastToAllInRoom(Protocol.NEW_ATTEMPT, attempt);
      });
    }

    function broadcast () {
      socket.broadcast.to(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToAllInRoom () {
      io.in(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToEveryone () {
      io.emit(...arguments);
    }
  });

  return server;
}