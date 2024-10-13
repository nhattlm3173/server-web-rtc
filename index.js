const io = require("socket.io")(process.env.PORT || 3000, {
  cors: {
    origin: "*", // Cho phép tất cả các nguồn (không khuyến khích dùng trong sản xuất)
    methods: ["GET", "POST"], // Các phương thức được phép
    allowedHeaders: ["my-custom-header"], // Header được phép
    credentials: true, // Cho phép gửi cookie
  },
});
const arrUserInfo = [];
const arrWatchStreamUsers = [];
let currentStreamer = null;
io.on("connection", (socket) => {
  socket.on("USER_REGISTER", (user) => {
    const isExist = arrUserInfo.some((u) => {
      return u.username === user.username;
    });

    socket.peerID = user.peerID;
    if (isExist) {
      return socket.emit("REGISTER_FALSE");
    }
    arrUserInfo.push(user);
    socket.emit("ONLINE_LIST", arrUserInfo);
    socket.broadcast.emit("HAVE_NEW_USER", user);

    socket.on("USER_VIEW_LIVESTREAM", (user) => {
      console.log(user);
      arrWatchStreamUsers.push(user);
      console.log(arrWatchStreamUsers);
      if (currentStreamer) {
        console.log(currentStreamer);
        io.emit("NEW_USER_JOIN_LIVESTREAM", user.peerID);
      }
    });
  });

  socket.on("USER_START_LIVESTREAM", (user) => {
    // currentStreamer = user.peerID; // Lưu peerID của người đang livestream
    currentStreamer = socket.id;
    console.log(arrWatchStreamUsers);
    io.to(currentStreamer).emit("GET_WATCHSTREAMLIST", arrWatchStreamUsers);
    socket.broadcast.emit("SOMEONE_LIVESTREAMING", {
      streamer: user.peerID,
      watchStreamUsers: arrWatchStreamUsers,
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
    arrWatchStreamUsers.splice(index, 1);
    console.log(socket.peerID);
    io.emit("SOMEONE_DISCONNECT", socket.peerID);
    if (socket.peerID === currentStreamer) {
      currentStreamer = null; // Xóa streamer nếu người livestream thoát
    }
  });
});
