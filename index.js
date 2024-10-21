const io = require("socket.io")(process.env.PORT || 3000, {
  cors: {
    origin: [
      "https://nhattlm3173.github.io/WebUsingRTC",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
    ], // Cho phép tất cả các nguồn (không khuyến khích dùng trong sản xuất)
    methods: ["GET", "POST"], // Các phương thức được phép
    allowedHeaders: ["my-custom-header"], // Header được phép
    credentials: true,
    // Cho phép gửi cookie
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
});
const arrUserInfo = [];
const arrWatchStreamUsers = [];
const chatHistory = [];
let currentStreamer = null;
let streamID;
io.on("connection", (socket) => {
  socket.on("USER_REGISTER", (user) => {
    const isExist = arrUserInfo.some((u) => {
      return u.username === user.username;
    });

    socket.peerID = user.peerID;
    if (isExist) {
      return socket.emit("REGISTER_FALSE");
    }
    arrUserInfo.push({
      peerID: user.peerID,
      username: user.username,
      publicKey: user.publicKey,
      socketID: socket.id,
    });
    socket.emit("ONLINE_LIST", arrUserInfo);
    socket.broadcast.emit("HAVE_NEW_USER", user);

    socket.on("USER_VIEW_LIVESTREAM", (user) => {
      console.log(user);
      if (
        arrWatchStreamUsers.findIndex((u) => u.peerID === user.peerID) === -1
      ) {
        arrWatchStreamUsers.push(user);
      }

      // console.log(arrWatchStreamUsers);
      if (currentStreamer) {
        console.log(currentStreamer);
        io.emit("NEW_USER_JOIN_LIVESTREAM", user.peerID);
      }
    });
  });

  socket.on("USER_START_LIVESTREAM", (user) => {
    // currentStreamer = user.peerID; // Lưu peerID của người đang livestream
    currentStreamer = socket.id;
    // console.log(arrWatchStreamUsers);
    io.to(currentStreamer).emit("GET_WATCHSTREAMLIST", arrWatchStreamUsers);
    socket.broadcast.emit("SOMEONE_LIVESTREAMING", {
      streamer: user.peerID,
    });
  });

  socket.on("disconnect", () => {
    const index = arrUserInfo.findIndex(
      (user) => user.peerID === socket.peerID
    );
    const index2 = arrWatchStreamUsers.findIndex(
      (user) => user.peerID === socket.peerID
    );
    arrUserInfo.splice(index, 1);
    arrWatchStreamUsers.splice(index2, 1);
    // console.log(socket.peerID);
    io.emit("SOMEONE_DISCONNECT", socket.peerID);
    if (socket.peerID === currentStreamer) {
      currentStreamer = null; // Xóa streamer nếu người livestream thoát
    }
  });
  // Khi người dùng gọi
  socket.on("CALL_USER", ({ callerPeerID, callerName, receiverPeerID }) => {
    // Tìm người nhận trong danh sách người dùng online và gửi thông tin người gọi
    const receiverSocket = arrUserInfo.find(
      (user) => user.peerID === receiverPeerID
    );
    // console.log("tao: " + receiverSocket);
    if (receiverSocket) {
      // Gửi thông báo cho người nhận, bao gồm peerID của người gọi
      io.to(receiverSocket.socketID).emit("INCOMING_CALL", {
        callerPeerID,
        callerName,
        receiverPeerID,
      });
    }
  });

  socket.on("REJECT_CALL", ({ callerPeerID, username }) => {
    const receiverSocket = arrUserInfo.find(
      (user) => user.peerID === callerPeerID
    );
    const message = `Người dùng ${username} từ chối cuộc gọi!`;
    // console.log(message);
    io.to(receiverSocket.socketID).emit("CALL_REJECTION_NOTIFICATION", message);
  });
  // socket.emit("CHAT_MESSAGE_HISTORY", chatHistory);
  socket.on("REQUEST_STOP_CALLING", (receiverID) => {
    const receiverSocket = arrUserInfo.find(
      (user) => user.peerID === receiverID
    );
    if (receiverSocket) {
      io.to(receiverSocket.socketID).emit("STOP_CALLING");
    }
  });
  socket.on("NEW_CHAT_MESSAGE", (data) => {
    const { userID, receiverId, senderId, message } = data;
    const user = arrUserInfo.find((u) => u.peerID === userID);
    const receiver = arrUserInfo.find((u) => u.peerID === receiverId);
    // console.log("senderId: " + senderId)
    if (user) {
      const chatMessage = { username: user.username, message };
      // chatHistory.push(chatMessage);
      io.emit("RECEIVE_CHAT_MESSAGE", chatMessage);
    }
  });

  // socket.on("CHAT_COMMENT_HISTORY", (streamId) => {

  // });
  //COMMENT
  socket.on("CREATE_CHAT_COMMENT_ROOM", (streamId) => {
    // Lọc lịch sử chat theo streamerID
    const messages = chatHistory.filter((u) => u.streamerID === streamId);
    streamID = streamId;
    // console.log(messages); // Log ra lịch sử comment

    // Gửi lịch sử comment về cho người dùng trong room
    if (messages.length > 0) {
      io.to(socket.id).emit("RECEIVE_CHAT_COMMENT_HISTORY", messages);
    }
  });

  socket.on("NEW_CHAT_COMMENT", (data) => {
    const { userID, message, streamerID } = data;
    const user = arrUserInfo.find((u) => u.peerID === userID);
    const streamerSocket = arrUserInfo.find((u) => u.peerID === streamerID);
    if (user) {
      const chatMessage = {
        streamerID: streamerID,
        username: user.username,
        message,
      };
      chatHistory.push(chatMessage); // Lưu tin nhắn vào lịch sử
      io.emit("RECEIVE_CHAT_COMMENT", chatMessage);
      if (streamerSocket) {
        io.to(streamerSocket.socketID).emit(
          "RECEIVE_CHAT_COMMENT_FOR_STREAMER",
          chatMessage
        );
      }
    }
  });
  socket.on("DELETE_HISTORY_COMMENT_BY_USERID", (userID) => {
    chatHistory = chatHistory.filter(
      (message) => message.streamerID !== userID
    );
  });
  socket.on("SEND_FILE", (data) => {
    const { file, fileName, fileType, userID, receiverId } = data;
    const user = arrUserInfo.find((u) => u.peerID === userID);
    const receiver = arrUserInfo.find((u) => u.peerID === receiverId);
    console.log("aaa");
    if (user && receiver) {
      const fileMessage = {
        username: user.username,
        fileName,
        fileType,
        fileData: file, // Dữ liệu file dưới dạng binary
      };
      io.to(receiver.socketID).emit("RECEIVE_FILE", fileMessage);
    }
  });
});
